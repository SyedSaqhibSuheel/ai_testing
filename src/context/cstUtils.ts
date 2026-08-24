// Small generic helpers over java-parser's chevrotain CST. Rather than
// implementing a full BaseJavaCstVisitor (which requires knowing dozens of
// grammar rule names), we use the CST purely to find precise text spans
// (class/method/parameter boundaries) and then do simple string/regex
// parsing on those short, already-isolated spans (e.g. a single
// `@PostMapping("/x/{y}")` annotation's raw text) - this is far more robust
// than regexing the whole file, since annotation args can span multiple
// lines and nest braces/parens in ways regex alone would mis-scope.

export interface CstNode {
  name?: string;
  children?: Record<string, Array<CstNode | CstToken>>;
}

export interface CstToken {
  image: string;
  startOffset: number;
  endOffset: number;
  tokenType?: unknown;
}

function isToken(node: unknown): node is CstToken {
  return (
    !!node &&
    typeof node === "object" &&
    "image" in node &&
    "startOffset" in node &&
    !("children" in node)
  );
}

export function findAll(node: unknown, ruleName: string, acc: CstNode[] = []): CstNode[] {
  if (Array.isArray(node)) {
    for (const n of node) findAll(n, ruleName, acc);
    return acc;
  }
  if (!node || typeof node !== "object" || isToken(node)) return acc;
  const cst = node as CstNode;
  if (cst.name === ruleName) acc.push(cst);
  if (cst.children) {
    for (const key of Object.keys(cst.children)) findAll(cst.children[key], ruleName, acc);
  }
  return acc;
}

export function directChildren(node: CstNode, ruleName: string): CstNode[] {
  const list = node.children?.[ruleName];
  if (!list) return [];
  return list.filter((n): n is CstNode => !isToken(n));
}

function firstToken(node: unknown): CstToken | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const t = firstToken(n);
      if (t) return t;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (isToken(node)) return node;
  const cst = node as CstNode;
  if (cst.children) {
    for (const key of Object.keys(cst.children)) {
      const t = firstToken(cst.children[key]);
      if (t) return t;
    }
  }
  return null;
}

function lastToken(node: unknown): CstToken | null {
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      const t = lastToken(node[i]);
      if (t) return t;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (isToken(node)) return node;
  const cst = node as CstNode;
  if (cst.children) {
    const keys = Object.keys(cst.children);
    for (let i = keys.length - 1; i >= 0; i--) {
      const t = lastToken(cst.children[keys[i]]);
      if (t) return t;
    }
  }
  return null;
}

/** Raw source text spanned by a CST node (or array of nodes), inclusive. */
export function nodeText(node: unknown, src: string): string {
  const a = firstToken(node);
  const b = lastToken(node);
  if (!a || !b) return "";
  return src.slice(a.startOffset, b.endOffset + 1);
}
