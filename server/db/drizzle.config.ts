const config = {
  out: "./server/db/migrations",
  schema: "./server/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/platform.db",
  },
} as const;

export default config;
