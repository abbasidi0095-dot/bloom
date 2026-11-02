import { cookies } from "next/headers";
import { withUser } from "./db";

export const FAMILY_COOKIE = "bloom_family";
export const BABY_COOKIE = "bloom_baby";

export type Role = "owner" | "parent" | "caregiver" | "viewer";

export type Baby = {
  id: string;
  family_id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  date_of_birth: string;
  birth_time: string | null;
  sex: "female" | "male" | "unspecified";
  birth_weight_g: number | null;
  birth_height_cm: string | null;
  head_circumference_cm: string | null;
  blood_type: string | null;
  pediatrician_name: string | null;
  pediatrician_phone: string | null;
  allergies: string | null;
  notes: string | null;
  created_at: string;
};

export type Family = {
  id: string;
  name: string;
  owner_id: string;
  role: Role;
  joined_at: string;
  babies: Baby[];
};

export type FamilyContext = {
  families: Family[];
  family: Family | null;
  baby: Baby | null;
  role: Role | null;
};

export function canWrite(role: Role | null | undefined) {
  return role === "owner" || role === "parent" || role === "caregiver";
}

export function canManage(role: Role | null | undefined) {
  return role === "owner" || role === "parent";
}

export function canAdminister(role: Role | null | undefined) {
  return role === "owner";
}

export async function listFamilies(userId: string): Promise<Family[]> {
  return withUser(userId, async (db) => {
    const families = await db.query<Omit<Family, "babies">>(
      `select f.id, f.name, f.owner_id, fm.role, fm.joined_at
         from family_members fm
         join families f on f.id = fm.family_id
        where fm.user_id = $1 and fm.status = 'active' and f.id in (select user_family_ids())
        order by fm.joined_at asc`,
      [userId],
    );
    const babies = await db.query<Baby>(
      `select id, family_id, first_name, last_name, photo_url, date_of_birth, birth_time, sex,
              birth_weight_g, birth_height_cm, head_circumference_cm, blood_type,
              pediatrician_name, pediatrician_phone, allergies, notes, created_at
         from babies
        where archived_at is null
        order by date_of_birth desc`,
    );
    return families.rows.map((family) => ({
      ...family,
      babies: babies.rows.filter((baby) => baby.family_id === family.id),
    }));
  });
}

export async function getFamilyContext(userId: string): Promise<FamilyContext> {
  const families = await listFamilies(userId);
  const store = await cookies();
  const familyId = store.get(FAMILY_COOKIE)?.value;
  const babyId = store.get(BABY_COOKIE)?.value;
  const family =
    families.find((item) => item.id === familyId) ?? families[0] ?? null;
  const baby =
    family?.babies.find((item) => item.id === babyId) ??
    family?.babies[0] ??
    null;
  return { families, family, baby, role: family?.role ?? null };
}

export async function requireFamilyContext(userId: string) {
  const context = await getFamilyContext(userId);
  if (!context.family) {
    const { redirect } = await import("next/navigation");
    redirect("/onboarding");
  }
  return context;
}

export async function assertBabyAccess(userId: string, babyId: string) {
  return withUser(userId, async (db) => {
    const rows = await db.query<{ id: string; family_id: string; role: Role }>(
      `select b.id, b.family_id, fm.role
         from babies b
         join family_members fm on fm.family_id = b.family_id
        where b.id = $1 and fm.user_id = $2 and fm.status = 'active' and b.archived_at is null`,
      [babyId, userId],
    );
    return rows.rows[0] ?? null;
  });
}

export async function assertFamilyAccess(userId: string, familyId: string) {
  return withUser(userId, async (db) => {
    const rows = await db.query<{ id: string; role: Role }>(
      `select f.id, fm.role
         from families f
         join family_members fm on fm.family_id = f.id
        where f.id = $1 and fm.user_id = $2 and fm.status = 'active'`,
      [familyId, userId],
    );
    return rows.rows[0] ?? null;
  });
}

export async function setActiveFamilyCookies(familyId?: string, babyId?: string) {
  const store = await cookies();
  const options = {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: (process.env.APP_URL || "").startsWith("https://"),
    path: "/",
    maxAge: 365 * 86_400,
  };
  if (familyId) store.set(FAMILY_COOKIE, familyId, options);
  if (babyId) store.set(BABY_COOKIE, babyId, options);
  if (familyId && !babyId) store.delete(BABY_COOKIE);
}
