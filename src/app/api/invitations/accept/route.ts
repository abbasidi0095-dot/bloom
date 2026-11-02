import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser, sha256 } from "@/lib/auth";
import { queryOne, withUser } from "@/lib/db";
import { setActiveFamilyCookies } from "@/lib/family";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in or create an account to accept this invitation.", 401, "unauthorized");
    const body = z
      .object({ token: z.string().min(6).max(500).optional(), code: z.string().min(4).max(20).optional() })
      .refine((data) => data.token || data.code, "An invitation token or code is required")
      .parse(await request.json());

    let familyId: string;
    if (body.token) {
      familyId = (
        await queryOne<{ accept_family_invitation: string }>(
          `select accept_family_invitation($1, $2, $3)`,
          [sha256(body.token), user.email, user.id],
        )
      )!.accept_family_invitation;
    } else {
      familyId = (
        await queryOne<{ accept_family_invitation_by_code: string }>(
          `select accept_family_invitation_by_code($1, $2, $3)`,
          [body.code!.trim().toUpperCase(), user.email, user.id],
        )
      )!.accept_family_invitation_by_code;
    }

    const baby = await withUser(user.id, async (db) => {
      const result = await db.query<{ id: string }>(
        `select id from babies where family_id = $1 and archived_at is null order by created_at asc limit 1`,
        [familyId],
      );
      return result.rows[0] ?? null;
    });
    await setActiveFamilyCookies(familyId, baby?.id);
    return json({ ok: true, familyId, babyId: baby?.id ?? null, next: "/dashboard" });
  } catch (error) {
    return fail(error);
  }
}
