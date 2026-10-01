const config = {
  out: "./server/db/migrations",
  schema: "./server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://ai_testing:ai_testing_dev_password@localhost:5433/ai_testing",
  },
} as const;

export default config;
