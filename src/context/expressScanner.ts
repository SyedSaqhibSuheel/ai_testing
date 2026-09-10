import { readFileSync } from "node:fs";
import ts from "typescript";
import type { ControllerInfo, EndpointInfo } from "./types.js";
import { walkFiles } from "./fileWalk.js";

const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch"]);

function extractPathVars(pathStr: string): string[] {
  return [...pathStr.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
}

function scanFile(file: string): EndpointInfo[] {
  const text = readFileSync(file, "utf-8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const endpoints: EndpointInfo[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText() === "app" &&
      HTTP_METHODS.has(node.expression.name.text)
    ) {
      const pathArg = node.arguments[0];
      if (pathArg && ts.isStringLiteralLike(pathArg)) {
        const routePath = pathArg.text;
        endpoints.push({
          httpMethod: node.expression.name.text.toUpperCase(),
          path: routePath,
          pathVars: extractPathVars(routePath),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return endpoints;
}

/**
 * Scans CallCenterUI's own Express server (its "backend for frontend" layer
 * in server/*.ts) for app.get/post/put/delete/patch route definitions. This
 * is the API surface the browser actually calls (e.g. GET /api/customers) -
 * distinct from, and usually a proxy in front of, the Spring Boot endpoints
 * javaScanner finds. Without this, validatePlan/the planner only know about
 * the Java backend and can't catch a plan referencing a real
 * frontend-visible path (or flag an invented one) correctly.
 */
export function scanExpressRoutes(frontendServerSrcDir: string): ControllerInfo[] {
  const files = walkFiles(frontendServerSrcDir, (f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
  const controllers: ControllerInfo[] = [];

  for (const file of files) {
    let endpoints: EndpointInfo[];
    try {
      endpoints = scanFile(file);
    } catch {
      continue;
    }
    if (endpoints.length > 0) {
      controllers.push({ file, className: "CallCenterUI Express API (server-side, proxies to fidar-server)", basePaths: [""], endpoints });
    }
  }

  return controllers;
}
