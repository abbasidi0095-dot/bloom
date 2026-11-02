import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { consumeEmailToken } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { token } = z.object({ token: z.string().min(10).max(500) }).parse(await request.json());
    let userId: string;
    try {
      userId = await consumeEmailToken(token, "verify");
    } catch {
      throw new ApiError("This verification link is invalid or has expired.", 410, "invalid_token");
    }
    await query("update users set email_verified_at = now() where id = $1", [userId]);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
