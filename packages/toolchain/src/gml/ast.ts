/** GML AST. Every node carries absolute source offsets `[start, end)`. */

export interface NodeBase {
  start: number;
  end: number;
}

export type Expr =
  | Literal
  | TemplateString
  | Identifier
  | Member
  | Index
  | Call
  | New
  | Unary
  | Update
  | Binary
  | Assign
  | Conditional
  | ArrayLiteral
  | StructLiteral
  | FunctionExpr
  | Paren
  | Delete;

export interface Literal extends NodeBase {
  type: "Literal";
  litKind: "number" | "string" | "verbatim" | "boolean" | "undefined";
  raw: string;
  /** number -> number, string/verbatim -> decoded body, boolean -> boolean, undefined -> undefined */
  value: number | string | boolean | undefined;
}

export interface TemplateString extends NodeBase {
  type: "TemplateString";
  /** text parts are raw slices; expr parts are parsed expressions (undefined when the expression failed to parse). */
  parts: Array<
    | { kind: "text"; raw: string }
    | { kind: "expr"; expr: Expr | undefined; start: number; end: number }
  >;
}

export interface Identifier extends NodeBase {
  type: "Identifier";
  name: string;
}

export interface Member extends NodeBase {
  type: "Member";
  object: Expr;
  /** Property name; never an identifier reference. */
  property: string;
  propertyStart: number;
}

export type AccessorKind = "[" | "|" | "?" | "#" | "@" | "$";

export interface Index extends NodeBase {
  type: "Index";
  object: Expr;
  accessor: AccessorKind;
  indices: Expr[];
}

export interface Call extends NodeBase {
  type: "Call";
  callee: Expr;
  args: Expr[];
}

export interface New extends NodeBase {
  type: "New";
  callee: Expr;
  args: Expr[];
}

export interface Unary extends NodeBase {
  type: "Unary";
  op: "!" | "-" | "+" | "~";
  arg: Expr;
}

export interface Update extends NodeBase {
  type: "Update";
  op: "++" | "--";
  prefix: boolean;
  arg: Expr;
}

export interface Binary extends NodeBase {
  type: "Binary";
  /** Normalised: `and`->`&&`, `or`->`||`, `xor`->`^^`, `<>`->`!=`, `mod`->`%`; `div` stays `div`. */
  op: string;
  /** Source spelling of the operator. */
  opRaw: string;
  left: Expr;
  right: Expr;
  /** True when this `==` was written as a single `=` (GML comparison). */
  eqFromAssign?: boolean;
}

export interface Assign extends NodeBase {
  type: "Assign";
  /** `=` for plain (also `:=`), else compound like `+=`, `??=`. */
  op: string;
  left: Expr;
  right: Expr;
}

export interface Conditional extends NodeBase {
  type: "Conditional";
  test: Expr;
  cons: Expr;
  alt: Expr;
}

export interface ArrayLiteral extends NodeBase {
  type: "ArrayLiteral";
  elements: Expr[];
}

export interface StructProp {
  key: string;
  keyStart: number;
  keyEnd: number;
  /** Shorthand `{a}` is not GML; value is always present. */
  value: Expr;
}

export interface StructLiteral extends NodeBase {
  type: "StructLiteral";
  props: StructProp[];
}

export interface Param {
  name: string;
  start: number;
  end: number;
  default?: Expr;
}

export interface FunctionExpr extends NodeBase {
  type: "FunctionExpr";
  name?: string;
  params: Param[];
  body: Block;
  isConstructor: boolean;
  parent?: { name: string; args: Expr[] };
}

export interface Paren extends NodeBase {
  type: "Paren";
  expr: Expr;
}

export interface Delete extends NodeBase {
  type: "Delete";
  arg: Expr;
}

export type Stmt =
  | VarDecl
  | ExprStmt
  | Block
  | If
  | While
  | DoUntil
  | For
  | Repeat
  | With
  | Switch
  | Return
  | Exit
  | Break
  | Continue
  | Throw
  | Try
  | FunctionDecl
  | EnumDecl
  | MacroDecl
  | Empty
  | ErrorStmt;

export interface Declarator {
  name: string;
  start: number;
  end: number;
  init?: Expr;
}

export interface VarDecl extends NodeBase {
  type: "VarDecl";
  declKind: "var" | "globalvar" | "static";
  decls: Declarator[];
}

export interface ExprStmt extends NodeBase {
  type: "ExprStmt";
  expr: Expr;
}

export interface Block extends NodeBase {
  type: "Block";
  body: Stmt[];
}

export interface If extends NodeBase {
  type: "If";
  test: Expr;
  cons: Stmt;
  alt?: Stmt;
}

export interface While extends NodeBase {
  type: "While";
  test: Expr;
  body: Stmt;
}

export interface DoUntil extends NodeBase {
  type: "DoUntil";
  body: Stmt;
  test: Expr;
}

export interface For extends NodeBase {
  type: "For";
  init?: Stmt;
  test?: Expr;
  update?: Stmt;
  body: Stmt;
}

export interface Repeat extends NodeBase {
  type: "Repeat";
  count: Expr;
  body: Stmt;
}

export interface With extends NodeBase {
  type: "With";
  target: Expr;
  body: Stmt;
}

export interface SwitchCase {
  /** undefined for `default:` */
  test?: Expr;
  body: Stmt[];
  start: number;
  end: number;
}

export interface Switch extends NodeBase {
  type: "Switch";
  discriminant: Expr;
  cases: SwitchCase[];
}

export interface Return extends NodeBase {
  type: "Return";
  arg?: Expr;
}
export interface Exit extends NodeBase {
  type: "Exit";
}
export interface Break extends NodeBase {
  type: "Break";
}
export interface Continue extends NodeBase {
  type: "Continue";
}
export interface Throw extends NodeBase {
  type: "Throw";
  arg: Expr;
}

export interface Try extends NodeBase {
  type: "Try";
  block: Block;
  param?: string;
  handler?: Block;
  finalizer?: Block;
}

export interface FunctionDecl extends NodeBase {
  type: "FunctionDecl";
  name: string;
  nameStart: number;
  params: Param[];
  body: Block;
  isConstructor: boolean;
  parent?: { name: string; args: Expr[] };
}

export interface EnumMember {
  name: string;
  start: number;
  end: number;
  value?: Expr;
}

export interface EnumDecl extends NodeBase {
  type: "EnumDecl";
  name: string;
  members: EnumMember[];
}

export interface MacroDecl extends NodeBase {
  type: "MacroDecl";
  name: string;
  /** Config prefix in `#macro Config:Name value`. */
  config?: string;
  /** Value text with line continuations and trailing comments removed, trimmed. */
  valueText: string;
  /** Parsed value when it is a valid expression. */
  value?: Expr;
}

export interface Empty extends NodeBase {
  type: "Empty";
}

export interface ErrorStmt extends NodeBase {
  type: "ErrorStmt";
  message: string;
}

export interface Program extends NodeBase {
  type: "Program";
  body: Stmt[];
}

export interface ParseDiagnostic {
  message: string;
  start: number;
  end: number;
}

export interface ParseResult {
  ast: Program;
  diagnostics: ParseDiagnostic[];
  /** Number of statements replaced by an ErrorStmt. */
  recovered: number;
}

export type Node =
  | Expr
  | Stmt
  | Program
  | SwitchCase;
