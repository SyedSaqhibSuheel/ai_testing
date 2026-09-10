import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "java-parser";
import type { ControllerInfo, EndpointInfo } from "./types.js";
import { directChildren, findAll, nodeText, type CstNode } from "./cstUtils.js";
import { httpMethodFor, parseAnnotation, pathFor } from "./annotationParse.js";
import { walkFiles } from "./fileWalk.js";

function joinPaths(base: string, sub: string): string {
  const b = base.replace(/\/+$/, "");
  const s = sub.replace(/^\/+/, "");
  if (!b) return `/${s}`;
  if (!s) return b;
  return `${b}/${s}`;
}

function extractPathVars(pathStr: string): string[] {
  return [...pathStr.matchAll(/\{([^}:]+)(?::[^}]*)?\}/g)].map((m) => m[1]);
}

function scanController(file: string): ControllerInfo | null {
  const src = readFileSync(file, "utf-8");
  let cst;
  try {
    cst = parse(src);
  } catch {
    return null;
  }

  const classDecls = findAll(cst, "classDeclaration");
  if (classDecls.length === 0) return null;
  const classDecl = classDecls[0];

  const normalClassDecls = directChildren(classDecl, "normalClassDeclaration");
  if (normalClassDecls.length === 0) return null;
  const normalClassDecl = normalClassDecls[0];
  const typeIdentifier = directChildren(normalClassDecl, "typeIdentifier")[0];
  const className = typeIdentifier ? nodeText(typeIdentifier, src) : path.basename(file, ".java");

  const classAnnotations = directChildren(classDecl, "classModifier")
    .flatMap((mod) => findAll(mod, "annotation"))
    .map((ann) => parseAnnotation(nodeText(ann, src)));

  const isController = classAnnotations.some(
    (a) => a.name === "RestController" || a.name === "Controller"
  );
  if (!isController) return null;

  const basePaths = classAnnotations
    .filter((a) => a.name === "RequestMapping")
    .flatMap((a) => pathFor(a));
  const effectiveBasePaths = basePaths.length > 0 ? basePaths : [""];

  const classBody = directChildren(normalClassDecl, "classBody")[0];
  const endpoints: EndpointInfo[] = [];

  if (classBody) {
    for (const bodyDecl of directChildren(classBody, "classBodyDeclaration")) {
      const memberDecl = directChildren(bodyDecl, "classMemberDeclaration")[0];
      if (!memberDecl) continue;
      const methodDecl = directChildren(memberDecl, "methodDeclaration")[0];
      if (!methodDecl) continue;

      const methodModifiers = directChildren(methodDecl, "methodModifier");
      const methodAnnotations = methodModifiers
        .flatMap((mod) => findAll(mod, "annotation"))
        .map((ann) => parseAnnotation(nodeText(ann, src)));

      const mappingAnnotation = methodAnnotations.find((a) => httpMethodFor(a) !== null);
      if (!mappingAnnotation) continue;

      const httpMethod = httpMethodFor(mappingAnnotation)!;
      const methodPaths = pathFor(mappingAnnotation);
      const effectiveMethodPaths = methodPaths.length > 0 ? methodPaths : [""];

      const operationAnnotation = methodAnnotations.find((a) => a.name === "Operation");
      const summary = operationAnnotation?.pairs.summary;

      const methodHeader = directChildren(methodDecl, "methodHeader")[0];
      const methodDeclarator = methodHeader ? directChildren(methodHeader, "methodDeclarator")[0] : undefined;
      const params = methodDeclarator ? findAll(methodDeclarator, "formalParameter") : [];

      const pathVars: string[] = [];
      let requestBodyType: string | undefined;

      for (const param of params) {
        const regularParam = directChildren(param, "variableParaRegularParameter")[0];
        if (!regularParam) continue;
        const paramAnnotations = directChildren(regularParam, "variableModifier")
          .flatMap((mod) => findAll(mod, "annotation"))
          .map((ann) => parseAnnotation(nodeText(ann, src)));

        const unannType = directChildren(regularParam, "unannType")[0];
        const declaratorId = directChildren(regularParam, "variableDeclaratorId")[0];
        const paramName = declaratorId ? nodeText(declaratorId, src) : undefined;

        const pathVarAnnotation = paramAnnotations.find((a) => a.name === "PathVariable");
        if (pathVarAnnotation) {
          const explicit = pathVarAnnotation.positional ?? pathVarAnnotation.pairs.value ?? pathVarAnnotation.pairs.name;
          pathVars.push(explicit ?? paramName ?? "");
        }

        const bodyAnnotation = paramAnnotations.find((a) => a.name === "RequestBody");
        if (bodyAnnotation && unannType) {
          requestBodyType = nodeText(unannType, src);
        }
      }

      for (const basePath of effectiveBasePaths) {
        for (const methodPath of effectiveMethodPaths) {
          const fullPath = joinPaths(basePath, methodPath) || "/";
          const varsFromPath = extractPathVars(fullPath);
          endpoints.push({
            httpMethod,
            path: fullPath,
            pathVars: varsFromPath.length > 0 ? varsFromPath : pathVars,
            requestBodyType,
            summary,
          });
        }
      }
    }
  }

  return { file, className, basePaths: effectiveBasePaths, endpoints };
}

export function scanControllers(backendSrcDir: string): ControllerInfo[] {
  const files = walkFiles(backendSrcDir, (f) => f.endsWith("Controller.java"));
  const results: ControllerInfo[] = [];
  for (const file of files) {
    const info = scanController(file);
    if (info && info.endpoints.length > 0) results.push(info);
  }
  return results;
}
