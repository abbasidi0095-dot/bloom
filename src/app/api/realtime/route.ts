import { ApiError, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { ensureRealtime, onFamilyEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const familyId = new URL(request.url).searchParams.get("familyId");
    if (!familyId) throw new ApiError("Family is required.", 400, "family_required");
    const member = await withUser(user.id, async (db) => {
      const rows = await db.query(
        `select role from family_members where family_id = $1 and user_id = $2 and status = 'active'`,
        [familyId, user.id],
      );
      return rows.rows[0] ?? null;
    });
    if (!member) throw new ApiError("You don't have access to this family.", 403, "forbidden");

    ensureRealtime();
    const encoder = new TextEncoder();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let unsubscribe: (() => void) | undefined;

    const stream = new ReadableStream({
      start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            // stream closed
          }
        };
        send("ready", { familyId, at: new Date().toISOString() });
        unsubscribe = onFamilyEvent((event) => {
          if (event.familyId === familyId) send("change", event);
        });
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
          } catch {
            // closed
          }
        }, 25_000);
        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          unsubscribe?.();
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
      },
      cancel() {
        clearInterval(heartbeat);
        unsubscribe?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
