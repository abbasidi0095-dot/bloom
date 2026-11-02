#!/usr/bin/env node
/* Apply db/schema.sql with an administrative database connection. */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const file = path.join(process.cwd(), "db", "schema.sql");
const sql = fs.readFileSync(file, "utf8");
const url = process.env.DATABASE_ADMIN_URL;

if (!url) {
  console.error(
    "DATABASE_ADMIN_URL is required, for example:\n" +
      "  DATABASE_ADMIN_URL='postgres://postgres@/bloom?host=/var/run/postgresql' npm run db:migrate\n" +
      "On this VPS you can also run:\n" +
      "  sudo -u postgres psql -d bloom -v ON_ERROR_STOP=1 < db/schema.sql",
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  await client.query(sql);
  console.log("Schema applied successfully.");
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
