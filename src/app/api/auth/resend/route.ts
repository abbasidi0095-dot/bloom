import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { createEmailToken, getSessionUser, rateLimit } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    if (!rateLimit(`resend:${user.id}`, 4, 15 * 60_000)) {
      throw new ApiError("Please wait a moment before requesting another email.", 429, "rate_limited");
    }
    const token = await createEmailToken(user.id, "verify", 24);
    const delivery = await sendVerificationEmail(user.email, token);
    return json({
      ok: true,
      delivered: delivery.delivered,
      devLink:
        !delivery.delivered && process.env.NODE_ENV !== "production"
          ? `/verify-email?token=${encodeURIComponent(token)}`
          : null,
    });
  } catch (error) {
    return fail(error);
  }
}
