import { assertSameOrigin, fail, json } from "@/lib/api";
import { clientMeta, createEmailToken, rateLimit } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { mailerConfigured, sendResetEmail } from "@/lib/email";
import { forgotSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const meta = clientMeta(request);
    if (!rateLimit(`forgot:${meta.ip}`, 6, 15 * 60_000)) {
      return json({ ok: true });
    }
    const body = forgotSchema.parse(await request.json());
    const user = await queryOne<{ id: string; email: string }>(
      `select id, email from users where lower(email) = lower($1) and deleted_at is null`,
      [body.email],
    );
    let devLink: string | null = null;
    if (user) {
      const token = await createEmailToken(user.id, "reset", 1);
      const delivery = await sendResetEmail(user.email, token);
      if (!delivery.delivered && process.env.NODE_ENV !== "production") {
        devLink = `/reset-password?token=${encodeURIComponent(token)}`;
      }
    }
    return json({ ok: true, devLink, smtpConfigured: mailerConfigured() });
  } catch (error) {
    return fail(error);
  }
}
