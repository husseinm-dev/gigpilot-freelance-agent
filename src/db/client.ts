import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __gigpilotSql?: ReturnType<typeof postgres>;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. See SETUP.md.");
  }
  // Supabase pooled connections work best with prepare: false
  return postgres(url, { prepare: false, max: 5 });
}

export const sql = globalForDb.__gigpilotSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__gigpilotSql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
export { schema };
