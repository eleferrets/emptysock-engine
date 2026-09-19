/// <reference types="vite/client" />

declare module "virtual:engine-types" {
  /** Map of Monaco URI → .d.ts content for @emptysock/engine and builtins. */
  const libs: Record<string, string>;
  export default libs;
}
