/** Maps a GMS2 event name to the corresponding EmptySock Scene method name. */
function mapEventToMethod(event: string): string {
  switch (event) {
    case "Create":
      return "onLoad";
    case "Step":
      return "onUpdate";
    case "Draw":
      return "onDraw";
    case "Destroy":
      return "onDestroy";
    default:
      return `on${event}`;
  }
}

/** Returns the TypeScript method signature line for a given GMS2 event. */
function buildMethodSignature(event: string): string {
  const method = mapEventToMethod(event);
  switch (event) {
    case "Step":
      return `  ${method}(dt: number): void { /* was GML Step */ }`;
    case "Draw":
      // onDraw is not a standard Scene lifecycle method; preserved as a comment.
      return `  // onDraw is not a standard Scene lifecycle method — call manually if needed\n  ${method}(): void { /* was GML Draw */ }`;
    default:
      return `  ${method}(): void { /* was GML ${event} */ }`;
  }
}

/**
 * Generates a TypeScript class stub for a GMS2 object.
 *
 * @param objectName - The GMS2 object name (becomes the class name).
 * @param events     - List of GMS2 event names (e.g. ["Create", "Step", "Destroy"]).
 * @returns A TypeScript source string ready to be written to a .ts file.
 */
export function generateObjectStub(
  objectName: string,
  events: string[],
): string {
  const methods = events.map(buildMethodSignature).join("\n\n");
  return [
    `import { Scene, Entity } from '@emptysock/engine';`,
    ``,
    `export class ${objectName} extends Scene {`,
    methods,
    `}`,
    ``,
  ].join("\n");
}
