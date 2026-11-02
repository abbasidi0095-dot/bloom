import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const familyId = new URL(request.url).searchParams.get("familyId");
    if (!familyId) throw new ApiError("Family is required.", 400, "family_required");

    const data = await withUser(user.id, async (db) => {
      const family = await db.query<{ id: string; name: string; owner_id: string; role: string; created_at: string }>(
        `select f.id, f.name, f.owner_id, fm.role, f.created_at
           from families f
           join family_members fm on fm.family_id = f.id
          where f.id = $1 and fm.user_id = $2 and fm.status = 'active'`,
        [familyId, user.id],
      );
      const members = await db.query(
        `select fm.id, fm.role, fm.status, fm.joined_at, u.id as user_id, u.name, u.email, p.avatar_url
           from family_members fm
           join users u on u.id = fm.user_id
           left join profiles p on p.user_id = u.id
          where fm.family_id = $1 and fm.status = 'active'
          order by case fm.role when 'owner' then 0 when 'parent' then 1 when 'caregiver' then 2 else 3 end, fm.joined_at`,
        [familyId],
      );
      const invitations = await db.query(
        `select i.id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at, i.created_at,
                u.name as invited_by_name
           from family_invitations i
           join users u on u.id = i.invited_by
          where i.family_id = $1 and i.revoked_at is null and i.accepted_at is null
          order by i.created_at desc`,
        [familyId],
      );
      return {
        family: family.rows[0] ?? null,
        members: members.rows,
        invitations: invitations.rows,
      };
    });
    if (!data.family) throw new ApiError("Family not found.", 404, "not_found");
    return json(data);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = z
      .object({ familyId: z.string().uuid(), name: z.string().trim().min(1).max(80) })
      .parse(await request.json());
    await withUser(user.id, async (db) => {
      const result = await db.query(
        `update families set name = $1, updated_at = now() where id = $2 and owner_id = $3 returning id`,
        [body.name, body.familyId, user.id],
      );
      if (!result.rows[0]) throw new ApiError("Only the family owner can rename the family.", 403, "forbidden");
    });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
