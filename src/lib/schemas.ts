import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(320)
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200, "That password is too long");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Your name is required").max(80),
  email: emailSchema,
  password: passwordSchema,
  timezone: z.string().trim().max(80).optional(),
  locale: z.enum(["en", "fr", "es", "ar"]).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z.object({
  token: z.string().min(10).max(500),
  password: passwordSchema,
});

export const babySchema = z.object({
  firstName: z.string().trim().min(1, "Baby's name is required").max(60),
  lastName: z.string().trim().max(60).nullish(),
  photoUrl: z.string().trim().max(600).nullish(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date"),
  birthTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullish(),
  sex: z.enum(["female", "male", "unspecified"]),
  birthWeightG: z.coerce.number().int().min(200).max(9000).nullish(),
  birthHeightCm: z.coerce.number().min(20).max(120).nullish(),
  headCircumferenceCm: z.coerce.number().min(15).max(80).nullish(),
  bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]).nullish(),
  pediatricianName: z.string().trim().max(160).nullish(),
  pediatricianPhone: z.string().trim().max(60).nullish(),
  allergies: z.string().trim().max(1000).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export const familySchema = z.object({
  name: z.string().trim().min(1, "Family name is required").max(80),
  baby: babySchema.optional(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  locale: z.enum(["en", "fr", "es", "ar"]).optional(),
  timezone: z.string().trim().max(80).optional(),
  units: z.enum(["metric", "imperial"]).optional(),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "D MMMM YYYY"]).optional(),
  timeFormat: z.enum(["12h", "24h"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  quietStart: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  quietEnd: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  pushEnabled: z.boolean().optional(),
  emailReminders: z.boolean().optional(),
  avatarUrl: z.string().trim().max(600).nullish(),
});

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["parent", "caregiver", "viewer"]),
});

export const reminderSchema = z.object({
  type: z.enum(["feeding", "diaper", "medication", "sleep", "pumping", "appointment", "custom"]),
  label: z.string().trim().min(1).max(120),
  scheduleKind: z.enum(["interval", "daily"]),
  intervalMinutes: z.coerce.number().int().min(5).max(10080).nullish(),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(4).optional(),
  days: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
  enabled: z.boolean().optional(),
  babyId: z.string().uuid().nullish(),
});

export const reportSchema = z.object({
  babyId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sections: z.array(z.string()).min(1),
  title: z.string().trim().max(120).optional(),
  note: z.string().trim().max(2000).optional(),
});

export const syncMutationSchema = z.object({
  entity: z.string().max(40),
  op: z.enum(["create", "update", "delete"]),
  id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()).optional(),
  baseVersion: z.coerce.number().int().min(0).optional(),
  clientUpdatedAt: z.string().optional(),
});
