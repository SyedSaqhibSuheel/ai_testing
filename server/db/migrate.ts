import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { loadConfig } from "../../src/config.js";
import { createDb } from "./client.js";

const config = loadConfig();
const db = createDb(config.databaseUrl);
const migrationsFolder = path.join(config.rootDir, "server", "db", "migrations");

await migrate(db, { migrationsFolder });
console.log(`Migrations applied. DB at ${config.databaseUrl}`);
process.exit(0);
