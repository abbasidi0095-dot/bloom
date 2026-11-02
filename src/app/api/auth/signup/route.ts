import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import {
  clientMeta,
  createEmailToken,
  createSession,
  hashPassword,
  rateLimit,
} from "@/lib/auth";
import { query, queryOne, withUser } from "@/lib/db";
import { mailerConfigured, sendVerificationEmail } from "@/lib/email";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const meta = clientMeta(request);
    if (!rateLimit(`signup:${meta.ip}`, 10, 10 * 60_000)) {
      throw new ApiError("Too many attempts. Please wait a moment.", 429, "rate_limited");
    }
    const { signupSchema } = await import("@/lib/schemas");
    const body = signupSchema.parse(await request.json());
    const existing = await queryOne<{ id: string }>(
      "select id from users where lower(email) = lower($1) and deleted_at is null",
      [body.email],
    );
    if (existing) throw new ApiError("An account with this email already exists.", 409, "email_taken");

    const passwordHash = hashPassword(body.password);
    const user = await queryOne<{ id: string; email: string }>(
      `insert into users (email, name, password_hash) values ($1, $2, $3) returning id, email`,
      [body.email, body.name, passwordHash],
    );
    if (!user) throw new ApiError("Could not create your account.", 500);

    const locale = body.locale && isLocale(body.locale) ? body.locale : "en";
    await withUser(user.id, async (db) => {
      await db.query(
        `insert into profiles (user_id, locale, timezone) values ($1, $2, $3)`,
        [user.id, locale, body.timezone || "UTC"],
      );
    });

    const token = await createEmailToken(user.id, "verify", 24);
    const delivery = await sendVerificationEmail(user.email, token);
    await createSession(user.id, meta);
    if (locale) {
      const store = await cookies();
      store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
    }

    return json({
      ok: true,
      next: "/onboarding",
      verificationSent: delivery.delivered,
      devLink:
        !delivery.delivered && process.env.NODE_ENV !== "production"
          ? `/verify-email?token=${encodeURIComponent(token)}`
          : null,
      smtpConfigured: mailerConfigured(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) return fail(error);
    return fail(error);
  }
}
