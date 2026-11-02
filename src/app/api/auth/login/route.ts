import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { clientMeta, createSession, rateLimit, verifyPassword } from "@/lib/auth";
import { cookies } from "next/headers";
import { queryOne, withUser } from "@/lib/db";
import { loginSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const meta = clientMeta(request);
    const body = loginSchema.parse(await request.json());
    const key = `login:${meta.ip}:${body.email}`;
    if (!rateLimit(key, 12, 10 * 60_000)) {
      throw new ApiError("Too many attempts. Please wait a moment.", 429, "rate_limited");
    }
    const user = await queryOne<{
      id: string;
      email: string;
      password_hash: string;
      deleted_at: string | null;
      email_verified_at: string | null;
    }>(
      `select id, email, password_hash, deleted_at, email_verified_at
         from users where lower(email) = lower($1)`,
      [body.email],
    );
    if (!user || user.deleted_at || !verifyPassword(body.password, user.password_hash)) {
      throw new ApiError("Email or password is incorrect.", 401, "invalid_credentials");
    }
    await createSession(user.id, meta);
    const session = await withUser(user.id, async (db) => {
      const rows = await db.query<{ family_id: string }>(
        `select family_id from family_members where user_id = $1 and status = 'active' limit 1`,
        [user.id],
      );
      const profile = await db.query<{ locale: string; theme: string }>(
        `select locale, theme from profiles where user_id = $1`,
        [user.id],
      );
      return { membership: rows.rows[0] ?? null, profile: profile.rows[0] ?? null };
    });
    if (session.profile) {
      const store = await cookies();
      store.set("bloom_locale", session.profile.locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
      store.set("bloom_theme", session.profile.theme, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
    }
    const membership = session.membership;
    return json({
      ok: true,
      next: membership ? "/dashboard" : "/onboarding",
      emailVerified: Boolean(user.email_verified_at),
    });
  } catch (error) {
    return fail(error);
  }
}
