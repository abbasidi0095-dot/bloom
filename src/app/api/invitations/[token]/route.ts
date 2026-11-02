import { ApiError, fail, json } from "@/lib/api";
import { sha256 } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { rateLimit } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const ip = _request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(`invite-token:${ip}`, 30, 10 * 60_000)) {
      throw new ApiError("Too many attempts. Please wait a moment.", 429, "rate_limited");
    }
    const { token } = await context.params;
    const row = await queryOne<{
      family_name: string;
      invited_email: string;
      invited_role: string;
      expires_at: string;
    }>(`select * from preview_family_invitation($1)`, [sha256(token)]);
    if (!row) throw new ApiError("This invitation is invalid or has expired.", 410, "invalid_invitation");
    return json({ ok: true, invitation: row });
  } catch (error) {
    return fail(error);
  }
}
