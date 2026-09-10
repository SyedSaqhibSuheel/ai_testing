import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./server/db/migrations",
  schema: "./server/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/platform.db",
  },
});
