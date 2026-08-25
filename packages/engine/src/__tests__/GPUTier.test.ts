import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock WebGL canvas for renderer-based detection
function mockCanvas(renderer: string): void {
  const ext = {
    UNMASKED_RENDERER_WEBGL: 37446,
  };
  const mockGl = {
    getExtension: (_name: string) => ext,
    getParameter: (param: number) => {
      if (param === ext.UNMASKED_RENDERER_WEBGL) return renderer;
      return null;
    },
  };
  vi.spyOn(document, 'createElement').mockReturnValue({
    getContext: (type: string) => {
      if (type === 'webgl2') return mockGl;
      return null;
    },
  } as unknown as HTMLCanvasElement);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectGPUTier', () => {
  it('"RTX 4090" renderer → ultra', async () => {
    mockCanvas('NVIDIA GeForce RTX 4090');
    const { detectGPUTier } = await import('../core/GPUTier.js');
    const tier = await detectGPUTier();
    expect(tier).toBe('ultra');
  });

  it('"GTX 1060" renderer → high', async () => {
    mockCanvas('NVIDIA GeForce GTX 1060');
    const { detectGPUTier } = await import('../core/GPUTier.js');
    const tier = await detectGPUTier();
    expect(tier).toBe('high');
  });

  it('SwiftShader → potato', async () => {
    mockCanvas('Google SwiftShader');
    const { detectGPUTier } = await import('../core/GPUTier.js');
    const tier = await detectGPUTier();
    expect(tier).toBe('potato');
  });

  it('No WebGL → potato', async () => {
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: (_type: string) => null,
    } as unknown as HTMLCanvasElement);
    const { detectGPUTier } = await import('../core/GPUTier.js');
    const tier = await detectGPUTier();
    expect(tier).toBe('potato');
  });
});
