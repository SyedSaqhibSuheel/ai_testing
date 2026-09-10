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

  return router;
}
