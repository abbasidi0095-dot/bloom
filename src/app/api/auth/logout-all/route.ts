import { cookies } from "next/headers";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser, revokeAllSessions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    await revokeAllSessions(user.id);
    const store = await cookies();
    store.delete("bloom_session");
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
