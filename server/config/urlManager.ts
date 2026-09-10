/**
 * URL Configuration Manager
 * Handles multiple environment profiles with runtime switching
 * Supports flexible URL resolution with fallback strategies
 */

export interface EnvironmentProfile {
  id: string;
  name: string;
  appBaseUrl: string;
  apiBaseUrl: string;
  isDefault?: boolean;
  description?: string;
}

export interface URLConfig {
  activeProfileId: string;
  profiles: EnvironmentProfile[];
}

export class URLManager {
  private config: URLConfig;

  constructor(
    defaultAppUrl: string,
    defaultApiUrl: string
  ) {
    const defaultProfile: EnvironmentProfile = {
      id: "default",
      name: "Default",
      appBaseUrl: defaultAppUrl,
      apiBaseUrl: defaultApiUrl,
      isDefault: true,
    };

    this.config = {
      activeProfileId: "default",
      profiles: [defaultProfile],
    };
  }

  /**
   * Get the currently active environment profile
   */
  getActiveProfile(): EnvironmentProfile {
    const profile = this.config.profiles.find(
      (p) => p.id === this.config.activeProfileId
    );
    if (!profile) {
      throw new Error(
        `Active profile "${this.config.activeProfileId}" not found`
      );
    }
    return profile;
  }

  /**
   * Get all environment profiles
   */
  getAllProfiles(): EnvironmentProfile[] {
    return this.config.profiles;
  }

  /**
   * Get a specific profile by ID
   */
  getProfile(profileId: string): EnvironmentProfile | undefined {
    return this.config.profiles.find((p) => p.id === profileId);
  }

  /**
   * Add or update an environment profile
   */
  setProfile(profile: EnvironmentProfile): void {
    const index = this.config.profiles.findIndex((p) => p.id === profile.id);
    if (index >= 0) {
      this.config.profiles[index] = profile;
    } else {
      this.config.profiles.push(profile);
    }
  }

  /**
   * Switch to a different environment profile
   */
  switchProfile(profileId: string): void {
    if (!this.config.profiles.find((p) => p.id === profileId)) {
      throw new Error(`Profile "${profileId}" not found`);
    }
    this.config.activeProfileId = profileId;
  }

  /**
   * Remove a profile (cannot remove active or default profile)
   */
  deleteProfile(profileId: string): void {
    if (profileId === this.config.activeProfileId) {
      throw new Error("Cannot delete the active profile");
    }
    if (this.config.profiles.some((p) => p.id === profileId && p.isDefault)) {
      throw new Error("Cannot delete the default profile");
    }
    this.config.profiles = this.config.profiles.filter((p) => p.id !== profileId);
  }

  /**
   * Get the active API base URL
   */
  getActiveApiBaseUrl(): string {
    return this.getActiveProfile().apiBaseUrl;
  }

  /**
   * Get the active app base URL
   */
  getActiveAppBaseUrl(): string {
    return this.getActiveProfile().appBaseUrl;
  }

  /**
   * Get the full URL configuration object
   */
  getConfig(): URLConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Update the entire configuration
   */
  setConfig(config: URLConfig): void {
    // Validate that active profile exists
    if (!config.profiles.find((p) => p.id === config.activeProfileId)) {
      throw new Error(
        `Active profile "${config.activeProfileId}" not found in profiles`
      );
    }
    this.config = JSON.parse(JSON.stringify(config));
  }
}

/**
 * Utility function to cleanly join a base URL with a relative endpoint
 * Handles trailing slashes and ensures proper URL formation
 *
 * Examples:
 *   resolveUrl("http://localhost:8084/fidar/sdk", "/users") -> "http://localhost:8084/fidar/sdk/users"
 *   resolveUrl("http://localhost:8084/fidar/sdk/", "users") -> "http://localhost:8084/fidar/sdk/users"
 *   resolveUrl("http://localhost:5000", "/api/v1/auth/login") -> "http://localhost:5000/api/v1/auth/login"
 */
export function resolveUrl(baseUrl: string, endpoint: string): string {
  // Remove trailing slash from base
  const base = baseUrl.replace(/\/$/, "");
  // Ensure endpoint starts with /
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

/**
 * Advanced URL resolver with query params and options
 */
export interface URLResolveOptions {
  baseUrl: string;
  endpoint: string;
  queryParams?: Record<string, string | number | boolean>;
  includeTrailingSlash?: boolean;
}

export function resolveUrlAdvanced(options: URLResolveOptions): string {
  const { baseUrl, endpoint, queryParams, includeTrailingSlash } = options;

  // Build the path
  let url = resolveUrl(baseUrl, endpoint);

  // Add trailing slash if requested
  if (includeTrailingSlash && !url.endsWith("/")) {
    url += "/";
  }

  // Add query parameters if provided
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      params.append(key, String(value));
    });
    url += `?${params.toString()}`;
  }

  return url;
}

/**
 * Parse a URL to extract base and path components
 */
export interface ParsedUrl {
  protocol: string;
  host: string;
  port?: string;
  basePath: string;
  pathname: string;
  query?: string;
}

export function parseUrl(urlString: string): ParsedUrl {
  try {
    const url = new URL(urlString);
    const basePath = url.pathname.split("/").slice(0, -1).join("/"); // Remove last segment

    return {
      protocol: url.protocol.replace(":", ""),
      host: url.hostname,
      port: url.port || undefined,
      basePath,
      pathname: url.pathname,
      query: url.search || undefined,
    };
  } catch (error) {
    throw new Error(`Invalid URL: ${urlString}`);
  }
}
