import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";

export async function GET() {
  return json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = z
      .object({
        endpoint: z.string().url().max(1000),
        keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) }),
      })
      .parse(await request.json());
    await withUser(user.id, async (db) => {
      await db.query(
        `insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
         values ($1, $2, $3, $4, $5)
         on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh,
           auth = excluded.auth, user_agent = excluded.user_agent`,
        [user.id, body.endpoint, body.keys.p256dh, body.keys.auth, request.headers.get("user-agent")],
      );
    });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = z.object({ endpoint: z.string().url().max(1000) }).parse(await request.json());
    await withUser(user.id, async (db) => {
      await db.query(`delete from push_subscriptions where endpoint = $1 and user_id = $2`, [
        body.endpoint,
        user.id,
      ]);
    });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
