import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { ComponentTestIds, RouteInfo } from "./types.js";
import { walkFiles } from "./fileWalk.js";

function jsxAttrText(attr: ts.JsxAttribute): string | undefined {
  const init = attr.initializer;
  if (!init) return undefined;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    if (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression)) {
      return init.expression.text;
    }
    return init.expression.getText();
  }
  return undefined;
}

function findComponentName(sourceFile: ts.SourceFile): string | undefined {
  let name: string | undefined;
  const visit = (node: ts.Node) => {
    if (name) return;
    if (ts.isFunctionDeclaration(node) && node.name && hasExportModifier(node)) {
      name = node.name.text;
      return;
    }
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          const init = decl.initializer;
          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
            name = decl.name.text;
            return;
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return name;
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function scanFile(file: string): { testIds: ComponentTestIds; routes: RouteInfo[] } {
  const text = readFileSync(file, "utf-8");
  const scriptKind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind);

  const testIds = new Set<string>();
  const routes: RouteInfo[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText() === "data-testid") {
      const value = jsxAttrText(node);
      if (value) testIds.add(value);
    }

    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText() === "Route"
    ) {
      let routePath: string | undefined;
      let component: string | undefined;
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const attrName = attr.name.getText();
        if (attrName === "path") routePath = jsxAttrText(attr);
        if (attrName === "component") component = jsxAttrText(attr);
      }
      if (routePath) routes.push({ file, path: routePath, component });
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return {
    testIds: { file, componentName: findComponentName(sourceFile), testIds: [...testIds] },
    routes,
  };
}

export function scanFrontend(frontendSrcDir: string): { routes: RouteInfo[]; components: ComponentTestIds[] } {
  const files = walkFiles(
    frontendSrcDir,
    (f) => f.endsWith(".tsx") || f.endsWith(".ts")
  ).filter((f) => !f.endsWith(".d.ts"));

  const routes: RouteInfo[] = [];
  const components: ComponentTestIds[] = [];

  for (const file of files) {
    try {
      const { testIds, routes: fileRoutes } = scanFile(file);
      if (testIds.testIds.length > 0) components.push(testIds);
      routes.push(...fileRoutes);
    } catch {
      // Skip files that fail to parse - not fatal for a best-effort scan.
      continue;
    }
  }

  return { routes, components };
}

export function relativeComponentPath(file: string, frontendSrcDir: string): string {
  return path.relative(frontendSrcDir, file);
}
