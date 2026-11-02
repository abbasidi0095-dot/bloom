import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { consumeEmailToken, hashPassword, revokeAllSessions } from "@/lib/auth";
import { query } from "@/lib/db";
import { resetSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = resetSchema.parse(await request.json());
    let userId: string;
    try {
      userId = await consumeEmailToken(body.token, "reset");
    } catch {
      throw new ApiError("This reset link is invalid or has expired.", 410, "invalid_token");
    }
    await query("update users set password_hash = $1, updated_at = now() where id = $2", [
      hashPassword(body.password),
      userId,
    ]);
    await revokeAllSessions(userId);
    return json({ ok: true, next: "/login" });
  } catch (error) {
    return fail(error);
  }
}
