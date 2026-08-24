import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "java-parser";
import type { DtoField, DtoInfo } from "./types.js";
import { directChildren, findAll, nodeText } from "./cstUtils.js";
import { walkFiles } from "./fileWalk.js";

function scanDto(file: string): DtoInfo | null {
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
  const normalClassDecl = directChildren(classDecl, "normalClassDeclaration")[0];
  if (!normalClassDecl) return null;

  const typeIdentifier = directChildren(normalClassDecl, "typeIdentifier")[0];
  const className = typeIdentifier ? nodeText(typeIdentifier, src) : path.basename(file, ".java");

  const classBody = directChildren(normalClassDecl, "classBody")[0];
  const fields: DtoField[] = [];
  if (classBody) {
    for (const bodyDecl of directChildren(classBody, "classBodyDeclaration")) {
      const memberDecl = directChildren(bodyDecl, "classMemberDeclaration")[0];
      if (!memberDecl) continue;
      const fieldDecl = directChildren(memberDecl, "fieldDeclaration")[0];
      if (!fieldDecl) continue;

      const modifiers = directChildren(fieldDecl, "fieldModifier").map((m) => nodeText(m, src));
      if (modifiers.some((m) => m === "static" || m === "final")) continue;

      const unannType = directChildren(fieldDecl, "unannType")[0];
      const type = unannType ? nodeText(unannType, src) : "Object";
      const declIds = findAll(fieldDecl, "variableDeclaratorId");
      for (const id of declIds) {
        fields.push({ name: nodeText(id, src), type });
      }
    }
  }

  return { file, className, fields };
}

export function scanDtos(backendSrcDir: string): DtoInfo[] {
  const files = walkFiles(
    backendSrcDir,
    (f) => f.endsWith(".java") && (f.includes(`${path.sep}dto${path.sep}`) || f.includes(`${path.sep}model${path.sep}`))
  );
  const results: DtoInfo[] = [];
  for (const file of files) {
    const info = scanDto(file);
    if (info && info.fields.length > 0) results.push(info);
  }
  return results;
}
