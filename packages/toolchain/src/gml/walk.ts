/** Generic traversal of the GML AST (`ast.ts`). */

import type { Expr, Stmt } from "./ast.js";

export type AstNode = Expr | Stmt;

/** Direct child nodes of `n`, in source order. */
export function children(n: AstNode): AstNode[] {
  switch (n.type) {
    case "Literal":
    case "Identifier":
    case "Exit":
    case "Break":
    case "Continue":
    case "Empty":
    case "ErrorStmt":
    case "EnumDecl":
    case "MacroDecl":
      return [];
    case "TemplateString":
      return n.parts.flatMap((p) =>
        p.kind === "expr" && p.expr ? [p.expr] : [],
      );
    case "Member":
      return [n.object];
    case "Index":
      return [n.object, ...n.indices];
    case "Call":
    case "New":
      return [n.callee, ...n.args];
    case "Unary":
    case "Update":
    case "Delete":
      return [n.arg];
    case "Binary":
    case "Assign":
      return [n.left, n.right];
    case "Conditional":
      return [n.test, n.cons, n.alt];
    case "ArrayLiteral":
      return [...n.elements];
    case "StructLiteral":
      return n.props.map((p) => p.value);
    case "FunctionExpr":
    case "FunctionDecl":
      return [
        ...n.params.flatMap((p) => (p.default ? [p.default] : [])),
        ...(n.parent?.args ?? []),
        n.body,
      ];
    case "Paren":
      return [n.expr];
    case "VarDecl":
      return n.decls.flatMap((d) => (d.init ? [d.init] : []));
    case "ExprStmt":
      return [n.expr];
    case "Block":
      return [...n.body];
    case "If":
      return n.alt ? [n.test, n.cons, n.alt] : [n.test, n.cons];
    case "While":
      return [n.test, n.body];
    case "DoUntil":
      return [n.body, n.test];
    case "For":
      return [
        ...(n.init ? [n.init] : []),
        ...(n.test ? [n.test] : []),
        ...(n.update ? [n.update] : []),
        n.body,
      ];
    case "Repeat":
      return [n.count, n.body];
    case "With":
      return [n.target, n.body];
    case "Switch":
      return [
        n.discriminant,
        ...n.cases.flatMap((c) => [...(c.test ? [c.test] : []), ...c.body]),
      ];
    case "Return":
      return n.arg ? [n.arg] : [];
    case "Throw":
      return [n.arg];
    case "Try":
      return [
        n.block,
        ...(n.handler ? [n.handler] : []),
        ...(n.finalizer ? [n.finalizer] : []),
      ];
  }
}

/**
 * Pre-order walk. `visit` returns false to skip a node's children
 * (e.g. to stay out of nested functions).
 */
export function walk(n: AstNode, visit: (n: AstNode) => boolean | void): void {
  if (visit(n) === false) return;
  for (const c of children(n)) walk(c, visit);
}

/** True when some node under `roots` (not inside a nested function) satisfies `test`. */
export function someNode(
  roots: readonly AstNode[],
  test: (n: AstNode) => boolean,
): boolean {
  let found = false;
  for (const r of roots)
    walk(r, (n) => {
      if (found) return false;
      if (test(n)) {
        found = true;
        return false;
      }
      return n.type !== "FunctionExpr" && n.type !== "FunctionDecl";
    });
  return found;
}
