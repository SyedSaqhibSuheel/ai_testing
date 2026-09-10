import ts from "typescript";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Syntax-checks generated Playwright test code without executing it, using
 * the TypeScript Compiler API (already a dependency - see
 * src/context/frontendScanner.ts, which uses the same technique for a
 * different purpose). `ts.transpileModule` only does syntactic diagnostics
 * (no type info needed), which is exactly what's wanted here - Phase 1
 * never runs the generated tests.
 */
export function checkSyntax(code: string): ValidationResult {
  const { diagnostics } = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });

  if (diagnostics && diagnostics.length > 0) {
    const messages = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    return { valid: false, error: `Syntax error(s): ${messages.join("; ")}` };
  }
  return { valid: true };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The scanners record a *dynamic* testid (e.g. `data-testid={`button-view-${customer.customerId}`}`)
 * as the raw template-literal source text, backticks included - see
 * `src/context/frontendScanner.ts`'s `jsxAttrText()`. Generated test code
 * necessarily uses a concrete instance of that pattern (e.g.
 * "button-view-12345678"), which can never exact-match the template string
 * itself. Converts every such template into a regex (literal segments
 * escaped, `${...}` interpolations become `.+`) so a concrete instantiation
 * is recognized as confirmed rather than flagged as hallucinated.
 */
function buildDynamicTestIdPatterns(confirmedTestIds: Set<string>): RegExp[] {
  const patterns: RegExp[] = [];
  for (const testId of confirmedTestIds) {
    if (!testId.startsWith("`") || !testId.includes("${")) continue;
    const inner = testId.slice(1, -1); // strip surrounding backticks
    const literalParts = inner.split(/\$\{[^}]*\}/).map(escapeRegExp);
    patterns.push(new RegExp(`^${literalParts.join(".+")}$`));
  }
  return patterns;
}

/**
 * Extension of `src/planner/validatePlan.ts`'s philosophy - never trust the
 * model with locator references, even in free-form generated code text.
 * Walks the AST for every `getByTestId("...")` call and flags any literal
 * that's neither an exact match nor a concrete instance of a known dynamic
 * testid pattern.
 */
export function checkLocatorHallucination(code: string, confirmedTestIds: Set<string>): ValidationResult {
  const sourceFile = ts.createSourceFile("generated.spec.ts", code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const dynamicPatterns = buildDynamicTestIdPatterns(confirmedTestIds);
  const invalid: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "getByTestId"
    ) {
      const arg = node.arguments[0];
      if (
        arg &&
        ts.isStringLiteralLike(arg) &&
        !confirmedTestIds.has(arg.text) &&
        !dynamicPatterns.some((p) => p.test(arg.text))
      ) {
        invalid.push(arg.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (invalid.length > 0) {
    return { valid: false, error: `Generated code references unconfirmed testid(s): ${[...new Set(invalid)].join(", ")}` };
  }
  return { valid: true };
}

export function validateGeneratedTest(code: string, confirmedTestIds: Set<string>): ValidationResult {
  const syntax = checkSyntax(code);
  if (!syntax.valid) return syntax;
  return checkLocatorHallucination(code, confirmedTestIds);
}
