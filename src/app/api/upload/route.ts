import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { assertBabyAccess, canWrite } from "@/lib/family";

const allowed = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const form = await request.formData();
    const file = form.get("file");
    const babyId = form.get("babyId");
    if (!(file instanceof File)) throw new ApiError("Choose an image to upload.", 400, "file_required");
    if (typeof babyId !== "string") throw new ApiError("Baby is required.", 400, "baby_required");
    const access = await assertBabyAccess(user.id, babyId);
    if (!access) throw new ApiError("Baby not found.", 404, "not_found");
    if (!canWrite(access.role)) throw new ApiError("You don't have permission to upload photos.", 403, "forbidden");
    const ext = allowed.get(file.type);
    if (!ext) throw new ApiError("Use a JPEG, PNG, WebP or GIF image.", 415, "unsupported_type");
    if (file.size > 8 * 1024 * 1024) throw new ApiError("Images must be smaller than 8 MB.", 413, "too_large");

    const id = randomUUID();
    const key = `${id}${ext}`;
    const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, key), Buffer.from(await file.arrayBuffer()));

    await withUser(user.id, async (db) => {
      await db.query(
        `insert into attachments (id, family_id, baby_id, uploaded_by, storage_key, file_name, mime_type, size_bytes)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, access.family_id, babyId, user.id, key, file.name.slice(0, 200), file.type, file.size],
      );
    });

    return json({ ok: true, id, url: `/api/files/${id}` }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
