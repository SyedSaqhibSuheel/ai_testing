import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(connectionString: string): Db {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}
