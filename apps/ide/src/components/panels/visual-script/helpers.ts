import type { NodeData, EdgeData } from "./types";
import { NODE_WIDTH, NODE_HEIGHT, PORT_RADIUS } from "./types";

let _nodeIdCounter = 100;
export function nextId(): string {
  return `n${_nodeIdCounter++}`;
}

export function makeDefaultNodes(): NodeData[] {
  return [
    { id: "scene-1", type: "scene", label: "MyScene", x: 320, y: 40 },
    { id: "entity-1", type: "entity", label: "Player", x: 160, y: 160 },
    { id: "entity-2", type: "entity", label: "Enemy", x: 480, y: 160 },
    {
      id: "comp-transform",
      type: "component",
      label: "Transform",
      x: 60,
      y: 300,
      componentType: "Transform",
    },
    {
      id: "comp-sprite",
      type: "component",
      label: "Sprite",
      x: 220,
      y: 300,
      componentType: "Sprite",
    },
    {
      id: "comp-physics",
      type: "component",
      label: "PhysicsBody",
      x: 380,
      y: 300,
      componentType: "PhysicsBody",
    },
    {
      id: "comp-anim",
      type: "component",
      label: "Animator",
      x: 540,
      y: 300,
      componentType: "Animator",
    },
  ];
}

export function makeDefaultEdges(): EdgeData[] {
  return [
    { id: "e1", from: "scene-1", to: "entity-1" },
    { id: "e2", from: "scene-1", to: "entity-2" },
    { id: "e3", from: "entity-1", to: "comp-transform" },
    { id: "e4", from: "entity-1", to: "comp-sprite" },
    { id: "e5", from: "entity-2", to: "comp-physics" },
    { id: "e6", from: "entity-2", to: "comp-anim" },
  ];
}

export function generateCode(nodes: NodeData[], edges: EdgeData[]): string {
  const sceneNodes = nodes.filter((n) => n.type === "scene");
  const componentNodes = nodes.filter((n) => n.type === "component");

  const sceneToEntities: Record<string, NodeData[]> = {};
  const entityToComponents: Record<string, NodeData[]> = {};

  for (const e of edges) {
    const fromNode = nodes.find((n) => n.id === e.from);
    const toNode = nodes.find((n) => n.id === e.to);
    if (!fromNode || !toNode) continue;
    if (fromNode.type === "scene" && toNode.type === "entity") {
      if (sceneToEntities[fromNode.id] === undefined)
        sceneToEntities[fromNode.id] = [];
      (sceneToEntities[fromNode.id] as NodeData[]).push(toNode);
    }
    if (fromNode.type === "entity" && toNode.type === "component") {
      if (entityToComponents[fromNode.id] === undefined)
        entityToComponents[fromNode.id] = [];
      (entityToComponents[fromNode.id] as NodeData[]).push(toNode);
    }
  }

  const usedComponents = new Set(
    componentNodes.map((c) => c.componentType ?? c.label),
  );
  const imports = ["Scene", "Entity", ...Array.from(usedComponents)].join(", ");

  const lines: string[] = [
    "// Auto-generated from Visual Script graph",
    `import { ${imports} } from '@emptysock/engine';`,
    "",
  ];

  for (const scene of sceneNodes) {
    const entities = sceneToEntities[scene.id] ?? [];
    const className = scene.label.replace(/\s+/g, "") || "MyScene";
    lines.push(`class ${className} extends Scene {`);
    lines.push("  onLoad(): void {");
    for (const entity of entities) {
      const varName =
        entity.label
          .replace(/\s+/g, "")
          .replace(/^./, (c) => c.toLowerCase()) || "entity";
      lines.push(
        `    const ${varName} = this.createEntity(); // ${entity.label}`,
      );
      const comps = entityToComponents[entity.id] ?? [];
      for (const comp of comps) {
        const ct = comp.componentType ?? comp.label;
        lines.push(`    ${varName}.addComponent(new ${ct}());`);
      }
      lines.push("");
    }
    lines.push("  }");
    lines.push("");
    lines.push("  onDestroy(): void {}");
    lines.push("}");
    lines.push("");
    lines.push(`export default ${className};`);
  }

  if (sceneNodes.length === 0) {
    lines.push(
      "// No scene node found — add a Scene node and connect entities to it.",
    );
  }

  return lines.join("\n");
}

export function outputPortCenter(node: NodeData): { x: number; y: number } {
  return { x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 };
}

export function inputPortCenter(node: NodeData): { x: number; y: number } {
  return { x: node.x, y: node.y + NODE_HEIGHT / 2 };
}

export function hitTestPort(
  node: NodeData,
  mx: number,
  my: number,
  side: "input" | "output",
): boolean {
  const c = side === "output" ? outputPortCenter(node) : inputPortCenter(node);
  return Math.hypot(mx - c.x, my - c.y) <= PORT_RADIUS + 4;
}

export function edgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const dx = Math.abs(x2 - x1) * 0.5 + 40;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}
