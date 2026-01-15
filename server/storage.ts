import { db } from "./db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  users,
  doctor,
  services,
  patients,
  appointments,
  blockedDays,
  doctorCredentials,
  telegramSessions,
  reminderLogs,
  InsertUser,
  InsertDoctor,
  InsertService,
  InsertPatient,
  InsertAppointment,
  InsertBlockedDay,
  User,
  Doctor,
  Service,
  Patient,
  Appointment,
  BlockedDay,
} from "../shared/schema";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getDoctorByUserId(userId: string): Promise<Doctor | undefined>;
  getDoctor(id: string): Promise<Doctor | undefined>;
  getAllDoctors(): Promise<Doctor[]>;
  createDoctor(data: InsertDoctor): Promise<Doctor>;
  updateDoctor(id: string, data: Partial<InsertDoctor>): Promise<Doctor | undefined>;
  
  getServices(doctorId: string): Promise<Service[]>;
  getService(id: string): Promise<Service | undefined>;
  createService(data: InsertService): Promise<Service>;
  updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<boolean>;
  
  getPatients(doctorId: string): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | undefined>;
  createPatient(data: InsertPatient): Promise<Patient>;
  updatePatient(id: string, data: Partial<InsertPatient>): Promise<Patient | undefined>;
  
  getAppointments(doctorId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, data: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<boolean>;
  
  getBlockedDays(doctorId: string): Promise<BlockedDay[]>;
  createBlockedDay(data: InsertBlockedDay): Promise<BlockedDay>;
  deleteBlockedDay(id: string): Promise<boolean>;
  
  getTelegramSession(telegramUserId: string): Promise<TelegramSession | undefined>;
  upsertTelegramSession(telegramUserId: string, data: Partial<TelegramSessionData>): Promise<TelegramSession>;
  deleteTelegramSession(telegramUserId: string): Promise<boolean>;
  
  getPatientByTelegramUserId(telegramUserId: string): Promise<Patient | undefined>;
  
  hasReminderBeenSent(appointmentId: string, reminderType: 'BEFORE_24H' | 'BEFORE_2H'): Promise<boolean>;
  createReminderLog(appointmentId: string, reminderType: 'BEFORE_24H' | 'BEFORE_2H'): Promise<void>;
}

export type TelegramSession = typeof telegramSessions.$inferSelect;
export type TelegramSessionData = {
  step?: string;
  language?: 'ARM' | 'RU';
  patientId?: string;
  serviceId?: string;
  selectedDate?: string;
  selectedTime?: string;
  durationMinutes?: number;
  customReason?: string;
  firstName?: string;
  lastName?: string;
};

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db.insert(users).values({ ...insertUser, password: hashedPassword }).returning();
    return user;
  }

  async getDoctorByUserId(userId: string): Promise<Doctor | undefined> {
    const [doc] = await db.select().from(doctor).where(eq(doctor.userId, userId));
    return doc;
  }

  async getDoctor(id: string): Promise<Doctor | undefined> {
    const [doc] = await db.select().from(doctor).where(eq(doctor.id, id));
    return doc;
  }

  async getAllDoctors(): Promise<Doctor[]> {
    return db.select().from(doctor);
  }

  async createDoctor(data: InsertDoctor): Promise<Doctor> {
    const [doc] = await db.insert(doctor).values(data).returning();
    return doc;
  }

  async updateDoctor(id: string, data: Partial<InsertDoctor>): Promise<Doctor | undefined> {
    const [doc] = await db.update(doctor).set({ ...data, updatedAt: new Date() }).where(eq(doctor.id, id)).returning();
    return doc;
  }

  async getServices(doctorId: string): Promise<Service[]> {
    return db.select().from(services).where(eq(services.doctorId, doctorId)).orderBy(services.sortOrder);
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(data: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(data).returning();
    return service;
  }

  async updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined> {
    const [service] = await db.update(services).set({ ...data, updatedAt: new Date() }).where(eq(services.id, id)).returning();
    return service;
  }

  async deleteService(id: string): Promise<boolean> {
    const result = await db.delete(services).where(eq(services.id, id));
    return true;
  }

  async getPatients(doctorId: string): Promise<Patient[]> {
    const aptList = await db.select({ patientId: appointments.patientId })
      .from(appointments)
      .where(eq(appointments.doctorId, doctorId));
    const patientIds = [...new Set(aptList.map(a => a.patientId))];
    if (patientIds.length === 0) return [];
    
    const patientList: Patient[] = [];
    for (const pid of patientIds) {
      const [p] = await db.select().from(patients).where(eq(patients.id, pid));
      if (p) patientList.push(p);
    }
    return patientList;
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient;
  }

  async createPatient(data: InsertPatient): Promise<Patient> {
    const [patient] = await db.insert(patients).values(data).returning();
    return patient;
  }

  async updatePatient(id: string, data: Partial<InsertPatient>): Promise<Patient | undefined> {
    const [patient] = await db.update(patients).set({ ...data, updatedAt: new Date() }).where(eq(patients.id, id)).returning();
    return patient;
  }

  async getAppointments(doctorId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]> {
    if (startDate && endDate) {
      return db.select().from(appointments)
        .where(and(
          eq(appointments.doctorId, doctorId),
          gte(appointments.startDateTime, startDate),
          lte(appointments.startDateTime, endDate)
        ))
        .orderBy(desc(appointments.startDateTime));
    }
    return db.select().from(appointments)
      .where(eq(appointments.doctorId, doctorId))
      .orderBy(desc(appointments.startDateTime));
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    const [apt] = await db.select().from(appointments).where(eq(appointments.id, id));
    return apt;
  }

  async createAppointment(data: InsertAppointment): Promise<Appointment> {
    const [apt] = await db.insert(appointments).values(data).returning();
    return apt;
  }

  async updateAppointment(id: string, data: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const [apt] = await db.update(appointments).set({ ...data, updatedAt: new Date() }).where(eq(appointments.id, id)).returning();
    return apt;
  }

  async deleteAppointment(id: string): Promise<boolean> {
    await db.delete(appointments).where(eq(appointments.id, id));
    return true;
  }

  async getBlockedDays(doctorId: string): Promise<BlockedDay[]> {
    return db.select().from(blockedDays).where(eq(blockedDays.doctorId, doctorId));
  }

  async createBlockedDay(data: InsertBlockedDay): Promise<BlockedDay> {
    const [day] = await db.insert(blockedDays).values(data).returning();
    return day;
  }

  async deleteBlockedDay(id: string): Promise<boolean> {
    await db.delete(blockedDays).where(eq(blockedDays.id, id));
    return true;
  }

  async getTelegramSession(telegramUserId: string): Promise<TelegramSession | undefined> {
    const [session] = await db.select().from(telegramSessions).where(eq(telegramSessions.telegramUserId, telegramUserId));
    return session;
  }

  async upsertTelegramSession(telegramUserId: string, data: Partial<TelegramSessionData>): Promise<TelegramSession> {
    const existing = await this.getTelegramSession(telegramUserId);
    if (existing) {
      const [updated] = await db.update(telegramSessions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(telegramSessions.telegramUserId, telegramUserId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(telegramSessions)
      .values({ telegramUserId, ...data })
      .returning();
    return created;
  }

  async deleteTelegramSession(telegramUserId: string): Promise<boolean> {
    await db.delete(telegramSessions).where(eq(telegramSessions.telegramUserId, telegramUserId));
    return true;
  }

  async getPatientByTelegramUserId(telegramUserId: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.telegramUserId, telegramUserId));
    return patient;
  }

  async hasReminderBeenSent(appointmentId: string, reminderType: 'BEFORE_24H' | 'BEFORE_2H'): Promise<boolean> {
    const [existing] = await db.select()
      .from(reminderLogs)
      .where(and(
        eq(reminderLogs.appointmentId, appointmentId),
        eq(reminderLogs.reminderType, reminderType)
      ));
    return !!existing;
  }

  async createReminderLog(appointmentId: string, reminderType: 'BEFORE_24H' | 'BEFORE_2H'): Promise<void> {
    await db.insert(reminderLogs).values({ appointmentId, reminderType });
  }
}

export const storage = new DatabaseStorage();
