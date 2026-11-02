import { assertSameOrigin, fail, json } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroySession();
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
