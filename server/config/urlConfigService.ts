/**
 * URL Configuration Service
 * Manages environment profiles and URL resolution with database persistence
 */

import { URLManager, type EnvironmentProfile, type URLConfig, resolveUrl } from "./urlManager.js";
import { getSetting, setSetting } from "../settings/settingsService.js";

export interface URLConfigServiceOptions {
  defaultAppBaseUrl: string;
  defaultApiBaseUrl: string;
}

export interface ActiveURLConfig {
  activeProfileId: string;
  appBaseUrl: string;
  apiBaseUrl: string;
  allProfiles: EnvironmentProfile[];
}

/**
 * Service for managing URL configurations with database persistence
 */
export class URLConfigService {
  private manager: URLManager;
  private db: any;

  constructor(db: any, options: URLConfigServiceOptions) {
    this.db = db;
    this.manager = new URLManager(
      options.defaultAppBaseUrl,
      options.defaultApiBaseUrl
    );
    this.initializeDefaultProfiles();
    void this.loadPersisted();
  }

  /**
   * Profiles added/switched from the Settings UI must survive a server
   * restart, otherwise "active" silently reverts to the .env default on
   * every deploy/restart - restore whatever was last saved to the settings
   * table, if anything. Fire-and-forget from the constructor (which can't be
   * async): this only affects the brief window right after startup, before
   * any request has had a chance to read the active config.
   */
  private async loadPersisted(): Promise<void> {
    const persisted = await getSetting<URLConfig | undefined>(this.db, "urlConfig", undefined);
    if (persisted && persisted.profiles.some((p) => p.id === persisted.activeProfileId)) {
      this.manager.setConfig(persisted);
    }
  }

  // Fire-and-forget: this.manager (in-memory) is already updated synchronously
  // by every caller before this runs, so readers never wait on the DB write -
  // it only exists so the change survives a restart.
  private persist(): void {
    void setSetting(this.db, "urlConfig", this.manager.getConfig());
  }

  /**
   * Initialize default profiles from environment config
   */
  private initializeDefaultProfiles(): void {
    const defaultProfile = this.manager.getActiveProfile();

    // Initialize only with the environment config (no hardcoded profiles)
    const defaultProfile_entry: EnvironmentProfile = {
      id: "default",
      name: "Default",
      appBaseUrl: defaultProfile.appBaseUrl,
      apiBaseUrl: defaultProfile.apiBaseUrl,
      isDefault: true,
      description: "Default environment from configuration",
    };

    if (!this.manager.getProfile("default")) {
      this.manager.setProfile(defaultProfile_entry);
    }
  }

  /**
   * Get the currently active URL configuration
   */
  getActiveConfig(): ActiveURLConfig {
    const active = this.manager.getActiveProfile();
    return {
      activeProfileId: active.id,
      appBaseUrl: active.appBaseUrl,
      apiBaseUrl: active.apiBaseUrl,
      allProfiles: this.manager.getAllProfiles(),
    };
  }

  /**
   * Get all URL profiles
   */
  getAllProfiles(): EnvironmentProfile[] {
    return this.manager.getAllProfiles();
  }

  /**
   * Get a specific profile
   */
  getProfile(profileId: string): EnvironmentProfile | undefined {
    return this.manager.getProfile(profileId);
  }

  /**
   * Create or update a URL profile
   */
  setProfile(profile: EnvironmentProfile): EnvironmentProfile {
    // Validate URLs
    this.validateUrl(profile.appBaseUrl, "appBaseUrl");
    this.validateUrl(profile.apiBaseUrl, "apiBaseUrl");

    this.manager.setProfile(profile);
    this.persist();
    return profile;
  }

  /**
   * Switch the active environment profile
   */
  switchToProfile(profileId: string): ActiveURLConfig {
    const profile = this.manager.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile "${profileId}" not found`);
    }

    this.manager.switchProfile(profileId);
    this.persist();
    return this.getActiveConfig();
  }

  /**
   * Delete a URL profile
   */
  deleteProfile(profileId: string): void {
    this.manager.deleteProfile(profileId);
    this.persist();
  }

  /**
   * Resolve a relative API endpoint to a full URL
   */
  resolveApiUrl(endpoint: string): string {
    const baseUrl = this.manager.getActiveApiBaseUrl();
    return resolveUrl(baseUrl, endpoint);
  }

  /**
   * Resolve a relative app endpoint to a full URL
   */
  resolveAppUrl(endpoint: string): string {
    const baseUrl = this.manager.getActiveAppBaseUrl();
    return resolveUrl(baseUrl, endpoint);
  }

  /**
   * Test connectivity to the active API base URL
   */
  async testApiConnectivity(): Promise<{ reachable: boolean; statusCode?: number; error?: string }> {
    const baseUrl = this.manager.getActiveApiBaseUrl();
    try {
      const response = await fetch(baseUrl, { method: "HEAD" });
      return {
        reachable: true,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        reachable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Test connectivity to the active app base URL
   */
  async testAppConnectivity(): Promise<{ reachable: boolean; statusCode?: number; error?: string }> {
    const baseUrl = this.manager.getActiveAppBaseUrl();
    try {
      const response = await fetch(baseUrl, { method: "HEAD" });
      return {
        reachable: true,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        reachable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate a URL
   */
  private validateUrl(url: string, fieldName: string): void {
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL for ${fieldName}: ${url}`);
    }
  }
}
