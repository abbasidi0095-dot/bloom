import { ApiError, fail, json, parseLimit } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { assertBabyAccess } from "@/lib/family";
import { getTimeline } from "@/lib/timeline";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const url = new URL(request.url);
    const babyId = url.searchParams.get("babyId");
    if (!babyId) throw new ApiError("Baby is required.", 400, "baby_required");
    const access = await assertBabyAccess(user.id, babyId);
    if (!access) throw new ApiError("Baby not found.", 404, "not_found");

    const entries = await withUser(user.id, (db) =>
      getTimeline(db, {
        babyId,
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        entity: url.searchParams.get("entity") || "all",
        search: url.searchParams.get("search")?.trim() || "",
        limit: parseLimit(url.searchParams.get("limit"), 300, 1000),
        ascending: url.searchParams.get("order") !== "desc",
      }),
    );

    return json({ ok: true, entries });
  } catch (error) {
    return fail(error);
  }
}
