/**
 * URL Configuration API Routes
 * Manages environment profiles and URL resolution
 */

import { Router } from "express";
import type { Db } from "../db/client.js";
import { URLConfigService } from "../config/urlConfigService.js";
import type { Config } from "../../src/config.js";
import { testURLConnectivity, validateURL, getErrorMessage, getDiagnosticDetails } from "../utils/urlValidator.js";

export function createUrlConfigRouter(db: any, config: Config): Router {
  const router = Router();

  const urlConfigService = new URLConfigService(db, {
    defaultAppBaseUrl: config.appBaseUrl,
    defaultApiBaseUrl: config.apiBaseUrl,
  });

  /**
   * GET /api/url-config/active
   * Get the currently active URL configuration
   */
  router.get("/active", (_req, res) => {
    try {
      const config = urlConfigService.getActiveConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * GET /api/url-config/profiles
   * Get all URL profiles
   */
  router.get("/profiles", (_req, res) => {
    try {
      const profiles = urlConfigService.getAllProfiles();
      res.json({ profiles });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * GET /api/url-config/profiles/:profileId
   * Get a specific profile
   */
  router.get("/profiles/:profileId", (req, res) => {
    try {
      const profile = urlConfigService.getProfile(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * POST /api/url-config/profiles
   * Create or update a URL profile
   * Body: { id, name, appBaseUrl, apiBaseUrl, description?, isDefault? }
   */
  router.post("/profiles", (req, res) => {
    try {
      const { id, name, appBaseUrl, apiBaseUrl, description, isDefault } = req.body;

      // Validate required fields
      if (!id || !name || !appBaseUrl || !apiBaseUrl) {
        return res.status(400).json({
          error: "Missing required fields: id, name, appBaseUrl, apiBaseUrl",
        });
      }

      const profile = urlConfigService.setProfile({
        id,
        name,
        appBaseUrl,
        apiBaseUrl,
        description,
        isDefault,
      });

      res.status(201).json(profile);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * PUT /api/url-config/profiles/:profileId/switch
   * Switch to a different URL profile
   */
  router.put("/profiles/:profileId/switch", (req, res) => {
    try {
      const config = urlConfigService.switchToProfile(req.params.profileId);
      res.json(config);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * DELETE /api/url-config/profiles/:profileId
   * Delete a URL profile
   */
  router.delete("/profiles/:profileId", (req, res) => {
    try {
      urlConfigService.deleteProfile(req.params.profileId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * POST /api/url-config/resolve-api
   * Resolve a relative API endpoint to a full URL
   * Body: { endpoint }
   */
  router.post("/resolve-api", (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: "Missing endpoint" });
      }
      const resolvedUrl = urlConfigService.resolveApiUrl(endpoint);
      res.json({ endpoint, resolvedUrl });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * POST /api/url-config/resolve-app
   * Resolve a relative app endpoint to a full URL
   * Body: { endpoint }
   */
  router.post("/resolve-app", (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: "Missing endpoint" });
      }
      const resolvedUrl = urlConfigService.resolveAppUrl(endpoint);
      res.json({ endpoint, resolvedUrl });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * GET /api/url-config/test-connectivity
   * Test connectivity to active URLs (from current profile)
   */
  router.get("/test-connectivity", async (_req, res) => {
    try {
      const config = urlConfigService.getActiveConfig();

      const [apiDiagnostics, appDiagnostics] = await Promise.all([
        testURLConnectivity(config.apiBaseUrl),
        testURLConnectivity(config.appBaseUrl),
      ]);

      res.json({
        api: {
          ...apiDiagnostics,
          message: getErrorMessage(apiDiagnostics),
          diagnostics: getDiagnosticDetails(config.apiBaseUrl, apiDiagnostics),
        },
        app: {
          ...appDiagnostics,
          message: getErrorMessage(appDiagnostics),
          diagnostics: getDiagnosticDetails(config.appBaseUrl, appDiagnostics),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * POST /api/url-config/test-connection
   * Test connectivity to custom URLs (for form validation)
   * Body: { appUrl?: string, apiUrl?: string }
   */
  router.post("/test-connection", async (req, res) => {
    try {
      const { appUrl, apiUrl } = req.body;

      if (!appUrl && !apiUrl) {
        return res.status(400).json({
          error: "At least one URL (appUrl or apiUrl) must be provided",
        });
      }

      const results: Record<string, any> = {
        timestamp: new Date().toISOString(),
      };

      // Test App URL if provided
      if (appUrl) {
        const validation = validateURL(appUrl);
        const diagnostics = validation.isValid ? await testURLConnectivity(appUrl) : { isReachable: false, errorType: 'INVALID_URL' as const, error: validation.errors.join('; ') };

        results.app = {
          url: appUrl,
          validation: {
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: validation.warnings,
          },
          connectivity: diagnostics,
          message: getErrorMessage(diagnostics),
          diagnostics: getDiagnosticDetails(appUrl, diagnostics),
        };
      }

      // Test API URL if provided
      if (apiUrl) {
        const validation = validateURL(apiUrl);
        const diagnostics = validation.isValid ? await testURLConnectivity(apiUrl) : { isReachable: false, errorType: 'INVALID_URL' as const, error: validation.errors.join('; ') };

        results.api = {
          url: apiUrl,
          validation: {
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: validation.warnings,
          },
          connectivity: diagnostics,
          message: getErrorMessage(diagnostics),
          diagnostics: getDiagnosticDetails(apiUrl, diagnostics),
        };
      }

      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return router;
}
