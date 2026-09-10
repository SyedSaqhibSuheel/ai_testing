import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { loadConfig } from "../../src/config.js";
import { createDb } from "./client.js";

const config = loadConfig();
const db = createDb(config.dbPath);
const migrationsFolder = path.join(config.rootDir, "server", "db", "migrations");

migrate(db, { migrationsFolder });
console.log(`Migrations applied. DB at ${config.dbPath}`);
