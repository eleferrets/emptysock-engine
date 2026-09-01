// LayerSystem — named rendering layers with z-order and entity membership
// Entities are assigned to a layer by name. The render system should sort
// entities by (layerIndex, z) before drawing. Layer order is numeric;
// lower index = drawn first (bottom). Default layer is 'default' at index 0.

export interface LayerConfig {
  name: string;
  index: number;
  visible: boolean;
}

export class LayerSystem {
  private layers: Map<string, LayerConfig> = new Map();
  private entityLayer: Map<number | string, string> = new Map();

  constructor() {
    this.defineLayer('default', 0);
    this.defineLayer('ui', 1000);
  }

  defineLayer(name: string, index: number): void {
    this.layers.set(name, { name, index, visible: true });
  }

  addToLayer(entityId: number | string, layerName: string): void {
    this.entityLayer.set(entityId, layerName);
  }

  removeFromLayer(entityId: number | string): void {
    this.entityLayer.delete(entityId);
  }

  getEntityLayer(entityId: number | string): string | null {
    return this.entityLayer.get(entityId) ?? null;
  }

  getLayerIndex(name: string): number {
    return this.layers.get(name)?.index ?? 0;
  }

  setVisible(name: string, visible: boolean): void {
    const layer = this.layers.get(name);
    if (layer) {
      layer.visible = visible;
    }
  }

  isVisible(name: string): boolean {
    return this.layers.get(name)?.visible ?? true;
  }

  getLayersSorted(): Array<LayerConfig> {
    return Array.from(this.layers.values()).sort((a, b) => a.index - b.index);
  }

  destroy(): void {
    this.layers.clear();
    this.entityLayer.clear();
  }
}
