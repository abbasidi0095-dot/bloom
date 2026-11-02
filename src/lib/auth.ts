import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { query, queryOne, withUser } from "./db";

export const SESSION_COOKIE = "bloom_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  email_verified_at: string | null;
  locale: string;
  timezone: string;
  units: "metric" | "imperial";
  date_format: string;
  time_format: "12h" | "24h";
  theme: "light" | "dark" | "system";
  onboarded_at: string | null;
  avatar_url: string | null;
  quiet_start: string | null;
  quiet_end: string | null;
  push_enabled: boolean;
  email_reminders: boolean;
};

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
) {
  const token = newToken();
  const tokenHash = sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await query(
    `insert into sessions (token_hash, user_id, expires_at, user_agent, ip)
     values ($1, $2, $3, $4, $5)`,
    [tokenHash, userId, expires, meta.userAgent?.slice(0, 400) ?? null, meta.ip ?? null],
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL || "").startsWith("https://"),
    path: "/",
    expires,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await query("delete from sessions where token_hash = $1", [sha256(token)]);
  }
  store.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string) {
  await query("delete from sessions where user_id = $1", [userId]);
}

export const getSessionUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await queryOne<{
    id: string;
    email: string;
    name: string;
    email_verified_at: string | null;
    created_at: string;
    session_expires: string;
  }>(
    `select u.id, u.email, u.name, u.email_verified_at, u.created_at,
            s.expires_at as session_expires
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.deleted_at is null`,
    [sha256(token)],
  );
  if (!row) return null;
  const profile = await withUser(row.id, async (db) => {
    const result = await db.query<{
      locale: string;
      timezone: string;
      units: "metric" | "imperial";
      date_format: string;
      time_format: "12h" | "24h";
      theme: "light" | "dark" | "system";
      onboarded_at: string | null;
      avatar_url: string | null;
      quiet_start: string | null;
      quiet_end: string | null;
      push_enabled: boolean;
      email_reminders: boolean;
    }>(
      `select locale, timezone, units, date_format, time_format, theme, onboarded_at, avatar_url,
              quiet_start, quiet_end, push_enabled, email_reminders
         from profiles where user_id = $1`,
      [row.id],
    );
    return result.rows[0] ?? null;
  });
  void query("update sessions set last_seen_at = now() where token_hash = $1", [sha256(token)]).catch(() => {});
  if (!profile) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    email_verified_at: row.email_verified_at,
    created_at: row.created_at,
    ...profile,
  } as AuthUser;
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOnboardedUser(): Promise<AuthUser> {
  const user = await requireUser();
  const membership = await queryOne<{ family_id: string }>(
    `select family_id from family_members
      where user_id = $1 and status = 'active' limit 1`,
    [user.id],
  );
  if (!membership) redirect("/onboarding");
  return user;
}

export async function createEmailToken(userId: string, kind: "verify" | "reset", hours: number) {
  const token = newToken();
  await query(
    `insert into email_tokens (user_id, kind, token_hash, expires_at)
     values ($1, $2, $3, $4)`,
    [userId, kind, sha256(token), new Date(Date.now() + hours * 3_600_000)],
  );
  return token;
}

export async function consumeEmailToken(token: string, kind: "verify" | "reset") {
  const row = await queryOne<{ id: string; user_id: string }>(
    `update email_tokens set used_at = now()
      where token_hash = $1 and kind = $2 and used_at is null and expires_at > now()
      returning id, user_id`,
    [sha256(token), kind],
  );
  if (!row) throw new Error("invalid_token");
  return row.user_id;
}

export function clientMeta(request: Request) {
  return {
    userAgent: request.headers.get("user-agent"),
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip"),
  };
}

// --- lightweight in-process rate limiting -----------------------------------
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  existing.count += 1;
  if (existing.count > limit) return false;
  return true;
}
