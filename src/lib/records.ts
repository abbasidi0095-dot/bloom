import { z } from "zod";
import type { Db } from "./db";

const iso = z
  .string()
  .min(4)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date")
  .transform((v) => new Date(v).toISOString());

const text = (max = 2000) => z.string().trim().max(max);
const optionalText = (max = 2000) => z.string().trim().max(max).nullish();
const amount = z.coerce.number().int().min(0).max(3000);
const nullableAmount = z.coerce.number().int().min(0).max(3000).nullish();
const nullableNumber = z.coerce.number().min(0).max(100000).nullish();

export type Field = { column: string; schema: z.ZodTypeAny };

export type EntityConfig = {
  table: string;
  timeColumn: string;
  defaultOrder: string;
  fields: Record<string, Field>;
  required: string[];
  label: string;
  supportsSync?: boolean;
};

export const records: Record<string, EntityConfig> = {
  feedings: {
    table: "feeding_sessions",
    timeColumn: "started_at",
    defaultOrder: "started_at desc",
    label: "Feeding",
    required: ["type", "startedAt"],
    fields: {
      type: { column: "type", schema: z.enum(["breast", "formula", "expressed", "solid"]) },
      startedAt: { column: "started_at", schema: iso },
      endedAt: { column: "ended_at", schema: iso.nullish() },
      leftSeconds: { column: "left_seconds", schema: z.coerce.number().int().min(0).max(86400).optional() },
      rightSeconds: { column: "right_seconds", schema: z.coerce.number().int().min(0).max(86400).optional() },
      lastSide: { column: "last_side", schema: z.enum(["left", "right", "both"]).nullish() },
      activeSide: { column: "active_side", schema: z.enum(["left", "right"]).nullish() },
      segments: {
        column: "segments",
        schema: z
          .array(
            z.object({
              side: z.enum(["left", "right"]),
              start: z.string(),
              end: z.string().nullish(),
            }),
          )
          .optional(),
      },
      formulaBrand: { column: "formula_brand", schema: optionalText(120) },
      amountMl: { column: "amount_ml", schema: nullableAmount },
      waterMl: { column: "water_ml", schema: nullableAmount },
      powderG: { column: "powder_g", schema: nullableNumber },
      bottleType: { column: "bottle_type", schema: optionalText(80) },
      storageLocation: { column: "storage_location", schema: optionalText(120) },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  diapers: {
    table: "diaper_entries",
    timeColumn: "occurred_at",
    defaultOrder: "occurred_at desc",
    label: "Diaper",
    required: ["kind", "occurredAt"],
    fields: {
      occurredAt: { column: "occurred_at", schema: iso },
      kind: { column: "kind", schema: z.enum(["wet", "dirty", "mixed", "dry"]) },
      urineAmount: { column: "urine_amount", schema: z.enum(["small", "medium", "large"]).nullish() },
      urineColor: { column: "urine_color", schema: optionalText(60) },
      stoolConsistency: {
        column: "stool_consistency",
        schema: z.enum(["watery", "soft", "normal", "hard", "mucus"]).nullish(),
      },
      stoolColor: {
        column: "stool_color",
        schema: z.enum(["yellow", "mustard", "brown", "green", "other"]).nullish(),
      },
      stoolAmount: { column: "stool_amount", schema: z.enum(["small", "medium", "large"]).nullish() },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  sleeps: {
    table: "sleep_sessions",
    timeColumn: "started_at",
    defaultOrder: "started_at desc",
    label: "Sleep",
    required: ["startedAt"],
    fields: {
      startedAt: { column: "started_at", schema: iso },
      endedAt: { column: "ended_at", schema: iso.nullish() },
      kind: { column: "kind", schema: z.enum(["nap", "night"]).optional() },
      quality: { column: "quality", schema: z.coerce.number().int().min(1).max(5).nullish() },
      interruptions: {
        column: "interruptions",
        schema: z
          .array(z.object({ start: z.string(), end: z.string().nullish(), note: z.string().max(300).optional() }))
          .optional(),
      },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  growth: {
    table: "growth_measurements",
    timeColumn: "measured_at",
    defaultOrder: "measured_at desc",
    label: "Growth",
    required: ["measuredAt"],
    fields: {
      measuredAt: { column: "measured_at", schema: iso },
      weightG: { column: "weight_g", schema: z.coerce.number().int().min(200).max(60000).nullish() },
      heightCm: { column: "height_cm", schema: z.coerce.number().min(20).max(200).nullish() },
      headCircumferenceCm: { column: "head_circumference_cm", schema: z.coerce.number().min(15).max(80).nullish() },
      source: { column: "source", schema: z.enum(["measured", "estimated"]).optional() },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  medications: {
    table: "medications",
    timeColumn: "created_at",
    defaultOrder: "created_at desc",
    label: "Medication",
    required: ["name"],
    fields: {
      name: { column: "name", schema: text(160) },
      dosage: { column: "dosage", schema: optionalText(160) },
      frequency: { column: "frequency", schema: optionalText(160) },
      startDate: { column: "start_date", schema: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish() },
      endDate: { column: "end_date", schema: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish() },
      active: { column: "active", schema: z.boolean().optional() },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  medicationLogs: {
    table: "medication_logs",
    timeColumn: "given_at",
    defaultOrder: "given_at desc",
    label: "Medication given",
    required: ["name", "givenAt"],
    fields: {
      medicationId: { column: "medication_id", schema: z.string().uuid().nullish() },
      name: { column: "name", schema: text(160) },
      dose: { column: "dose", schema: optionalText(160) },
      givenAt: { column: "given_at", schema: iso },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  temperatures: {
    table: "temperature_records",
    timeColumn: "measured_at",
    defaultOrder: "measured_at desc",
    label: "Temperature",
    required: ["measuredAt", "celsius"],
    fields: {
      measuredAt: { column: "measured_at", schema: iso },
      celsius: { column: "celsius", schema: z.coerce.number().min(30).max(45) },
      method: { column: "method", schema: z.enum(["axillary", "oral", "rectal", "ear", "forehead"]).nullish() },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  vaccinations: {
    table: "vaccinations",
    timeColumn: "scheduled_date",
    defaultOrder: "scheduled_date desc nulls last",
    label: "Vaccination",
    required: ["name"],
    fields: {
      name: { column: "name", schema: text(160) },
      scheduledDate: { column: "scheduled_date", schema: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish() },
      administeredDate: { column: "administered_date", schema: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish() },
      dose: { column: "dose", schema: optionalText(80) },
      provider: { column: "provider", schema: optionalText(160) },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  appointments: {
    table: "appointments",
    timeColumn: "scheduled_at",
    defaultOrder: "scheduled_at desc",
    label: "Appointment",
    required: ["title", "scheduledAt"],
    fields: {
      title: { column: "title", schema: text(160) },
      doctor: { column: "doctor", schema: optionalText(160) },
      location: { column: "location", schema: optionalText(200) },
      scheduledAt: { column: "scheduled_at", schema: iso },
      status: { column: "status", schema: z.enum(["scheduled", "completed", "cancelled"]).optional() },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  symptoms: {
    table: "symptoms",
    timeColumn: "occurred_at",
    defaultOrder: "occurred_at desc",
    label: "Symptom",
    required: ["description", "occurredAt"],
    fields: {
      occurredAt: { column: "occurred_at", schema: iso },
      description: { column: "description", schema: text(300) },
      severity: { column: "severity", schema: z.enum(["mild", "moderate", "severe"]).optional() },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  activities: {
    table: "activities",
    timeColumn: "started_at",
    defaultOrder: "started_at desc",
    label: "Activity",
    required: ["type", "startedAt"],
    fields: {
      type: {
        column: "type",
        schema: z.enum(["bath", "tummy", "play", "walk", "vitamin", "pumping", "solid", "custom"]),
      },
      label: { column: "label", schema: optionalText(160) },
      startedAt: { column: "started_at", schema: iso },
      endedAt: { column: "ended_at", schema: iso.nullish() },
      amountMl: { column: "amount_ml", schema: nullableAmount },
      notes: { column: "notes", schema: optionalText(2000) },
      metadata: { column: "metadata", schema: z.record(z.string(), z.unknown()).optional() },
    },
  },

  milestones: {
    table: "milestones",
    timeColumn: "achieved_at",
    defaultOrder: "achieved_at desc",
    label: "Milestone",
    required: ["title", "achievedAt"],
    fields: {
      title: { column: "title", schema: text(160) },
      achievedAt: { column: "achieved_at", schema: iso },
      photoUrl: { column: "photo_url", schema: optionalText(500) },
      notes: { column: "notes", schema: optionalText(2000) },
    },
  },

  notes: {
    table: "baby_notes",
    timeColumn: "created_at",
    defaultOrder: "created_at desc",
    label: "Note",
    required: ["body"],
    fields: {
      body: { column: "body", schema: text(4000) },
    },
  },
};

export type EntityName = keyof typeof records;

export function getEntity(name: string): EntityConfig {
  const config = records[name];
  if (!config) throw new Error("Unknown record type");
  return config;
}

export function validateBody(
  config: EntityConfig,
  body: Record<string, unknown>,
  mode: "create" | "update",
) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, field] of Object.entries(config.fields)) {
    shape[key] = mode === "create" ? field.schema : field.schema.optional();
  }
  const schema = z.object(shape).strict();
  const parsed = schema.parse(body) as Record<string, unknown>;
  if (mode === "create") {
    for (const key of config.required) {
      if (parsed[key] === undefined || parsed[key] === null || parsed[key] === "") {
        throw new z.ZodError([
          { code: "custom", message: `${key} is required`, path: [key], input: parsed[key] },
        ]);
      }
    }
  }
  return parsed;
}

export function toColumns(config: EntityConfig, data: Record<string, unknown>) {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    const field = config.fields[key];
    if (!field) continue;
    columns.push(field.column);
    const normalized =
      value !== null && typeof value === "object" && !(value instanceof Date)
        ? JSON.stringify(value)
        : (value ?? null);
    values.push(normalized);
  }
  return { columns, values };
}

export async function insertRecord(
  db: Db,
  entity: string,
  meta: { familyId: string; babyId: string; userId: string; id?: string },
  data: Record<string, unknown>,
) {
  const config = getEntity(entity);
  const { columns, values } = toColumns(config, data);
  const allColumns = ["family_id", "baby_id", "recorded_by", ...columns];
  const allValues = [meta.familyId, meta.babyId, meta.userId, ...values];
  if (meta.id) {
    allColumns.unshift("id");
    allValues.unshift(meta.id);
  }
  const placeholders = allColumns.map((_, i) => `$${i + 1}`);
  const rows = await db.query(
    `insert into ${config.table} (${allColumns.join(", ")})
     values (${placeholders.join(", ")})
     on conflict (id) do nothing
     returning *`,
    allValues,
  );
  if (rows.rows[0]) return rows.rows[0] as Record<string, unknown>;
  const existing = await db.query(`select * from ${config.table} where id = $1`, [meta.id]);
  return existing.rows[0] as Record<string, unknown>;
}

export async function updateRecord(
  db: Db,
  entity: string,
  id: string,
  data: Record<string, unknown>,
) {
  const config = getEntity(entity);
  const { columns, values } = toColumns(config, data);
  if (!columns.length) return null;
  const sets = columns.map((col, i) => `${col} = $${i + 1}`);
  values.push(id);
  const rows = await db.query(
    `update ${config.table}
        set ${sets.join(", ")}, updated_at = now(), version = version + 1
      where id = $${values.length} and deleted_at is null
      returning *`,
    values,
  );
  return (rows.rows[0] as Record<string, unknown>) ?? null;
}

export async function softDeleteRecord(db: Db, entity: string, id: string) {
  const config = getEntity(entity);
  const rows = await db.query(
    `update ${config.table}
        set deleted_at = now(), updated_at = now(), version = version + 1
      where id = $1 and deleted_at is null
      returning id`,
    [id],
  );
  return rows.rowCount === 1;
}
