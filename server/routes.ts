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
  generateAvailableTimeSlots,
  setupWebhookForDoctor,
  generateMainMenuKeyboard,
  generatePricelistMessage,
  formatPrice
} from "./services/telegram";
import { 
  bulkBlockDaysSchema, 
  bulkCancelAppointmentsSchema, 
  createPatientApiSchema,
  insertBlockedSlotSchema
} from "../shared/schema";

const doctorUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  interfaceLanguage: z.enum(['ARM', 'RU']).optional(),
  workDays: z.array(z.string()).optional(),
  workDayStartTime: z.string().optional(),
  workDayEndTime: z.string().optional(),
  lunchStartTime: z.string().nullable().optional(),
  lunchEndTime: z.string().nullable().optional(),
  slotStepMinutes: z.number().min(5).max(120).optional(),
  telegramBotToken: z.string().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  telegramChatId: z.string().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  googleCalendarId: z.string().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  googleSheetId: z.string().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  aiEnabled: z.boolean().optional(),
  llmApiBaseUrl: z.string().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  llmApiKey: z.string().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  llmModelName: z.string().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  showPrices: z.boolean().optional(),
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
      
      // Auto-setup webhook when Telegram settings are updated
      if (updated?.telegramBotToken && (validatedData.telegramBotToken || validatedData.telegramChatId)) {
        await setupWebhookForDoctor(updated.telegramBotToken);
      }
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("[PATCH /api/doctor/:id] Validation error:", JSON.stringify(error.errors, null, 2));
        console.log("[PATCH /api/doctor/:id] Request body:", JSON.stringify(req.body, null, 2));
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

    const oldStatus = appointment.status;
    const newStatus = req.body.status;
    
    const updated = await storage.updateAppointment(id, req.body);
    
    // Send Telegram notification to patient when status changes
    if (newStatus && newStatus !== oldStatus && doctor.telegramBotToken) {
      try {
        const patient = await storage.getPatient(appointment.patientId);
        if (patient && patient.telegramUserId && !patient.telegramUserId.startsWith('-')) {
          const dateStr = new Date(appointment.startDateTime).toLocaleDateString('ru-RU');
          const timeStr = new Date(appointment.startDateTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          
          let message = '';
          if (newStatus === 'CONFIRMED') {
            message = `\u2705 \u0412\u0430\u0448\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430!\n\u0414\u0430\u0442\u0430: ${dateStr}\n\u0412\u0440\u0435\u043C\u044F: ${timeStr}`;
          } else if (newStatus === 'REJECTED') {
            const reason = req.body.rejectionReason ? `\n\u041F\u0440\u0438\u0447\u0438\u043D\u0430: ${req.body.rejectionReason}` : '';
            message = `\u274C \u0412\u0430\u0448\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430.${reason}\n\u0414\u0430\u0442\u0430: ${dateStr}\n\u0412\u0440\u0435\u043C\u044F: ${timeStr}`;
          } else if (newStatus === 'CANCELLED_BY_DOCTOR') {
            const reason = req.body.rejectionReason ? `\n\u041F\u0440\u0438\u0447\u0438\u043D\u0430: ${req.body.rejectionReason}` : '';
            message = `\u274C \u0412\u0430\u0448\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430 \u0432\u0440\u0430\u0447\u043E\u043C.${reason}\n\u0414\u0430\u0442\u0430: ${dateStr}\n\u0412\u0440\u0435\u043C\u044F: ${timeStr}`;
          }
          
          if (message) {
            console.log(`[API] Sending status notification to patient ${patient.telegramUserId}: ${newStatus}`);
            await sendTelegramMessage(doctor.telegramBotToken, patient.telegramUserId, message);
          }
        }
      } catch (notifyErr) {
        console.error('[API] Failed to notify patient about status change:', notifyErr);
      }
    }
    
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

  app.delete("/api/blocked-days/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await storage.deleteBlockedDay(id);
    res.json({ success: true });
  });

  app.get("/api/blocked-slots", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const slots = await storage.getBlockedSlots(doctor.id, date);
    res.json(slots);
  });

  app.post("/api/blocked-slots", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    try {
      const blockedSlotSchema = z.object({
        blockedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
        durationMinutes: z.number().int().positive("Duration must be a positive number"),
        reason: z.string().max(200).optional().nullable()
      });

      const parsed = blockedSlotSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const slot = await storage.createBlockedSlot({
        doctorId: doctor.id,
        blockedDate: parsed.data.blockedDate,
        startTime: parsed.data.startTime,
        durationMinutes: parsed.data.durationMinutes,
        reason: parsed.data.reason || null
      });
      res.json(slot);
    } catch (error) {
      console.error('Error creating blocked slot:', error);
      res.status(500).json({ error: "Failed to create blocked slot" });
    }
  });

  app.delete("/api/blocked-slots/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await storage.deleteBlockedSlot(id);
    res.json({ success: true });
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
        const patientData = await storage.getPatient(apt.patientId);
        let serviceData = null;
        if (apt.serviceId) {
          serviceData = await storage.getService(apt.serviceId);
        }
        return {
          ...apt,
          patient: patientData ? {
            firstName: patientData.firstName,
            lastName: patientData.lastName,
            phoneNumber: patientData.phoneNumber
          } : null,
          service: serviceData ? {
            nameArm: serviceData.nameArm,
            nameRu: serviceData.nameRu
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
        const contact = message.contact;
        const telegramUserId = String(message.from?.id || chatId);

        console.log(`[Webhook] Incoming message from ${telegramUserId}: ${text ? `text: ${text}` : contact ? 'contact shared' : 'other'}`);
        if (!chatId) {
          console.log("[Webhook] No chat ID in message");
          return res.json({ ok: true });
        }

        // Handle /start command
        if (text === '/start') {
          await storage.deleteTelegramSession(String(chatId));
          await sendTelegramMessage(
            doctor.telegramBotToken,
            chatId,
            'Բարի գալուստ։ Ես Ձեր անձնական բժշկական օգնականն եմ։ 🤖\n\nԸնտրեք լեզուը / Выберите язык:',
            {
              inline_keyboard: [
                [{ text: 'Հայերեն', callback_data: 'lang_arm' }, { text: 'Русский', callback_data: 'lang_ru' }]
              ]
            }
          );
          return res.json({ ok: true });
        }
        
        // Get session for state machine
        const session = await storage.getTelegramSession(telegramUserId);
        const lang: 'ARM' | 'RU' = session?.language || 'RU';
        
        // Handle contact shared (phone number via button)
        if (contact) {
          console.log(`[Webhook] Contact shared: ${contact.phone_number}`);
          
          if (session?.step !== 'awaiting_phone') {
            // Unexpected contact - tell user to start booking flow
            const startMsg = lang === 'ARM'
              ? '\u0546\u0578\u0580\u056B\u0581 \u057D\u056F\u057D\u0565\u056C \u0570\u0561\u0574\u0561\u0580 \u0563\u0580\u0565\u0584 /start'
              : '\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 /start \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C';
            await sendTelegramMessage(doctor.telegramBotToken, chatId, startMsg, { remove_keyboard: true });
            return res.json({ ok: true });
          }
          
          const phoneNumber = contact.phone_number;
          
          if (!session.selectedDate || !session.selectedTime) {
            const restartText = lang === 'ARM' 
              ? '\u054D\u0565\u057D\u056B\u0561\u0576 \u0561\u057E\u0561\u0580\u057F\u057E\u0565\u056C \u0567. \u0546\u0578\u0580\u056B\u0581 \u057D\u056F\u057D\u0565\u056C \u0570\u0561\u0574\u0561\u0580 \u0563\u0580\u0565\u0584 /start'
              : '\u0421\u0435\u0441\u0441\u0438\u044F \u0438\u0441\u0442\u0435\u043A\u043B\u0430. \u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 /start \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C \u0437\u0430\u043D\u043E\u0432\u043E.';
            await sendTelegramMessage(doctor.telegramBotToken, chatId, restartText, { remove_keyboard: true });
            return res.json({ ok: true });
          }
          
          const firstName = session.firstName || '';
          const lastName = session.lastName || '';
          
          // Process booking with contact phone - jump to patient creation
          console.log(`[Webhook] Registering patient with contact phone: ${phoneNumber}`);
          let patient;
          try {
            patient = await storage.getPatientByTelegramUserId(telegramUserId);
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
          } catch (patErr: any) {
            console.error(`[Webhook] Patient registration failed:`, patErr.message);
            await sendTelegramMessage(doctor.telegramBotToken, chatId, 
              lang === 'ARM' ? '\u054D\u056D\u0561\u056C, \u0583\u0578\u0580\u0571\u0565\u0584 \u0576\u0578\u0580\u056B\u0581 /start' : '\u041E\u0448\u0438\u0431\u043A\u0430. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 /start',
              { remove_keyboard: true }
            );
            await storage.deleteTelegramSession(telegramUserId);
            return res.json({ ok: true });
          }
          
          // Create appointment
          const startDateTime = new Date(`${session.selectedDate}T${session.selectedTime}:00`);
          let finalServiceId = session.serviceId;
          if (finalServiceId) {
            const svc = await storage.getService(finalServiceId);
            if (!svc) finalServiceId = null;
          }
          
          let appointment;
          try {
            appointment = await storage.createAppointment({
              doctorId: doctor.id,
              patientId: patient.id,
              serviceId: finalServiceId,
              startDateTime,
              durationMinutes: session.durationMinutes || 30,
              status: 'PENDING'
            });
            console.log(`[Webhook] Appointment created: ${appointment.id}`);
          } catch (dbErr: any) {
            console.error(`[Webhook] Appointment creation failed:`, dbErr.message);
            await sendTelegramMessage(doctor.telegramBotToken, chatId,
              lang === 'ARM' ? '\u054D\u056D\u0561\u056C. \u0553\u0578\u0580\u0571\u0565\u0584 \u0576\u0578\u0580\u056B\u0581 /start' : '\u041E\u0448\u0438\u0431\u043A\u0430. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 /start',
              { remove_keyboard: true }
            );
            await storage.deleteTelegramSession(telegramUserId);
            return res.json({ ok: true });
          }
          
          const service = session.serviceId ? await storage.getService(session.serviceId) : null;
          const serviceName = service ? (lang === 'ARM' ? service.nameArm : service.nameRu) : '';
          
          await storage.deleteTelegramSession(telegramUserId);
          
          // Notify patient - request pending
          const pendingMsg = lang === 'ARM'
            ? `\u0541\u0565\u0580 \u0570\u0561\u0575\u0569\u0568 \u0578\u0582\u0572\u0561\u0580\u056F\u057E\u0565\u056C \u0567!\n${session.selectedDate} ${session.selectedTime}\n\u054D\u057A\u0561\u057D\u0565\u0584 \u0562\u0569\u0577\u056F\u056B \u0570\u0561\u057D\u057F\u0561\u057F\u0574\u0561\u0576\u0568.`
            : `\u0412\u0430\u0448\u0430 \u0437\u0430\u044F\u0432\u043A\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430!\n${session.selectedDate} ${session.selectedTime}\n\u041E\u0436\u0438\u0434\u0430\u0439\u0442\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u0432\u0440\u0430\u0447\u0430.`;
          await sendTelegramMessage(doctor.telegramBotToken, chatId, pendingMsg, { remove_keyboard: true });
          
          // Notify doctor with confirmation buttons
          const doctorChatId = doctor.telegramChatId || process.env.DOCTOR_CHAT_ID;
          if (doctorChatId) {
            const adminNotification = `🆕 Նոր գրանցում!\n\n👤 Հիվանդ՝ ${firstName} ${lastName}\n📞 Հեռախոս՝ ${phoneNumber}\n🗓 Օր՝ ${session.selectedDate}\n⏰ Ժամ՝ ${session.selectedTime}\n🏥 Ծառայություն՝ ${serviceName || 'Նշված չէ'}`;
            const confirmKeyboard = {
              inline_keyboard: [[
                { text: '✅ Հաստատել', callback_data: `confirm_booking_${appointment.id}` },
                { text: '❌ Մերժել', callback_data: `reject_booking_${appointment.id}` }
              ]]
            };
            try {
              await sendTelegramMessage(doctor.telegramBotToken, doctorChatId, adminNotification, confirmKeyboard);
              console.log(`[Webhook] Doctor notification sent`);
            } catch (notifyErr) {
              console.error('[Webhook] Failed to notify doctor:', notifyErr);
            }
          }
          return res.json({ ok: true });
        }
        
        // STRICT STATE MACHINE: Only allow text input when awaiting_name
        if (text && text !== '/start') {
          if (session?.step === 'awaiting_name') {
            // Valid text input for name
            const nameParts = text.trim().split(' ').filter((p: string) => p.length > 0);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            if (!firstName || firstName.length < 2) {
              const errorText = lang === 'ARM' 
                ? '✍️ Խնդրում ենք գրել Ձեր Անուն Ազգանունը՝'
                : 'Пожалуйста, введите ваше имя:';
              await sendTelegramMessage(doctor.telegramBotToken, chatId, errorText);
              return res.json({ ok: true });
            }
            
            await storage.upsertTelegramSession(telegramUserId, {
              firstName,
              lastName: lastName || undefined,
              step: 'awaiting_phone'
            });
            
            // Show contact request keyboard button
            const phonePromptText = lang === 'ARM' 
              ? 'Սեղմեք ներքևի կոճակը՝ Ձեր հեռախոսահամարը ուղարկելու համար 👇'
              : 'Нажмите кнопку ниже, чтобы поделиться номером:';
            const contactKeyboard = {
              keyboard: [[
                { text: lang === 'ARM' ? '📱 Ուղարկել իմ հեռախոսահամարը' : '📱 Отправить мой номер', request_contact: true }
              ]],
              resize_keyboard: true,
              one_time_keyboard: true
            };
            await sendTelegramMessage(doctor.telegramBotToken, chatId, phonePromptText, contactKeyboard);
            return res.json({ ok: true });
          }
          
          
          // Allow manual phone number entry in awaiting_phone state
          if (session?.step === 'awaiting_phone') {
            // Validate phone number with regex (accepts formats like 091234567, +374..., etc.)
            const phoneRegex = /^[\+]?[0-9]{8,15}$/;
            const cleanedPhone = text.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
            
            if (phoneRegex.test(cleanedPhone)) {
              // Valid phone number - proceed with booking
              const phoneNumber = cleanedPhone;
              console.log(`[Webhook] Manual phone number entered: ${phoneNumber}`);
              
              // Create patient
              const patient = await storage.createPatient({
                doctorId: doctor.id,
                firstName: session.firstName || '',
                lastName: session.lastName || null,
                phoneNumber,
                telegramUserId
              });
              
              // Create appointment
              const startDateTime = new Date(`${session.selectedDate}T${session.selectedTime}:00`);
              const serviceDuration = session.durationMinutes || doctor.slotStepMinutes || 15;
              
              const appointment = await storage.createAppointment({
                doctorId: doctor.id,
                patientId: patient.id,
                serviceId: session.serviceId || null,
                startDateTime,
                durationMinutes: serviceDuration,
                status: 'PENDING',
                source: 'TELEGRAM'
              });
              
              // Reset session
              await storage.upsertTelegramSession(telegramUserId, { step: 'complete' });
              
              // Send confirmation to patient
              const service = session.serviceId ? await storage.getService(session.serviceId) : null;
              const serviceName = service ? (lang === 'ARM' ? service.nameArm : service.nameRu) : '';
              
              const confirmText = lang === 'ARM'
                ? `✅ \u0541\u0565\u0580 \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574\u0568 \u0568\u0576\u0564\u0578\u0582\u0576\u057E\u0565\u0581!\n\n📅 ${session.selectedDate}\n⏰ ${session.selectedTime}\n🏥 ${serviceName}\n\n\u0534\u0578\u0582\u0584 \u057D\u057A\u0561\u057D\u0578\u0582\u0574 \u0565\u0576\u0584 \u0570\u0561\u057D\u057F\u0561\u057F\u0574\u0561\u0576\u0568:`
                : `✅ Ваша заявка принята!\n\n📅 ${session.selectedDate}\n⏰ ${session.selectedTime}\n🏥 ${serviceName}\n\nОжидайте подтверждения.`;
              await sendTelegramMessage(doctor.telegramBotToken, chatId, confirmText, { remove_keyboard: true });
              
              // Notify doctor
              const doctorChatId = doctor.telegramChatId;
              if (doctorChatId) {
                const firstName = session.firstName || '';
                const lastName = session.lastName || '';
                const adminNotification = `🆕 \u0546\u0578\u0580 \u0563\u0580\u0561\u0576\u0581\u0578\u0582\u0574!\n\n👤 \u0540\u056B\u057E\u0561\u0576\u0564\u055D ${firstName} ${lastName}\n📞 \u0540\u0565\u057C\u0561\u056D\u0578\u057D\u055D ${phoneNumber}\n🗓 \u0555\u0580\u055D ${session.selectedDate}\n⏰ \u053A\u0561\u0574\u055D ${session.selectedTime}\n🏥 \u053E\u0561\u057C\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u055D ${serviceName || '\u0546\u0577\u057E\u0561\u056E \u0579\u0567'}`;
                const confirmKeyboard = {
                  inline_keyboard: [[
                    { text: '✅ \u0540\u0561\u057D\u057F\u0561\u057F\u0565\u056C', callback_data: `confirm_booking_${appointment.id}` },
                    { text: '❌ \u0544\u0565\u057C\u056A\u0565\u056C', callback_data: `reject_booking_${appointment.id}` }
                  ]]
                };
                try {
                  await sendTelegramMessage(doctor.telegramBotToken, doctorChatId, adminNotification, confirmKeyboard);
                } catch (notifyErr) {
                  console.error('[Webhook] Failed to notify doctor:', notifyErr);
                }
              }
              return res.json({ ok: true });
            } else {
              // Invalid phone number - ask to try again
              const invalidPhoneText = lang === 'ARM'
                ? '❌ \u0531\u0576\u057E\u0561\u057E\u0565\u0580 \u0570\u0565\u057C\u0561\u056D\u0578\u057D\u0561\u0570\u0561\u0574\u0561\u0580: \u053D\u0576\u0564\u0580\u0578\u0582\u0574 \u0565\u0576\u0584 \u0576\u0578\u0580\u056B\u0581 \u0583\u0578\u0580\u0571\u0565\u0584 \u056F\u0561\u0574 \u0585\u0563\u057F\u0561\u0563\u0578\u0580\u056E\u0565\u0584 \u056F\u0578\u0573\u0561\u056F\u0568:'
                : '❌ Неверный формат номера. Введите номер (например: 091234567) или нажмите кнопку ниже:';
              await sendTelegramMessage(doctor.telegramBotToken, chatId, invalidPhoneText);
              return res.json({ ok: true });
            }
          }
          
          if (session?.step && ['awaiting_date', 'awaiting_time', 'awaiting_service'].includes(session.step)) {
            const useButtonText = lang === 'ARM'
              ? 'Խնդրում ենք օգտագործել ներքևի կոճակները 👇'
              : '👇 Пожалуйста, используйте кнопки ниже';
            await sendTelegramMessage(doctor.telegramBotToken, chatId, useButtonText);
            return res.json({ ok: true });
          }
          
          // No session or unknown state - prompt to start
          const startText = lang === 'ARM'
            ? '\u0546\u0578\u0580\u056B\u0581 \u057D\u056F\u057D\u0565\u056C \u0570\u0561\u0574\u0561\u0580 \u0563\u0580\u0565\u0584 /start'
            : '\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 /start \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C';
          await sendTelegramMessage(doctor.telegramBotToken, chatId, startText);
          return res.json({ ok: true });
        }
        
        // Fallback - no text, no contact, not /start
        return res.json({ ok: true });
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
        
        // Handle doctor confirmation/rejection of booking
        if (data?.startsWith('confirm_booking_')) {
          const appointmentId = data.replace('confirm_booking_', '');
          console.log(`[Webhook] Doctor confirming appointment: ${appointmentId}`);
          
          try {
            const apt = await storage.getAppointment(appointmentId);
            if (!apt) {
              console.error(`[Webhook] Appointment not found: ${appointmentId}`);
              return res.json({ ok: true });
            }
            
            if (apt.status !== 'PENDING') {
              await sendTelegramMessage(doctor.telegramBotToken, chatId, `\u26A0\uFE0F \u042D\u0442\u0430 \u0437\u0430\u044F\u0432\u043A\u0430 \u0443\u0436\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u0430 (\u0441\u0442\u0430\u0442\u0443\u0441: ${apt.status})`);
              return res.json({ ok: true });
            }
            
            // Update status to CONFIRMED
            await storage.updateAppointment(appointmentId, { status: 'CONFIRMED' });
            console.log(`[Webhook] Appointment ${appointmentId} confirmed`);
            
            // Now create Google Calendar event
            const patient = await storage.getPatient(apt.patientId);
            const service = apt.serviceId ? await storage.getService(apt.serviceId) : null;
            const serviceName = service?.nameRu || '';
            const patientName = patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : 'Patient';
            
            if (doctor.googleCalendarId && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
              try {
                console.log(`[Webhook] Creating Google Calendar event for confirmed appointment`);
                const eventTitle = `${patientName} - ${serviceName}`.trim();
                const endDateTime = new Date(apt.startDateTime.getTime() + (apt.durationMinutes || 30) * 60 * 1000);
                
                const eventResult = await createCalendarEvent(doctor.googleCalendarId, {
                  summary: eventTitle,
                  start: { dateTime: apt.startDateTime.toISOString(), timeZone: 'Asia/Yerevan' },
                  end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Yerevan' },
                  description: `\u0422\u0435\u043B: ${patient?.phoneNumber || 'N/A'}\nTelegram ID: ${patient?.telegramUserId || 'N/A'}`
                });
                
                if (eventResult?.id) {
                  await storage.updateAppointment(appointmentId, { googleCalendarEventId: eventResult.id });
                  console.log(`[Webhook] Google Calendar event created: ${eventResult.id}`);
                }
              } catch (calError) {
                console.error('[Webhook] Google Calendar sync error:', calError);
              }
            }
            
            // Notify patient that their booking is confirmed
            if (patient?.telegramUserId && !patient.telegramUserId.startsWith('-')) {
              const dateStr = apt.startDateTime.toLocaleDateString('ru-RU');
              const timeStr = apt.startDateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
              const patientLang = patient.language || 'RU';
              const patientMsg = patientLang === 'ARM'
                ? `✅ Բժիշկը հաստատեց Ձեր գրանցումը։\nՍպասում ենք Ձեզ՝ ${dateStr} - ${timeStr}`
                : `✅ Врач подтвердил вашу запись!\nДата: ${dateStr}\nВремя: ${timeStr}`;
              await sendTelegramMessage(doctor.telegramBotToken, patient.telegramUserId, patientMsg);
              console.log(`[Webhook] Patient notified about confirmation`);
            }
            
            // Notify doctor that confirmation was successful
            await sendTelegramMessage(doctor.telegramBotToken, chatId, '✅ Գրանցումը հաստատված է։ Հիվանդը տեղեկացված է։');
            
          } catch (err) {
            console.error('[Webhook] Error confirming appointment:', err);
            await sendTelegramMessage(doctor.telegramBotToken, chatId, `\u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0438 \u0437\u0430\u043F\u0438\u0441\u0438`);
          }
          return res.json({ ok: true });
        }
        
        if (data?.startsWith('reject_booking_')) {
          const appointmentId = data.replace('reject_booking_', '');
          console.log(`[Webhook] Doctor rejecting appointment: ${appointmentId}`);
          
          try {
            const apt = await storage.getAppointment(appointmentId);
            if (!apt) {
              console.error(`[Webhook] Appointment not found: ${appointmentId}`);
              return res.json({ ok: true });
            }
            
            if (apt.status !== 'PENDING') {
              await sendTelegramMessage(doctor.telegramBotToken, chatId, `\u26A0\uFE0F \u042D\u0442\u0430 \u0437\u0430\u044F\u0432\u043A\u0430 \u0443\u0436\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u0430 (\u0441\u0442\u0430\u0442\u0443\u0441: ${apt.status})`);
              return res.json({ ok: true });
            }
            
            // Update status to REJECTED
            await storage.updateAppointment(appointmentId, { status: 'REJECTED' });
            console.log(`[Webhook] Appointment ${appointmentId} rejected`);
            
            // Notify patient that their booking was rejected
            const patient = await storage.getPatient(apt.patientId);
            if (patient?.telegramUserId && !patient.telegramUserId.startsWith('-')) {
              const dateStr = apt.startDateTime.toLocaleDateString('ru-RU');
              const timeStr = apt.startDateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
              const patientMsg = `\u274C \u041A \u0441\u043E\u0436\u0430\u043B\u0435\u043D\u0438\u044E, \u0432\u0440\u0430\u0447 \u043D\u0435 \u0441\u043C\u043E\u0433 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u0432\u0430\u0448\u0443 \u0437\u0430\u043F\u0438\u0441\u044C.\n\u0414\u0430\u0442\u0430: ${dateStr}\n\u0412\u0440\u0435\u043C\u044F: ${timeStr}\n\n\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0434\u0440\u0443\u0433\u043E\u0435 \u0432\u0440\u0435\u043C\u044F: /start`;
              await sendTelegramMessage(doctor.telegramBotToken, patient.telegramUserId, patientMsg);
              console.log(`[Webhook] Patient notified about rejection`);
            }
            
            // Notify doctor that rejection was successful
            await sendTelegramMessage(doctor.telegramBotToken, chatId, `\u274C \u0417\u0430\u044F\u0432\u043A\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430. \u041F\u0430\u0446\u0438\u0435\u043D\u0442 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D.`);
            
          } catch (err) {
            console.error('[Webhook] Error rejecting appointment:', err);
            await sendTelegramMessage(doctor.telegramBotToken, chatId, `\u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0438 \u0437\u0430\u044F\u0432\u043A\u0438`);
          }
          return res.json({ ok: true });
        }
        
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
          
          // Skip main menu, go directly to calendar
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
        
        else if (data === 'start_booking') {
          await storage.upsertTelegramSession(telegramUserId, { 
            step: 'awaiting_date' 
          });
          
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
        
        else if (data === 'show_pricelist') {
          const showPrices = doctor.showPrices ?? false;
          if (!showPrices) {
            await answerCallbackQuery(doctor.telegramBotToken, callbackId);
            return res.sendStatus(200);
          }
          
          const services = await storage.getServices(doctor.id);
          const activeServices = services.filter(s => s.isActive);
          
          const serviceOptions = activeServices.map(s => ({
            id: s.id,
            name: lang === 'ARM' ? s.nameArm : s.nameRu,
            duration: s.defaultDurationMinutes,
            priceMin: s.priceMin,
            priceMax: s.priceMax
          }));
          
          const pricelistMessage = generatePricelistMessage(serviceOptions, lang);
          
          const backToMenuText = lang === 'ARM' ? '<< \u0540\u0565\u057F' : '<< Назад';
          const backKeyboard = {
            inline_keyboard: [[{ text: backToMenuText, callback_data: 'back_to_menu' }]]
          };
          
          await sendTelegramMessage(doctor.telegramBotToken, chatId, pricelistMessage, backKeyboard);
        }
        
        else if (data === 'back_to_menu') {
          await storage.upsertTelegramSession(telegramUserId, { 
            step: 'main_menu'
          });
          
          const showPrices = doctor.showPrices ?? false;
          const mainMenuKeyboard = generateMainMenuKeyboard(lang, showPrices);
          
          const welcomeText = lang === 'ARM'
            ? '\u0538\u0576\u057F\u0580\u0565\u0584 \u0563\u0578\u0580\u056E\u0578\u0572\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0568:'
            : 'Выберите действие:';
          
          await sendTelegramMessage(doctor.telegramBotToken, chatId, welcomeText, mainMenuKeyboard);
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
              ? '📅 Ընտրեք այցելության օրը՝'
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
              ? '📅 Ընտրեք այցելության օրը՝'
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
          
          const blockedSlots = await storage.getBlockedSlots(doctor.id, selectedDate);
          const slotStep = doctor.slotStepMinutes || 15;
          const workStart = doctor.workDayStartTime || '09:00';
          const workEnd = doctor.workDayEndTime || '18:00';
          
          const [workStartH, workStartM] = workStart.split(':').map(Number);
          const [workEndH, workEndM] = workEnd.split(':').map(Number);
          let slotMinutes = workStartH * 60 + workStartM;
          const workEndMinutes = workEndH * 60 + workEndM;
          
          while (slotMinutes < workEndMinutes) {
            const slotEndMinutes = slotMinutes + slotStep;
            for (const slot of blockedSlots) {
              const [bh, bm] = slot.startTime.split(':').map(Number);
              const blockedStart = bh * 60 + bm;
              const blockedEnd = blockedStart + slot.durationMinutes;
              if (slotMinutes < blockedEnd && slotEndMinutes > blockedStart) {
                const h = Math.floor(slotMinutes / 60);
                const m = slotMinutes % 60;
                bookedTimes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                break;
              }
            }
            slotMinutes += slotStep;
          }
          
          const timeSlots = generateAvailableTimeSlots(workStart, workEnd, slotStep, bookedTimes, doctor.lunchStartTime, doctor.lunchEndTime);
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
            ? `⏰ Ընտրեք ժամը՝ (${selectedDate}):`
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
                duration: s.defaultDurationMinutes,
                priceMin: s.priceMin,
                priceMax: s.priceMax
              }));
              
              const showPrices = doctor.showPrices ?? false;
              const keyboard = generateServiceKeyboard(serviceOptions, lang, showPrices);
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
            
            const blockedSlots = await storage.getBlockedSlots(doctor.id, currentSession.selectedDate);
            const slotStep = doctor.slotStepMinutes || 15;
            const workStart = doctor.workDayStartTime || '09:00';
            const workEnd = doctor.workDayEndTime || '18:00';
            
            const [workStartH, workStartM] = workStart.split(':').map(Number);
            const [workEndH, workEndM] = workEnd.split(':').map(Number);
            let slotMinutes = workStartH * 60 + workStartM;
            const workEndMinutes = workEndH * 60 + workEndM;
            
            while (slotMinutes < workEndMinutes) {
              const slotEndMinutes = slotMinutes + slotStep;
              for (const slot of blockedSlots) {
                const [bh, bm] = slot.startTime.split(':').map(Number);
                const blockedStart = bh * 60 + bm;
                const blockedEnd = blockedStart + slot.durationMinutes;
                if (slotMinutes < blockedEnd && slotEndMinutes > blockedStart) {
                  const h = Math.floor(slotMinutes / 60);
                  const m = slotMinutes % 60;
                  bookedTimes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                  break;
                }
              }
              slotMinutes += slotStep;
            }
            
            const timeSlots = generateAvailableTimeSlots(workStart, workEnd, slotStep, bookedTimes, doctor.lunchStartTime, doctor.lunchEndTime);
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
            
            // Show price message first (if showPrices is enabled)
            const showPrices = doctor.showPrices ?? false;
            if (showPrices && (service.priceMin || service.priceMax)) {
              const serviceName = lang === 'ARM' ? service.nameArm : service.nameRu;
              const priceText = formatPrice(service.priceMin, service.priceMax, lang);
              const selectedText = lang === 'ARM'
                ? `\u0538\u0576\u057F\u0580\u057E\u0561\u056E: ${serviceName}. \u0533\u056B\u0576\u0568: ${priceText}`
                : `\u0412\u044B\u0431\u0440\u0430\u043D\u043E: ${serviceName}. \u0426\u0435\u043D\u0430: ${priceText}`;
              await sendTelegramMessage(doctor.telegramBotToken, chatId, selectedText);
            }
            
            // Then ask for name
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
