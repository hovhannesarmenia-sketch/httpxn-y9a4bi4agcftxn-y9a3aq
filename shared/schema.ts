import { pgTable, text, varchar, integer, boolean, timestamp, uuid, time, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const interfaceLanguageEnum = pgEnum("interface_language", ["ARM", "RU"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED_BY_DOCTOR"]);
export const reminderTypeEnum = pgEnum("reminder_type", ["BEFORE_24H", "BEFORE_2H"]);
export const dayOfWeekEnum = pgEnum("day_of_week", ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const doctor = pgTable("doctor", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  interfaceLanguage: interfaceLanguageEnum("interface_language").default("ARM"),
  workDays: text("work_days").array().default(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]),
  workDayStartTime: time("work_day_start_time").default("09:00"),
  workDayEndTime: time("work_day_end_time").default("18:00"),
  slotStepMinutes: integer("slot_step_minutes").default(15),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  googleCalendarId: text("google_calendar_id"),
  googleSheetId: text("google_sheet_id"),
  aiEnabled: boolean("ai_enabled").default(false),
  llmApiBaseUrl: text("llm_api_base_url"),
  llmApiKey: text("llm_api_key"),
  llmModelName: text("llm_model_name").default("deepseek-chat"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const doctorCredentials = pgTable("doctor_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id").references(() => doctor.id).notNull().unique(),
  llmApiKey: text("llm_api_key"),
  llmApiBaseUrl: text("llm_api_base_url"),
  telegramBotToken: text("telegram_bot_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id").references(() => doctor.id).notNull(),
  nameArm: varchar("name_arm", { length: 200 }).notNull(),
  nameRu: varchar("name_ru", { length: 200 }).notNull(),
  defaultDurationMinutes: integer("default_duration_minutes").default(30).notNull(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramUserId: varchar("telegram_user_id", { length: 50 }).unique().notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }),
  language: interfaceLanguageEnum("language").default("ARM"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id").references(() => doctor.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  serviceId: uuid("service_id").references(() => services.id),
  customReason: text("custom_reason"),
  startDateTime: timestamp("start_date_time").notNull(),
  durationMinutes: integer("duration_minutes").default(30).notNull(),
  status: appointmentStatusEnum("status").default("PENDING"),
  rejectionReason: text("rejection_reason"),
  googleCalendarEventId: text("google_calendar_event_id"),
  source: varchar("source", { length: 50 }).default("Telegram"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const blockedDays = pgTable("blocked_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id").references(() => doctor.id).notNull(),
  blockedDate: varchar("blocked_date", { length: 10 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reminderLogs = pgTable("reminder_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id").references(() => appointments.id).notNull(),
  reminderType: reminderTypeEnum("reminder_type").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const telegramSessions = pgTable("telegram_sessions", {
  telegramUserId: varchar("telegram_user_id", { length: 50 }).primaryKey(),
  step: text("step").default("awaiting_language").notNull(),
  language: interfaceLanguageEnum("language"),
  patientId: uuid("patient_id").references(() => patients.id),
  serviceId: uuid("service_id").references(() => services.id),
  selectedDate: text("selected_date"),
  selectedTime: text("selected_time"),
  durationMinutes: integer("duration_minutes"),
  customReason: text("custom_reason"),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDoctorSchema = createInsertSchema(doctor).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPatientSchema = createInsertSchema(patients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBlockedDaySchema = createInsertSchema(blockedDays).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type InsertBlockedDay = z.infer<typeof insertBlockedDaySchema>;

export type User = typeof users.$inferSelect;
export type Doctor = typeof doctor.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type BlockedDay = typeof blockedDays.$inferSelect;

export const bulkBlockDaysSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  reason: z.string().max(200).optional().nullable(),
});

export const bulkCancelAppointmentsSchema = z.object({
  appointmentIds: z.array(z.string().uuid()),
  reason: z.string().max(500).optional().nullable(),
});

export const createPatientApiSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().nullable(),
  phoneNumber: z.string().max(50).optional().nullable(),
  telegramUserId: z.union([z.string(), z.number()]),
  language: z.enum(["ARM", "RU"]).optional(),
});
