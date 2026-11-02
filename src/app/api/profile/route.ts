import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { profileSchema } from "@/lib/schemas";
import { LOCALE_COOKIE } from "@/i18n/config";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = profileSchema.parse(await request.json());

    await withUser(user.id, async (db) => {
      if (body.name) {
        await db.query(`update users set name = $1, updated_at = now() where id = $2`, [body.name, user.id]);
      }
      const columns: string[] = [];
      const values: unknown[] = [];
      const map: Record<string, string> = {
        locale: "locale",
        timezone: "timezone",
        units: "units",
        dateFormat: "date_format",
        timeFormat: "time_format",
        theme: "theme",
        quietStart: "quiet_start",
        quietEnd: "quiet_end",
        pushEnabled: "push_enabled",
        emailReminders: "email_reminders",
        avatarUrl: "avatar_url",
      };
      for (const [key, column] of Object.entries(map)) {
        const value = body[key as keyof typeof body];
        if (value !== undefined) {
          columns.push(`${column} = $${values.length + 1}`);
          values.push(value === "" ? null : value);
        }
      }
      if (columns.length) {
        values.push(user.id);
        await db.query(
          `update profiles set ${columns.join(", ")}, updated_at = now() where user_id = $${values.length}`,
          values,
        );
      }
    });

    if (body.locale) {
      const store = await cookies();
      store.set(LOCALE_COOKIE, body.locale, {
        path: "/",
        maxAge: 365 * 86_400,
        sameSite: "lax",
      });
    }
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
    const body = z.object({ confirm: z.literal("DELETE") }).parse(await request.json());
    void body;
    await withUser(user.id, async (db) => {
      const owned = await db.query<{ id: string }>(`select id from families where owner_id = $1`, [user.id]);
      if (owned.rows.length) {
        const others = await db.query<{ count: string }>(
          `select count(*)::text as count from family_members
            where family_id = any($1::uuid[]) and user_id <> $2 and status = 'active'`,
          [owned.rows.map((row) => row.id), user.id],
        );
        if (Number(others.rows[0]?.count ?? 0) > 0) {
          throw new ApiError(
            "Transfer or remove the other members of your family before deleting your account.",
            409,
            "owned_family_has_members",
          );
        }
      }
      await db.query(`delete from families where owner_id = $1`, [user.id]);
      await db.query(
        `update users set deleted_at = now(), email = concat('deleted+', id, '@bloom.local'), name = 'Deleted account',
                password_hash = 'deleted' where id = $1`,
        [user.id],
      );
      await db.query(`delete from sessions where user_id = $1`, [user.id]);
    });
    const store = await cookies();
    store.delete("bloom_session");
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
