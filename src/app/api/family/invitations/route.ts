import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser, newToken, sha256 } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { mailerConfigured, sendInvitationEmail } from "@/lib/email";
import { inviteSchema } from "@/lib/schemas";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function inviteCode() {
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = inviteSchema
      .extend({ familyId: z.string().uuid() })
      .parse(await request.json());

    const rawToken = newToken();
    const code = inviteCode();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);

    const invite = await withUser(user.id, async (db) => {
      const role = await db.query<{ role: string }>(
        `select role from family_members where family_id = $1 and user_id = $2 and status = 'active'`,
        [body.familyId, user.id],
      );
      if (!role.rows[0] || !["owner", "parent"].includes(role.rows[0].role)) {
        throw new ApiError("Only parents and owners can invite family members.", 403, "forbidden");
      }
      const family = await db.query<{ name: string }>(`select name from families where id = $1`, [body.familyId]);
      const inserted = await db.query(
        `insert into family_invitations (family_id, email, role, token_hash, code, invited_by, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id, email, role, code, expires_at`,
        [body.familyId, body.email, body.role, sha256(rawToken), code, user.id, expiresAt],
      );
      await db.query(
        `insert into audit_logs (family_id, actor_id, entity, entity_id, action, details)
         values ($1, $2, 'invitation', $3, 'invite', $4)`,
        [body.familyId, user.id, inserted.rows[0].id, JSON.stringify({ email: body.email, role: body.role })],
      );
      return { ...inserted.rows[0], familyName: family.rows[0]?.name ?? "Bloom" };
    });

    const link = `${process.env.APP_URL || "http://localhost:3001"}/invite/${encodeURIComponent(rawToken)}`;
    const delivery = await sendInvitationEmail({
      to: body.email,
      familyName: invite.familyName,
      inviterName: user.name,
      token: rawToken,
      code,
      role: body.role,
    });

    return json(
      {
        ok: true,
        invitation: invite,
        link,
        delivered: delivery.delivered,
        smtpConfigured: mailerConfigured(),
      },
      { status: 201 },
    );
  } catch (error) {
    return fail(error);
  }
}
