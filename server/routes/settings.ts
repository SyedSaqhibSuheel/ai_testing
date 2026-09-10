import { Router } from "express";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { getMaskedSettings, updatePlatformSettings } from "../settings/settingsService.js";

export function settingsRouter(db: Db, config: Config): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(getMaskedSettings(db, config));
  });

  router.patch("/", (req, res) => {
    updatePlatformSettings(db, req.body ?? {});
    res.json(getMaskedSettings(db, config));
  });

  // Verify Gemini API key
  router.post("/verify-gemini", async (_req, res) => {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;

      if (!geminiApiKey) {
        return res.status(400).json({
          success: false,
          error: "GEMINI_API_KEY is not set in environment variables",
          hint: "Add GEMINI_API_KEY to your .env file",
        });
      }

      // Test the API key by making a minimal request
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "ping",
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        return res.status(400).json({
          success: false,
          error: "Gemini API key verification failed",
          details: errorData,
          hint: "Check if your API key is valid and has the necessary permissions",
        });
      }

      const data = await response.json();

      return res.status(200).json({
        success: true,
        message: "Gemini API key is valid and functional",
        model: "gemini-1.5-flash",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        success: false,
        error: "Failed to verify Gemini API key",
        details: errorMessage,
      });
    }
  });

  return router;
}
