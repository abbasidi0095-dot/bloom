import { ApiError, fail, json } from "@/lib/api";
import { queryOne } from "@/lib/db";
import { rateLimit } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(`invite-code:${ip}`, 20, 10 * 60_000)) {
      throw new ApiError("Too many attempts. Please wait a moment.", 429, "rate_limited");
    }
    const code = new URL(request.url).searchParams.get("code")?.trim();
    if (!code) throw new ApiError("Enter an invitation code.", 400, "code_required");
    const row = await queryOne<{
      family_name: string;
      invited_email: string;
      invited_role: string;
      expires_at: string;
    }>(`select * from preview_family_invitation_by_code($1)`, [code.toUpperCase()]);
    if (!row) throw new ApiError("This invitation is invalid or has expired.", 410, "invalid_invitation");
    return json({ ok: true, invitation: row });
  } catch (error) {
    return fail(error);
  }
}
