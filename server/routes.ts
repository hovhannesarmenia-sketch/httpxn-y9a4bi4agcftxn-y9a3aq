import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createCalendarEvent, deleteCalendarEvent, appendToSheet } from "./services/google";
import { sendTelegramMessage, setWebhook, deleteWebhook, answerCallbackQuery, generateCalendarKeyboard } from "./services/telegram";

const doctorUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  interfaceLanguage: z.enum(['ARM', 'RU']).optional(),
  workDays: z.array(z.string()).optional(),
  workDayStartTime: z.string().optional(),
  workDayEndTime: z.string().optional(),
  slotStepMinutes: z.number().min(5).max(120).optional(),
  telegramBotToken: z.string().min(10).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  telegramChatId: z.string().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  googleCalendarId: z.string().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  googleSheetId: z.string().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  aiEnabled: z.boolean().optional(),
  llmApiBaseUrl: z.string().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  llmApiKey: z.string().min(5).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  llmModelName: z.string().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
}).transform(data => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
});

const syncCalendarSchema = z.object({
  appointmentId: z.string().min(1, "appointmentId required"),
  action: z.enum(['create', 'delete'], { errorMap: () => ({ message: "action must be 'create' or 'delete'" }) }),
});

const syncSheetsSchema = z.object({
  appointmentId: z.string().min(1, "appointmentId required"),
});

export async function registerRoutes(app: Express): Promise<void> {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const user = await storage.createUser({ email, password });
      
      const doctorProfile = await storage.createDoctor({
        userId: user.id,
        firstName,
        lastName,
      });

      req.session.userId = user.id;
      res.json({ user: { id: user.id, email: user.email }, doctor: doctorProfile });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      const doctor = await storage.getDoctorByUserId(user.id);
      res.json({ user: { id: user.id, email: user.email }, doctor });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const doctor = await storage.getDoctorByUserId(user.id);
    res.json({ user: { id: user.id, email: user.email }, doctor });
  });

  app.get("/api/doctor", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }
    
    const safeDoctor = {
      ...doctor,
      telegramBotToken: doctor.telegramBotToken ? '••••••••' : null,
      llmApiKey: doctor.llmApiKey ? '••••••••' : null,
      hasTelegramToken: !!doctor.telegramBotToken,
      hasLlmKey: !!doctor.llmApiKey,
    };
    res.json(safeDoctor);
  });

  app.patch("/api/doctor/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor || doctor.id !== id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    try {
      const validatedData = doctorUpdateSchema.parse(req.body);
      
      if (Object.keys(validatedData).length === 0) {
        return res.json(doctor);
      }

      const updated = await storage.updateDoctor(id, validatedData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      throw error;
    }
  });

  app.get("/api/services", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const servicesList = await storage.getServices(doctor.id);
    res.json(servicesList);
  });

  app.post("/api/services", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const service = await storage.createService({ ...req.body, doctorId: doctor.id });
    res.json(service);
  });

  app.patch("/api/services/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const service = await storage.getService(id);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor || service.doctorId !== doctor.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const updated = await storage.updateService(id, req.body);
    res.json(updated);
  });

  app.delete("/api/services/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const service = await storage.getService(id);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor || service.doctorId !== doctor.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await storage.deleteService(id);
    res.json({ success: true });
  });

  app.get("/api/patients", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const patientsList = await storage.getPatients(doctor.id);
    res.json(patientsList);
  });

  app.get("/api/patients/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const patient = await storage.getPatient(id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.json(patient);
  });

  app.get("/api/appointments", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const appointmentsList = await storage.getAppointments(doctor.id);
    res.json(appointmentsList);
  });

  app.post("/api/appointments", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const appointment = await storage.createAppointment({ ...req.body, doctorId: doctor.id });
    res.json(appointment);
  });

  app.patch("/api/appointments/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const appointment = await storage.getAppointment(id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor || appointment.doctorId !== doctor.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const updated = await storage.updateAppointment(id, req.body);
    res.json(updated);
  });

  app.delete("/api/appointments/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const appointment = await storage.getAppointment(id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor || appointment.doctorId !== doctor.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await storage.deleteAppointment(id);
    res.json({ success: true });
  });

  app.get("/api/blocked-days", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const days = await storage.getBlockedDays(doctor.id);
    res.json(days);
  });

  app.post("/api/blocked-days", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const day = await storage.createBlockedDay({ ...req.body, doctorId: doctor.id });
    res.json(day);
  });

  app.delete("/api/blocked-days/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await storage.deleteBlockedDay(id);
    res.json({ success: true });
  });

  // ============ INTEGRATION ROUTES ============

  // Sync appointment to Google Calendar
  app.post("/api/integrations/sync-calendar", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const parsed = syncCalendarSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      const { appointmentId, action } = parsed.data;

      const doctor = await storage.getDoctorByUserId(req.session.userId);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        return res.status(400).json({ error: "Google service account not configured" });
      }

      if (!doctor.googleCalendarId) {
        return res.status(400).json({ error: "Google Calendar ID not configured in settings" });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment || appointment.doctorId !== doctor.id) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const patient = await storage.getPatient(appointment.patientId);
      let service = null;
      if (appointment.serviceId) {
        service = await storage.getService(appointment.serviceId);
      }

      if (action === 'create') {
        const startTime = new Date(appointment.startDateTime);
        const endTime = new Date(startTime.getTime() + appointment.durationMinutes * 60000);

        const serviceName = service 
          ? (doctor.interfaceLanguage === 'ARM' ? service.nameArm : service.nameRu)
          : appointment.customReason || '\u041f\u0440\u0438\u0435\u043c';

        const event = {
          summary: `${patient?.firstName} ${patient?.lastName || ''} - ${serviceName}`,
          description: `\u041f\u0430\u0446\u0438\u0435\u043d\u0442: ${patient?.firstName} ${patient?.lastName || ''}\n\u0422\u0435\u043b\u0435\u0444\u043e\u043d: ${patient?.phoneNumber || '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d'}\n\u0423\u0441\u043b\u0443\u0433\u0430: ${serviceName}\n\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a: ${appointment.source || 'Web'}`,
          start: {
            dateTime: startTime.toISOString(),
            timeZone: 'Asia/Yerevan',
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Yerevan',
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 60 },
              { method: 'popup', minutes: 15 },
            ],
          },
        };

        const result = await createCalendarEvent(doctor.googleCalendarId, event);
        
        if (result.id) {
          await storage.updateAppointment(appointmentId, { googleCalendarEventId: result.id });
        }

        res.json({ success: true, eventId: result.id });
      } else if (action === 'delete' && appointment.googleCalendarEventId) {
        await deleteCalendarEvent(doctor.googleCalendarId, appointment.googleCalendarEventId);
        await storage.updateAppointment(appointmentId, { googleCalendarEventId: null });
        res.json({ success: true });
      } else {
        res.json({ success: true });
      }
    } catch (error: unknown) {
      console.error("Calendar sync error:", error);
      const message = error instanceof Error ? error.message : 'Calendar sync failed';
      if (message.includes('access token') || message.includes('JWT')) {
        return res.status(400).json({ error: "Google authentication failed - check service account configuration" });
      }
      if (message.includes('calendar') || message.includes('Calendar')) {
        return res.status(400).json({ error: "Invalid calendar ID or insufficient permissions" });
      }
      res.status(500).json({ error: message });
    }
  });

  // Log appointment to Google Sheets
  app.post("/api/integrations/sync-sheets", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const parsed = syncSheetsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      const { appointmentId } = parsed.data;

      const doctor = await storage.getDoctorByUserId(req.session.userId);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        return res.status(400).json({ error: "Google service account not configured" });
      }

      if (!doctor.googleSheetId) {
        return res.status(400).json({ error: "Google Sheet ID not configured in settings" });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment || appointment.doctorId !== doctor.id) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const patient = await storage.getPatient(appointment.patientId);
      let service = null;
      if (appointment.serviceId) {
        service = await storage.getService(appointment.serviceId);
      }

      const startTime = new Date(appointment.startDateTime);
      const serviceName = service 
        ? (doctor.interfaceLanguage === 'ARM' ? service.nameArm : service.nameRu)
        : appointment.customReason || '\u041f\u0440\u0438\u0435\u043c';

      const rowData = [
        appointment.id,
        startTime.toLocaleDateString('ru-RU'),
        startTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim(),
        patient?.phoneNumber || '',
        serviceName,
        `${appointment.durationMinutes} \u043c\u0438\u043d`,
        appointment.status || 'PENDING',
        appointment.source || 'Telegram',
        new Date().toISOString(),
      ];

      await appendToSheet(doctor.googleSheetId, rowData);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Sheets sync error:", error);
      const message = error instanceof Error ? error.message : 'Sheets sync failed';
      if (message.includes('access token') || message.includes('JWT')) {
        return res.status(400).json({ error: "Google authentication failed - check service account configuration" });
      }
      if (message.includes('spreadsheet') || message.includes('Spreadsheet')) {
        return res.status(400).json({ error: "Invalid sheet ID or insufficient permissions" });
      }
      res.status(500).json({ error: message });
    }
  });

  // Test Telegram connection
  app.post("/api/integrations/test-telegram", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const doctor = await storage.getDoctorByUserId(req.session.userId);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      if (!doctor.telegramBotToken || !doctor.telegramChatId) {
        return res.status(400).json({ error: "Telegram not configured" });
      }

      await sendTelegramMessage(
        doctor.telegramBotToken,
        doctor.telegramChatId,
        '✅ <b>MedBook Test</b>\n\nТест подключения прошел успешно!'
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Telegram test error:", error);
      res.status(500).json({ error: "Telegram test failed" });
    }
  });

  // Setup Telegram webhook
  app.post("/api/integrations/setup-telegram-webhook", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const doctor = await storage.getDoctorByUserId(req.session.userId);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      if (!doctor.telegramBotToken) {
        return res.status(400).json({ error: "Telegram bot token not configured" });
      }

      const domainsEnv = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN;
      if (!domainsEnv) {
        return res.status(500).json({ error: "Could not determine webhook URL - no domain configured" });
      }
      const domain = domainsEnv.split(',')[0].trim();
      const webhookUrl = `https://${domain}/api/telegram-webhook`;
      
      await deleteWebhook(doctor.telegramBotToken);
      await setWebhook(doctor.telegramBotToken, webhookUrl);
      
      console.log("[Webhook] Force reset webhook to:", webhookUrl);
      res.json({ success: true, webhookUrl });
    } catch (error) {
      console.error("Webhook setup error:", error);
      res.status(500).json({ error: "Webhook setup failed" });
    }
  });

  // Telegram webhook endpoint (public - called by Telegram)
  app.post("/api/telegram-webhook", async (req: Request, res: Response) => {
    try {
      const update = req.body;
      
      if (!update || typeof update !== 'object') {
        console.log("[Webhook] Invalid update received");
        return res.json({ ok: true });
      }

      console.log("[Webhook] Received update type:", 
        update.message ? 'message' : 
        update.callback_query ? 'callback_query' : 
        update.edited_message ? 'edited_message' : 'unknown'
      );

      const doctors = await storage.getAllDoctors();
      const doctor = doctors[0];
      
      if (!doctor || !doctor.telegramBotToken) {
        console.log("[Webhook] No doctor or bot token configured");
        return res.json({ ok: true });
      }

      if (update.message) {
        const message = update.message;
        const chatId = message.chat?.id;
        const text = message.text;
        
        if (!chatId) {
          console.log("[Webhook] No chat ID in message");
          return res.json({ ok: true });
        }

        if (text === '/start') {
          await sendTelegramMessage(
            doctor.telegramBotToken,
            chatId,
            '\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c!\n\n\u042d\u0442\u043e \u0431\u043e\u0442 \u0434\u043b\u044f \u0437\u0430\u043f\u0438\u0441\u0438 \u043d\u0430 \u043f\u0440\u0438\u0435\u043c.\n\u041f\u043e\u043b\u043d\u044b\u0439 \u0444\u0443\u043d\u043a\u0446\u0438\u043e\u043d\u0430\u043b \u0441\u043a\u043e\u0440\u043e \u0431\u0443\u0434\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d.',
            {
              inline_keyboard: [
                [{ text: '\u0540\u0561\u0575\u0565\u0580\u0565\u0576', callback_data: 'lang_arm' }, { text: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', callback_data: 'lang_ru' }]
              ]
            }
          );
        }
      } else if (update.callback_query) {
        const callback = update.callback_query;
        const chatId = callback.message?.chat?.id;
        const callbackId = callback.id;
        const data = callback.data;
        
        if (!chatId || !callbackId) {
          console.log("[Webhook] Invalid callback query");
          return res.json({ ok: true });
        }

        console.log("[Webhook] Callback data:", data);
        
        try {
          await answerCallbackQuery(doctor.telegramBotToken, callbackId);
        } catch (e) {
          console.log("[Webhook] Failed to answer callback query:", e);
        }
        
        if (data === 'lang_arm' || data === 'lang_ru') {
          const lang = data === 'lang_arm' ? 'ARM' : 'RU';
          const now = new Date();
          
          const blockedDays = await storage.getBlockedDays(doctor.id);
          const appointments = await storage.getAppointments(doctor.id);
          
          const availabilityMap = new Map<string, boolean>();
          
          for (const blocked of blockedDays) {
            availabilityMap.set(blocked.blockedDate, false);
          }
          
          const appointmentCounts = new Map<string, number>();
          for (const apt of appointments) {
            if (apt.status !== 'CANCELLED_BY_DOCTOR' && apt.status !== 'REJECTED') {
              const dateOnly = apt.startDateTime.toISOString().split('T')[0];
              appointmentCounts.set(dateOnly, (appointmentCounts.get(dateOnly) || 0) + 1);
            }
          }
          
          const maxSlotsPerDay = 8;
          for (const [date, count] of appointmentCounts) {
            if (count >= maxSlotsPerDay) {
              availabilityMap.set(date, false);
            }
          }
          
          const calendarKeyboard = generateCalendarKeyboard({
            year: now.getFullYear(),
            month: now.getMonth(),
            lang: lang,
            availabilityMap
          });
          
          const selectDateText = lang === 'ARM' 
            ? '\u0538\u0576\u057f\u0580\u0565\u0584 \u0561\u0574\u057d\u0561\u0569\u056b\u057e\u0568:'
            : 'Выберите дату:';
          
          await sendTelegramMessage(doctor.telegramBotToken, chatId, selectDateText, calendarKeyboard);
        }
        
        if (data?.startsWith('calendar_nav_')) {
          const match = data.match(/calendar_nav_(\d+)_(\d+)/);
          if (match) {
            const navYear = parseInt(match[1]);
            const navMonth = parseInt(match[2]);
            
            const blockedDays = await storage.getBlockedDays(doctor.id);
            const appointments = await storage.getAppointments(doctor.id);
            
            const availabilityMap = new Map<string, boolean>();
            
            for (const blocked of blockedDays) {
              availabilityMap.set(blocked.blockedDate, false);
            }
            
            const appointmentCounts = new Map<string, number>();
            for (const apt of appointments) {
              if (apt.status !== 'CANCELLED_BY_DOCTOR' && apt.status !== 'REJECTED') {
                const dateOnly = apt.startDateTime.toISOString().split('T')[0];
                appointmentCounts.set(dateOnly, (appointmentCounts.get(dateOnly) || 0) + 1);
              }
            }
            
            const maxSlotsPerDay = 8;
            for (const [date, count] of appointmentCounts) {
              if (count >= maxSlotsPerDay) {
                availabilityMap.set(date, false);
              }
            }
            
            const calendarKeyboard = generateCalendarKeyboard({
              year: navYear,
              month: navMonth,
              lang: 'RU',
              availabilityMap
            });
            
            await sendTelegramMessage(doctor.telegramBotToken, chatId, 'Выберите дату:', calendarKeyboard);
          }
        }
        
        if (data?.startsWith('select_date_')) {
          const selectedDate = data.replace('select_date_', '');
          const confirmText = `Вы выбрали: ${selectedDate}\n\nПолный функционал записи скоро будет доступен.`;
          await sendTelegramMessage(doctor.telegramBotToken, chatId, confirmText);
        }
        
      } else if (update.edited_message) {
        console.log("[Webhook] Edited message received - ignoring");
      } else {
        console.log("[Webhook] Unsupported update type received");
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("[Webhook] Error:", error);
      res.json({ ok: true });
    }
  });

  // Check integration connections status
  app.get("/api/integrations/status", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const doctor = await storage.getDoctorByUserId(req.session.userId);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      res.json({
        telegram: {
          configured: !!doctor.telegramBotToken && !!doctor.telegramChatId,
          hasBotToken: !!doctor.telegramBotToken,
          hasChatId: !!doctor.telegramChatId,
        },
        googleCalendar: {
          configured: !!doctor.googleCalendarId && !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
          hasCalendarId: !!doctor.googleCalendarId,
          hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        },
        googleSheets: {
          configured: !!doctor.googleSheetId && !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
          hasSheetId: !!doctor.googleSheetId,
          hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        },
      });
    } catch (error) {
      console.error("Integration status error:", error);
      res.status(500).json({ error: "Failed to get integration status" });
    }
  });
}
