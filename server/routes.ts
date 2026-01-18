import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createCalendarEvent, deleteCalendarEvent, appendToSheet } from "./services/google";
import { 
  sendTelegramMessage, 
  setWebhook, 
  deleteWebhook, 
  answerCallbackQuery, 
  generateCalendarKeyboard,
  generateTimeSlotKeyboard,
  generateServiceKeyboard,
  generateAvailableTimeSlots
} from "./services/telegram";
import { 
  bulkBlockDaysSchema, 
  bulkCancelAppointmentsSchema, 
  createPatientApiSchema 
} from "../shared/schema";

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

  app.post("/api/patients", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    try {
      const parsed = createPatientApiSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      
      const patientData = {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName || null,
        phoneNumber: parsed.data.phoneNumber || null,
        telegramUserId: String(parsed.data.telegramUserId),
        language: parsed.data.language || 'ARM',
      };
      
      const patient = await storage.createPatient(patientData);
      res.json(patient);
    } catch (error) {
      console.error('Error creating patient:', error);
      res.status(500).json({ error: "Failed to create patient" });
    }
  });

  app.get("/api/patients/:id/appointments", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const allAppointments = await storage.getAppointments(doctor.id);
    const patientAppointments = allAppointments.filter(apt => apt.patientId === id);
    
    const enrichedAppointments = await Promise.all(
      patientAppointments.map(async (apt) => {
        let services = null;
        if (apt.serviceId) {
          const service = await storage.getService(apt.serviceId);
          if (service) {
            services = { name_arm: service.nameArm, name_ru: service.nameRu };
          }
        }
        return { ...apt, services };
      })
    );
    
    res.json(enrichedAppointments);
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

  app.post("/api/blocked-days/bulk", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    try {
      const parsed = bulkBlockDaysSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { dates, reason } = parsed.data;
      const results = [];
      for (const blockedDate of dates) {
        try {
          const day = await storage.createBlockedDay({ 
            doctorId: doctor.id, 
            blockedDate, 
            reason: reason || null 
          });
          results.push(day);
        } catch (e) {
          // Ignore duplicates
        }
      }
      res.json(results);
    } catch (error) {
      console.error('Error blocking days:', error);
      res.status(500).json({ error: "Failed to block days" });
    }
  });

  app.delete("/api/blocked-days/bulk", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    try {
      const parsed = bulkBlockDaysSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { dates } = parsed.data;
      const blockedDays = await storage.getBlockedDays(doctor.id);
      const daysToDelete = blockedDays.filter(d => dates.includes(d.blockedDate));
      
      for (const day of daysToDelete) {
        await storage.deleteBlockedDay(day.id);
      }
      res.json({ deleted: daysToDelete.length });
    } catch (error) {
      console.error('Error unblocking days:', error);
      res.status(500).json({ error: "Failed to unblock days" });
    }
  });

  app.post("/api/appointments/bulk-cancel", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    try {
      const parsed = bulkCancelAppointmentsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { appointmentIds, reason } = parsed.data;
      const results = [];
      for (const aptId of appointmentIds) {
        const apt = await storage.getAppointment(aptId);
        if (apt && apt.doctorId === doctor.id) {
          const updated = await storage.updateAppointment(aptId, {
            status: 'CANCELLED_BY_DOCTOR',
            rejectionReason: reason || null
          });
          results.push(updated);
        }
      }
      res.json(results);
    } catch (error) {
      console.error('Error bulk cancelling appointments:', error);
      res.status(500).json({ error: "Failed to cancel appointments" });
    }
  });

  app.get("/api/appointments/with-details", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const appointments = await storage.getAppointments(doctor.id);
    const enriched = await Promise.all(
      appointments.map(async (apt) => {
        const patient = await storage.getPatient(apt.patientId);
        let service = null;
        if (apt.serviceId) {
          service = await storage.getService(apt.serviceId);
        }
        return {
          ...apt,
          patients: patient ? {
            first_name: patient.firstName,
            last_name: patient.lastName,
            telegram_user_id: patient.telegramUserId
          } : null,
          services: service ? {
            name_arm: service.nameArm,
            name_ru: service.nameRu
          } : null
        };
      })
    );
    res.json(enriched);
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
          await storage.deleteTelegramSession(String(chatId));
          await sendTelegramMessage(
            doctor.telegramBotToken,
            chatId,
            '\u0411\u0430\u0440\u0587 \u0565\u056F\u0561\u056C! / \u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C!\n\n\u0538\u0576\u057F\u0580\u0565\u0584 \u056C\u0565\u0566\u0578\u0582\u0568 / Выберите язык:',
            {
              inline_keyboard: [
                [{ text: '\u0540\u0561\u0575\u0565\u0580\u0565\u0576', callback_data: 'lang_arm' }, { text: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', callback_data: 'lang_ru' }]
              ]
            }
          );
        } else {
          const telegramUserId = String(message.from?.id || chatId);
          const session = await storage.getTelegramSession(telegramUserId);
          const lang: 'ARM' | 'RU' = session?.language || 'RU';
          
          if (session?.step === 'awaiting_name' && text) {
            const nameParts = text.trim().split(' ').filter((p: string) => p.length > 0);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            if (!firstName || firstName.length < 2) {
              const errorText = lang === 'ARM' 
                ? '\u053D\u0576\u0564\u0580\u0578\u0582\u0574 \u0565\u0574, \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0565\u0584 \u0541\u0565\u0580 \u0561\u0576\u0578\u0582\u0576\u0568:'
                : '\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0432\u0430\u0448\u0435 \u0438\u043C\u044F:';
              await sendTelegramMessage(doctor.telegramBotToken, chatId, errorText);
              return res.json({ ok: true });
            }
            
            await storage.upsertTelegramSession(telegramUserId, {
              firstName,
              lastName: lastName || undefined,
              step: 'awaiting_phone'
            });
            
            const phonePromptText = lang === 'ARM' 
              ? '\u0544\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0565\u0584 \u0541\u0565\u0580 \u0570\u0565\u057C\u0561\u056D\u0578\u057D\u0561\u0570\u0561\u0574\u0561\u0580\u0568:'
              : '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0432\u0430\u0448 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430:';
            await sendTelegramMessage(doctor.telegramBotToken, chatId, phonePromptText);
            return res.json({ ok: true });
          }
          
          if (session?.step === 'awaiting_phone' && text) {
            const phoneNumber = text.trim().replace(/\s/g, '');
            const phoneDigits = phoneNumber.replace(/[^\d]/g, '');
            
            if (phoneDigits.length < 8 || phoneDigits.length > 15) {
              const errorText = lang === 'ARM' 
                ? '\u0546\u0577\u0565\u0584 \u0573\u056B\u0577\u057F \u0570\u0565\u057C\u0561\u056D\u0578\u057D\u0561\u0570\u0561\u0574\u0561\u0580: \u0555\u0580\u056B\u0576\u0561\u056F\u055D +37491234567'
                : '\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430. \u041F\u0440\u0438\u043C\u0435\u0440: +37491234567';
              await sendTelegramMessage(doctor.telegramBotToken, chatId, errorText);
              return res.json({ ok: true });
            }
            
            if (!session.selectedDate || !session.selectedTime) {
              const restartText = lang === 'ARM' 
                ? '\u054D\u0565\u057D\u056B\u0561\u0576 \u0561\u057E\u0561\u0580\u057F\u057E\u0565\u056C \u0567. \u0546\u0578\u0580\u056B\u0581 \u057D\u056F\u057D\u0565\u056C \u0570\u0561\u0574\u0561\u0580 \u0563\u0580\u0565\u0584 /start'
                : '\u0421\u0435\u0441\u0441\u0438\u044F \u0438\u0441\u0442\u0435\u043A\u043B\u0430. \u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 /start \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C \u0437\u0430\u043D\u043E\u0432\u043E.';
              await sendTelegramMessage(doctor.telegramBotToken, chatId, restartText);
              return res.json({ ok: true });
            }
            
            const firstName = session.firstName || '';
            const lastName = session.lastName || '';
            
            let patient = await storage.getPatientByTelegramUserId(telegramUserId);
            if (!patient) {
              patient = await storage.createPatient({
                telegramUserId,
                firstName,
                lastName: lastName || undefined,
                phoneNumber,
                language: lang
              });
            } else {
              patient = await storage.updatePatient(patient.id, {
                firstName,
                lastName: lastName || undefined,
                phoneNumber
              }) || patient;
            }
            
            const startDateTime = new Date(`${session.selectedDate}T${session.selectedTime}:00`);
            
            const appointment = await storage.createAppointment({
              doctorId: doctor.id,
              patientId: patient.id,
              serviceId: session.serviceId || undefined,
              startDateTime,
              durationMinutes: session.durationMinutes || 30,
              status: 'PENDING'
            });
            
            const service = session.serviceId ? await storage.getService(session.serviceId) : null;
            const serviceName = service ? (lang === 'ARM' ? service.nameArm : service.nameRu) : '';
            
            if (doctor.googleCalendarId && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
              try {
                const eventTitle = `${firstName} ${lastName} - ${serviceName}`.trim();
                const endDateTime = new Date(startDateTime.getTime() + (session.durationMinutes || 30) * 60 * 1000);
                
                const eventResult = await createCalendarEvent(doctor.googleCalendarId, {
                  summary: eventTitle,
                  start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Yerevan' },
                  end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Yerevan' },
                  description: `\u0422\u0435\u043B: ${phoneNumber}`
                });
                
                if (eventResult?.id) {
                  await storage.updateAppointment(appointment.id, { googleCalendarEventId: eventResult.id });
                }
              } catch (calError) {
                console.error('[Webhook] Google Calendar error:', calError);
              }
            }
            
            await storage.deleteTelegramSession(telegramUserId);
            
            const simpleConfirmation = lang === 'ARM' 
              ? `\u0541\u0565\u0580 \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0568 \u0568\u0576\u0564\u0578\u0582\u0576\u057E\u0565\u0581!\n${session.selectedDate} ${session.selectedTime}`
              : `\u0412\u0430\u0448\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043F\u0440\u0438\u043D\u044F\u0442\u0430!\n${session.selectedDate} ${session.selectedTime}`;
            await sendTelegramMessage(doctor.telegramBotToken, chatId, simpleConfirmation);
            
            if (doctor.telegramChatId) {
              const adminNotification = `\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C!\n\n\u041F\u0430\u0446\u0438\u0435\u043D\u0442: ${firstName} ${lastName}\n\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${phoneNumber}\n\u0414\u0430\u0442\u0430: ${session.selectedDate}\n\u0412\u0440\u0435\u043C\u044F: ${session.selectedTime}\n\u0423\u0441\u043B\u0443\u0433\u0430: ${serviceName}`;
              try {
                await sendTelegramMessage(doctor.telegramBotToken, doctor.telegramChatId, adminNotification);
              } catch (notifyErr) {
                console.error('[Webhook] Failed to notify doctor:', notifyErr);
              }
            }
            return res.json({ ok: true });
          }
        }
      } else if (update.callback_query) {
        const callback = update.callback_query;
        const chatId = callback.message?.chat?.id;
        const callbackId = callback.id;
        const data = callback.data;
        const telegramUserId = String(callback.from?.id || chatId);
        
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
        
        const session = await storage.getTelegramSession(telegramUserId);
        const lang: 'ARM' | 'RU' = session?.language || 'RU';
        
        const getAvailabilityMap = async () => {
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
          return availabilityMap;
        };
        
        if (data === 'lang_arm' || data === 'lang_ru') {
          const selectedLang = data === 'lang_arm' ? 'ARM' : 'RU';
          await storage.upsertTelegramSession(telegramUserId, { 
            language: selectedLang as 'ARM' | 'RU', 
            step: 'awaiting_date' 
          });
          
          const now = new Date();
          const availabilityMap = await getAvailabilityMap();
          
          const calendarKeyboard = generateCalendarKeyboard({
            year: now.getFullYear(),
            month: now.getMonth(),
            lang: selectedLang as 'ARM' | 'RU',
            availabilityMap
          });
          
          const selectDateText = selectedLang === 'ARM' 
            ? '\u0538\u0576\u057f\u0580\u0565\u0584 \u0561\u0574\u057d\u0561\u0569\u056b\u057e\u0568:'
            : 'Выберите дату:';
          
          await sendTelegramMessage(doctor.telegramBotToken, chatId, selectDateText, calendarKeyboard);
        }
        
        else if (data?.startsWith('calendar_nav_')) {
          const match = data.match(/calendar_nav_(\d+)_(\d+)/);
          if (match) {
            const navYear = parseInt(match[1]);
            const navMonth = parseInt(match[2]);
            const availabilityMap = await getAvailabilityMap();
            
            const calendarKeyboard = generateCalendarKeyboard({
              year: navYear,
              month: navMonth,
              lang: lang,
              availabilityMap
            });
            
            const selectDateText = lang === 'ARM' 
              ? '\u0538\u0576\u057f\u0580\u0565\u0584 \u0561\u0574\u057d\u0561\u0569\u056b\u057e\u0568:'
              : 'Выберите дату:';
            await sendTelegramMessage(doctor.telegramBotToken, chatId, selectDateText, calendarKeyboard);
          }
        }
        
        else if (data === 'back_to_calendar') {
          const now = new Date();
          const availabilityMap = await getAvailabilityMap();
          
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
        
        else if (data?.startsWith('select_date_')) {
          const selectedDate = data.replace('select_date_', '');
          await storage.upsertTelegramSession(telegramUserId, { 
            selectedDate, 
            step: 'awaiting_time' 
          });
          
          const appointments = await storage.getAppointments(doctor.id);
          const bookedTimes: string[] = [];
          for (const apt of appointments) {
            if (apt.status !== 'CANCELLED_BY_DOCTOR' && apt.status !== 'REJECTED') {
              const aptDate = apt.startDateTime.toISOString().split('T')[0];
              if (aptDate === selectedDate) {
                const timeStr = apt.startDateTime.toTimeString().substring(0, 5);
                bookedTimes.push(timeStr);
              }
            }
          }
          
          const workStart = doctor.workDayStartTime || '09:00';
          const workEnd = doctor.workDayEndTime || '18:00';
          const slotStep = doctor.slotStepMinutes || 15;
          
          const timeSlots = generateAvailableTimeSlots(workStart, workEnd, slotStep, bookedTimes);
          const availableSlots = timeSlots.filter(s => s.available);
          
          if (availableSlots.length === 0) {
            const noSlotsText = lang === 'ARM' 
              ? '\u054E\u0561\u0575, \u0561\u0575\u057D \u0585\u0580\u057E\u0561 \u0570\u0561\u0574\u0561\u0580 \u0561\u0566\u0561\u057F \u056A\u0561\u0574 \u0579\u056F\u0561:' 
              : 'К сожалению, на эту дату нет свободного времени.';
            
            const now = new Date();
            const availabilityMap = await getAvailabilityMap();
            const calendarKeyboard = generateCalendarKeyboard({
              year: now.getFullYear(),
              month: now.getMonth(),
              lang: lang,
              availabilityMap
            });
            await sendTelegramMessage(doctor.telegramBotToken, chatId, noSlotsText, calendarKeyboard);
          } else {
            const keyboard = generateTimeSlotKeyboard(timeSlots, selectedDate, lang);
            const timePromptText = lang === 'ARM' 
              ? `\u0538\u0576\u057F\u0580\u0565\u0584 \u056A\u0561\u0574\u0568 (${selectedDate}):`
              : `Выберите время (${selectedDate}):`;
            await sendTelegramMessage(doctor.telegramBotToken, chatId, timePromptText, keyboard);
          }
        }
        
        else if (data?.startsWith('select_time_')) {
          const match = data.match(/select_time_(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})/);
          if (match) {
            const [, selectedDate, selectedTime] = match;
            await storage.upsertTelegramSession(telegramUserId, { 
              selectedDate,
              selectedTime, 
              step: 'awaiting_service' 
            });
            
            const doctorServices = await storage.getServices(doctor.id);
            const activeServices = doctorServices.filter(s => s.isActive);
            
            if (activeServices.length === 0) {
              const noServicesText = lang === 'ARM' 
                ? '\u054E\u0561\u0575, \u056E\u0561\u057C\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0576\u0565\u0580 \u0579\u056F\u0561\u0576 \u0570\u0561\u057D\u0561\u0576\u0565\u056C\u056B:' 
                : 'К сожалению, услуги не настроены.';
              await sendTelegramMessage(doctor.telegramBotToken, chatId, noServicesText);
            } else {
              const serviceOptions = activeServices.map(s => ({
                id: s.id,
                name: lang === 'ARM' ? s.nameArm : s.nameRu,
                duration: s.defaultDurationMinutes
              }));
              
              const keyboard = generateServiceKeyboard(serviceOptions, lang);
              const servicePromptText = lang === 'ARM' 
                ? `\u0538\u0576\u057F\u0580\u0565\u0584 \u056E\u0561\u057C\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0568 (${selectedDate} ${selectedTime}):`
                : `Выберите услугу (${selectedDate} ${selectedTime}):`;
              await sendTelegramMessage(doctor.telegramBotToken, chatId, servicePromptText, keyboard);
            }
          }
        }
        
        else if (data === 'back_to_time') {
          const currentSession = await storage.getTelegramSession(telegramUserId);
          if (currentSession?.selectedDate) {
            const appointments = await storage.getAppointments(doctor.id);
            const bookedTimes: string[] = [];
            for (const apt of appointments) {
              if (apt.status !== 'CANCELLED_BY_DOCTOR' && apt.status !== 'REJECTED') {
                const aptDate = apt.startDateTime.toISOString().split('T')[0];
                if (aptDate === currentSession.selectedDate) {
                  const timeStr = apt.startDateTime.toTimeString().substring(0, 5);
                  bookedTimes.push(timeStr);
                }
              }
            }
            
            const workStart = doctor.workDayStartTime || '09:00';
            const workEnd = doctor.workDayEndTime || '18:00';
            const slotStep = doctor.slotStepMinutes || 15;
            
            const timeSlots = generateAvailableTimeSlots(workStart, workEnd, slotStep, bookedTimes);
            const keyboard = generateTimeSlotKeyboard(timeSlots, currentSession.selectedDate, lang);
            const timePromptText = lang === 'ARM' 
              ? `\u0538\u0576\u057F\u0580\u0565\u0584 \u056A\u0561\u0574\u0568 (${currentSession.selectedDate}):`
              : `\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0440\u0435\u043C\u044F (${currentSession.selectedDate}):`;
            await sendTelegramMessage(doctor.telegramBotToken, chatId, timePromptText, keyboard);
          }
        }
        
        else if (data?.startsWith('select_service_')) {
          const serviceId = data.replace('select_service_', '');
          const service = await storage.getService(serviceId);
          
          if (service) {
            await storage.upsertTelegramSession(telegramUserId, { 
              serviceId,
              durationMinutes: service.defaultDurationMinutes,
              step: 'awaiting_name' 
            });
            
            const namePromptText = lang === 'ARM' 
              ? '\u0544\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0565\u0584 \u0541\u0565\u0580 \u0561\u0576\u0578\u0582\u0576\u0568 \u0587 \u0561\u0566\u0563\u0561\u0576\u0578\u0582\u0576\u0568:'
              : '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0432\u0430\u0448\u0435 \u0438\u043C\u044F \u0438 \u0444\u0430\u043C\u0438\u043B\u0438\u044E:';
            await sendTelegramMessage(doctor.telegramBotToken, chatId, namePromptText);
          }
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
