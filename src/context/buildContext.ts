import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AppContext } from "./types.js";
import { scanControllers } from "./javaScanner.js";
import { scanDtos } from "./dtoScanner.js";
import { scanFrontend } from "./frontendScanner.js";
import { scanExpressRoutes } from "./expressScanner.js";
import { walkFiles } from "./fileWalk.js";

function hashSources(backendSrcDir: string, frontendSrcDir: string, frontendServerSrcDir: string): string {
  const hash = createHash("sha256");
  const javaFiles = walkFiles(backendSrcDir, (f) => f.endsWith(".java")).sort();
  const frontendFiles = walkFiles(frontendSrcDir, (f) => f.endsWith(".ts") || f.endsWith(".tsx")).sort();
  const frontendServerFiles = walkFiles(frontendServerSrcDir, (f) => f.endsWith(".ts")).sort();
  for (const file of [...javaFiles, ...frontendFiles, ...frontendServerFiles]) {
    hash.update(file);
    try {
      hash.update(readFileSync(file));
    } catch {
      // file may have been removed mid-scan; ignore for hashing purposes
    }
  }
  return hash.digest("hex");
}

function cachePath(cacheDir: string): string {
  return path.join(cacheDir, "context.json");
}

export function buildContext(
  backendSrcDir: string,
  frontendSrcDir: string,
  frontendServerSrcDir: string,
  cacheDir: string,
  opts: { forceRescan?: boolean } = {}
): AppContext {
  const sourceHash = hashSources(backendSrcDir, frontendSrcDir, frontendServerSrcDir);
  const file = cachePath(cacheDir);

  if (!opts.forceRescan && existsSync(file)) {
    try {
      const cached = JSON.parse(readFileSync(file, "utf-8")) as AppContext;
      if (cached.sourceHash === sourceHash) return cached;
    } catch {
      // fall through to rescan on any cache read/parse failure
    }
  }

  // The Express BFF's routes (e.g. GET /api/customers) are what the browser
  // actually calls - merged alongside the Java controllers so validatePlan
  // and the planner see the real, browser-visible API surface, not just the
  // Spring Boot layer behind it.
  const controllers = [...scanControllers(backendSrcDir), ...scanExpressRoutes(frontendServerSrcDir)];
  const dtos = scanDtos(backendSrcDir);
  const { routes, components } = scanFrontend(frontendSrcDir);

  const context: AppContext = {
    builtAt: new Date().toISOString(),
    backend: { controllers, dtos },
    frontend: { routes, components },
    sourceHash,
  };

  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(file, JSON.stringify(context, null, 2));

  return context;
}

export function loadCachedContext(cacheDir: string): AppContext | null {
  const file = cachePath(cacheDir);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as AppContext;
  } catch {
    return null;
  }
}
