import { Pool, type PoolClient, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForDb = globalThis as unknown as { __bloomPool?: Pool };

export const pool =
  globalForDb.__bloomPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "bloom-web",
  });

if (process.env.NODE_ENV !== "production") globalForDb.__bloomPool = pool;

export type Db = Pick<PoolClient, "query">;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run a unit of work with the authenticated user bound to the Postgres session.
 * RLS policies on every family table resolve `app.user_id`; without it nothing
 * family-scoped is visible or writable.
 */
export async function withUser<T>(
  userId: string,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.user_id', $1, true)", [userId]);
    await client.query("set local statement_timeout = '20s'");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // connection may already be gone
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Admin connection used only by migrations and the reminder worker. */
export function adminPool() {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) throw new Error("DATABASE_ADMIN_URL is not set");
  return new Pool({ connectionString: adminUrl, max: 2, application_name: "bloom-admin" });
}
