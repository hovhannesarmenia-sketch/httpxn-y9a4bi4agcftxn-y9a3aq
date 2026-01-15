import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import bcrypt from "bcryptjs";

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
    res.json(doctor);
  });

  app.patch("/api/doctor/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor || doctor.id !== req.params.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const updated = await storage.updateDoctor(req.params.id, req.body);
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
    
    const service = await storage.getService(req.params.id);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor || service.doctorId !== doctor.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const updated = await storage.updateService(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/services/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const service = await storage.getService(req.params.id);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor || service.doctorId !== doctor.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await storage.deleteService(req.params.id);
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
    
    const patient = await storage.getPatient(req.params.id);
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
    
    const appointment = await storage.getAppointment(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor || appointment.doctorId !== doctor.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const updated = await storage.updateAppointment(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/appointments/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const appointment = await storage.getAppointment(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const doctor = await storage.getDoctorByUserId(req.session.userId);
    if (!doctor || appointment.doctorId !== doctor.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await storage.deleteAppointment(req.params.id);
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
    
    await storage.deleteBlockedDay(req.params.id);
    res.json({ success: true });
  });
}
