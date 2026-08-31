/**
 * Database schema for URL environment profiles
 * Stores different environment configurations (dev, staging, prod, etc.)
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * URL profiles table
 * Stores different API endpoint configurations
 */
export const urlProfiles = sqliteTable("url_profiles", {
  id: text("id").primaryKey(), // e.g., "dev", "staging", "production"
  name: text("name").notNull(), // Human-readable name
  appBaseUrl: text("app_base_url").notNull(), // URL to the app under test
  apiBaseUrl: text("api_base_url").notNull(), // URL to the API under test
  description: text("description"), // Optional description
  isDefault: integer("is_default", { mode: "boolean" }).default(false), // Mark as default profile
  isActive: integer("is_active", { mode: "boolean" }).default(false), // Currently active profile
  createdAt: text("created_at").default(new Date().toISOString()),
  updatedAt: text("updated_at").default(new Date().toISOString()),
});

export type URLProfile = typeof urlProfiles.$inferSelect;
export type URLProfileInsert = typeof urlProfiles.$inferInsert;

/**
 * URL resolution cache table (optional)
 * Caches resolved URLs for performance monitoring
 */
export const urlResolutionCache = sqliteTable("url_resolution_cache", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  endpoint: text("endpoint").notNull(),
  resolvedUrl: text("resolved_url").notNull(),
  hitCount: integer("hit_count").default(0),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").default(new Date().toISOString()),
});

export type URLResolutionCacheEntry = typeof urlResolutionCache.$inferSelect;

/**
 * Configuration migrations helper
 * Provides SQL to initialize the URL profiles table
 */
export const urlProfilesMigrations = {
  up: `
    CREATE TABLE IF NOT EXISTS url_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      app_base_url TEXT NOT NULL,
      api_base_url TEXT NOT NULL,
      description TEXT,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_url_profiles_active ON url_profiles(is_active);
    CREATE INDEX IF NOT EXISTS idx_url_profiles_default ON url_profiles(is_default);
  `,
  down: `
    DROP INDEX IF EXISTS idx_url_profiles_active;
    DROP INDEX IF EXISTS idx_url_profiles_default;
    DROP TABLE IF EXISTS url_profiles;
  `,
};
