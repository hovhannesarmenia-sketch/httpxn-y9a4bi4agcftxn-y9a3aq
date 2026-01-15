import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { createCalendarEvent, deleteCalendarEvent, appendToSheet } from "./services/google";
import { sendTelegramMessage, setWebhook } from "./services/telegram";

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

    const updated = await storage.updateDoctor(id, req.body);
    res.json(updated);
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
      const { appointmentId, action } = req.body;
      
      if (!appointmentId || !action) {
        return res.status(400).json({ error: "appointmentId and action required" });
      }

      const doctor = await storage.getDoctorByUserId(req.session.userId);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      if (!doctor.googleCalendarId) {
        return res.status(400).json({ error: "Google Calendar not configured" });
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
          : appointment.customReason || 'Прием';

        const event = {
          summary: `${patient?.firstName} ${patient?.lastName || ''} - ${serviceName}`,
          description: `Пациент: ${patient?.firstName} ${patient?.lastName || ''}\nТелефон: ${patient?.phoneNumber || 'Не указан'}\nУслуга: ${serviceName}\nИсточник: ${appointment.source || 'Web'}`,
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
    } catch (error) {
      console.error("Calendar sync error:", error);
      res.status(500).json({ error: "Calendar sync failed" });
    }
  });

  // Log appointment to Google Sheets
  app.post("/api/integrations/sync-sheets", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { appointmentId } = req.body;
      
      if (!appointmentId) {
        return res.status(400).json({ error: "appointmentId required" });
      }

      const doctor = await storage.getDoctorByUserId(req.session.userId);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      if (!doctor.googleSheetId) {
        return res.status(400).json({ error: "Google Sheets not configured" });
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
        : appointment.customReason || 'Прием';

      const rowData = [
        appointment.id,
        startTime.toLocaleDateString('ru-RU'),
        startTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim(),
        patient?.phoneNumber || '',
        serviceName,
        `${appointment.durationMinutes} мин`,
        appointment.status || 'PENDING',
        appointment.source || 'Telegram',
        new Date().toISOString(),
      ];

      await appendToSheet(doctor.googleSheetId, rowData);
      res.json({ success: true });
    } catch (error) {
      console.error("Sheets sync error:", error);
      res.status(500).json({ error: "Sheets sync failed" });
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

      const webhookUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://' + process.env.REPL_SLUG + '.' + process.env.REPL_OWNER + '.repl.co'}/api/telegram-webhook`;
      
      await setWebhook(doctor.telegramBotToken, webhookUrl);
      res.json({ success: true, webhookUrl });
    } catch (error) {
      console.error("Webhook setup error:", error);
      res.status(500).json({ error: "Webhook setup failed" });
    }
  });

  // Telegram webhook endpoint (public - called by Telegram)
  app.post("/api/telegram-webhook", async (req: Request, res: Response) => {
    try {
      console.log("[Webhook] Received update:", JSON.stringify(req.body).substring(0, 200));

      // Get the first doctor (single-tenant for now)
      const doctors = await storage.getAllDoctors();
      const doctor = doctors[0];
      
      if (!doctor || !doctor.telegramBotToken) {
        console.log("[Webhook] No doctor or bot token configured");
        return res.json({ ok: true });
      }

      // For now, just acknowledge - full bot logic to be ported later
      // This ensures the webhook is working
      const update = req.body;
      
      if (update.message?.text === '/start') {
        const chatId = update.message.chat.id;
        await sendTelegramMessage(
          doctor.telegramBotToken,
          chatId,
          '👋 <b>Добро пожаловать!</b>\n\nЭто бот для записи на прием.\nПолный функционал скоро будет доступен.',
          {
            inline_keyboard: [
              [{ text: '🇦🇲 Հայdelays', callback_data: 'lang_arm' }, { text: '🇷🇺 Русский', callback_data: 'lang_ru' }]
            ]
          }
        );
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("[Webhook] Error:", error);
      res.json({ ok: true }); // Always return 200 to Telegram
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
