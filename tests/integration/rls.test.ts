import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function loadEnv() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}
loadEnv();

const suffix = randomUUID().slice(0, 8);
const userA = randomUUID();
const userB = randomUUID();
const familyId = randomUUID();
const babyId = randomUUID();
const feedingId = randomUUID();
const ownDiaperId = randomUUID();
const worker = new pg.Client({ connectionString: process.env.WORKER_DATABASE_URL });
const app = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function asUser<T>(userId: string, fn: () => Promise<T>) {
  await app.query("begin");
  try {
    await app.query("select set_config('app.user_id', $1, true)", [userId]);
    const result = await fn();
    await app.query("commit");
    return result;
  } catch (error) {
    await app.query("rollback");
    throw error;
  }
}

beforeAll(async () => {
  if (!process.env.WORKER_DATABASE_URL || !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL and WORKER_DATABASE_URL are required for the RLS tests");
  }
  await worker.connect();
  await app.connect();
  await worker.query(
    `insert into users (id, email, name, password_hash) values
       ($1, $2, 'Owner A', 'x'), ($3, $4, 'Outsider B', 'x')`,
    [userA, `rls-a-${suffix}@bloom.test`, userB, `rls-b-${suffix}@bloom.test`],
  );
  await worker.query(`insert into families (id, name, owner_id) values ($1, 'RLS family', $2)`, [familyId, userA]);
  await worker.query(
    `insert into family_members (family_id, user_id, role) values ($1, $2, 'owner')`,
    [familyId, userA],
  );
  await worker.query(
    `insert into babies (id, family_id, first_name, date_of_birth, sex, created_by)
     values ($1, $2, 'RlsBaby', '2026-01-01', 'female', $3)`,
    [babyId, familyId, userA],
  );
  await worker.query(
    `insert into feeding_sessions (id, family_id, baby_id, type, started_at, recorded_by, amount_ml)
     values ($1, $2, $3, 'formula', now(), $4, 120)`,
    [feedingId, familyId, babyId, userA],
  );
});

afterAll(async () => {
  try {
    await worker.query(`delete from families where id = $1`, [familyId]);
    await worker.query(`delete from users where id = any($1::uuid[])`, [[userA, userB]]);
  } finally {
    await app.end();
    await worker.end();
  }
});

describe("PostgreSQL row level security", () => {
  it("shows a family baby to its owner", async () => {
    const rows = await asUser(userA, async () => {
      const result = await app.query("select id from babies where id = $1", [babyId]);
      return result.rows;
    });
    expect(rows).toHaveLength(1);
  });

  it("hides the baby from an unrelated account", async () => {
    const rows = await asUser(userB, async () => {
      const result = await app.query("select id from babies where id = $1", [babyId]);
      return result.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it("rejects an insert into another family", async () => {
    await expect(
      asUser(userB, async () => {
        await app.query(
          `insert into feeding_sessions (family_id, baby_id, type, started_at, recorded_by)
           values ($1, $2, 'breast', now(), $3)`,
          [familyId, babyId, userB],
        );
      }),
    ).rejects.toThrow(/row-level security/i);
  });

  it("does not let an outsider update or delete another family's record", async () => {
    const updated = await asUser(userB, async () => {
      const result = await app.query("update feeding_sessions set amount_ml = 999 where id = $1", [feedingId]);
      return result.rowCount;
    });
    expect(updated).toBe(0);
    const deleted = await asUser(userB, async () => {
      const result = await app.query("delete from feeding_sessions where id = $1", [feedingId]);
      return result.rowCount;
    });
    expect(deleted).toBe(0);
  });

  it("limits caregivers to their own entries", async () => {
    await worker.query(
      `insert into family_members (family_id, user_id, role) values ($1, $2, 'caregiver')`,
      [familyId, userB],
    );
    const ownInsert = await asUser(userB, async () => {
      const result = await app.query(
        `insert into diaper_entries (id, family_id, baby_id, occurred_at, kind, recorded_by)
         values ($1, $2, $3, now(), 'wet', $4) returning id`,
        [ownDiaperId, familyId, babyId, userB],
      );
      return result.rows[0];
    });
    expect(ownInsert.id).toBe(ownDiaperId);

    const otherUpdate = await asUser(userB, async () => {
      const result = await app.query("update feeding_sessions set notes = 'changed' where id = $1", [feedingId]);
      return result.rowCount;
    });
    expect(otherUpdate).toBe(0);

    const ownUpdate = await asUser(userB, async () => {
      const result = await app.query("update diaper_entries set notes = 'mine' where id = $1", [ownDiaperId]);
      return result.rowCount;
    });
    expect(ownUpdate).toBe(1);
  });

  it("makes viewers read-only", async () => {
    await worker.query(`update family_members set role = 'viewer' where family_id = $1 and user_id = $2`, [
      familyId,
      userB,
    ]);
    const visible = await asUser(userB, async () => {
      const result = await app.query("select id from babies where id = $1", [babyId]);
      return result.rows;
    });
    expect(visible).toHaveLength(1);
    await expect(
      asUser(userB, async () => {
        await app.query(
          `insert into diaper_entries (family_id, baby_id, occurred_at, kind, recorded_by)
           values ($1, $2, now(), 'dirty', $3)`,
          [familyId, babyId, userB],
        );
      }),
    ).rejects.toThrow(/row-level security/i);
  });

  it("does not expose family rows to an outsider", async () => {
    await worker.query(`update family_members set role = 'parent' where family_id = $1 and user_id = $2`, [
      familyId,
      userB,
    ]);
    const otherUser = randomUUID();
    await worker.query(
      `insert into users (id, email, name, password_hash) values ($1, $2, 'Outsider C', 'x')`,
      [otherUser, `rls-d-${suffix}@bloom.test`],
    );
    const rows = await asUser(otherUser, async () => {
      const result = await app.query("select id from families where id = $1", [familyId]);
      return result.rows;
    });
    expect(rows).toHaveLength(0);
    await worker.query("delete from users where id = $1", [otherUser]);
  });
});
