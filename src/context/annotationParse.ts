export interface ParsedAnnotation {
  name: string;
  /** For `@Foo("bar")` - a single unnamed value. */
  positional?: string;
  /** For `@Foo(a = "b", c = {"d","e"})`. Array values are joined with '|'. */
  pairs: Record<string, string>;
}

/** Splits `inner` on top-level commas, ignoring commas inside "...", {...}, (...). */
function splitTopLevel(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inString) {
      current += ch;
      if (ch === '"' && inner[i - 1] !== "\\") inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === "{" || ch === "(") depth++;
    if (ch === "}" || ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    const quoted = [...trimmed.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    if (quoted.length > 0) return quoted.join("|");
    return trimmed.slice(1, -1).trim();
  }
  const stringMatch = trimmed.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (stringMatch) return stringMatch[1];
  return trimmed;
}

/**
 * Parses a single annotation's raw source text (as returned by
 * `nodeText()` on a CST `annotation` node) into a name plus its
 * arguments. Handles marker annotations (`@Foo`), single-value
 * annotations (`@Foo("x")`), and named-pair annotations
 * (`@Foo(a = "b", c = {"d","e"})`). Fully-qualified annotation names
 * (`@io.swagger...Tag(...)`) are reduced to their simple name.
 */
export function parseAnnotation(raw: string): ParsedAnnotation {
  const cleaned = raw.trim().replace(/^@/, "");
  const parenIdx = cleaned.indexOf("(");
  if (parenIdx === -1) {
    const name = cleaned.split(".").pop() ?? cleaned;
    return { name, pairs: {} };
  }

  const fullName = cleaned.slice(0, parenIdx).trim();
  const name = fullName.split(".").pop() ?? fullName;
  const inner = cleaned.slice(parenIdx + 1, cleaned.lastIndexOf(")"));
  const parts = splitTopLevel(inner);
  const pairs: Record<string, string> = {};
  let positional: string | undefined;

  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    const looksLikePair = eqIdx > 0 && part[eqIdx + 1] !== "=" && !part.startsWith('"');
    if (looksLikePair) {
      const key = part.slice(0, eqIdx).trim();
      const value = parseValue(part.slice(eqIdx + 1));
      pairs[key] = value;
    } else if (part) {
      positional = parseValue(part);
    }
  }

  return { name, positional, pairs };
}

const HTTP_MAPPING_ANNOTATIONS: Record<string, string> = {
  GetMapping: "GET",
  PostMapping: "POST",
  PutMapping: "PUT",
  DeleteMapping: "DELETE",
  PatchMapping: "PATCH",
};

export function httpMethodFor(annotation: ParsedAnnotation): string | null {
  if (annotation.name in HTTP_MAPPING_ANNOTATIONS) {
    return HTTP_MAPPING_ANNOTATIONS[annotation.name];
  }
  if (annotation.name === "RequestMapping") {
    const method = annotation.pairs.method;
    if (method) {
      const verb = method.split(".").pop()?.replace(/[{}]/g, "");
      return verb ?? "ANY";
    }
    return "ANY";
  }
  return null;
}

export function pathFor(annotation: ParsedAnnotation): string[] {
  const raw = annotation.positional ?? annotation.pairs.value ?? annotation.pairs.path;
  if (!raw) return [];
  return raw.split("|").map((p) => p.trim()).filter(Boolean);
}
