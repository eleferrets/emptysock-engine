/** Mali GPU compatibility fixes */

export interface MaliInfo {
  isMali: boolean;
  renderer: string;
  generation: 'old' | 'mid' | 'current' | 'unknown';
}

export function detectMali(): MaliInfo {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') ?? canvas.getContext('webgl2');

  if (gl === null) {
    return { isMali: false, renderer: '', generation: 'unknown' };
  }

  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext === null) {
    return { isMali: false, renderer: '', generation: 'unknown' };
  }

  const renderer = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string).toLowerCase();

  if (!renderer.includes('mali')) {
    return { isMali: false, renderer, generation: 'unknown' };
  }

  let generation: MaliInfo['generation'] = 'unknown';

  if (renderer.includes('mali-4') || renderer.includes('mali-t')) {
    generation = 'old';
  } else if (renderer.includes('mali-g5') || renderer.includes('mali-g7')) {
    generation = 'mid';
  } else if (renderer.includes('mali-g')) {
    generation = 'current';
  }

  return { isMali: true, renderer, generation };
}

export interface MaliFixes {
  disableInstancedArrays: boolean;
  forcePOTTextures: boolean;
  forceLinearMipmaps: boolean;
  maxTextureSize: number | null;
}

export function getMaliFixes(info: MaliInfo): MaliFixes {
  if (!info.isMali) {
    return {
      disableInstancedArrays: false,
      forcePOTTextures: false,
      forceLinearMipmaps: false,
      maxTextureSize: null,
    };
  }

  if (info.generation === 'old') {
    return {
      disableInstancedArrays: true,
      forcePOTTextures: true,
      forceLinearMipmaps: true,
      maxTextureSize: 2048,
    };
  }

  return {
    disableInstancedArrays: false,
    forcePOTTextures: true,
    forceLinearMipmaps: false,
    maxTextureSize: 4096,
  };
}

/** Apply Mali compatibility fixes to a canvas context */
export function applyMaliFixes(fixes: MaliFixes): void {
  if (fixes.disableInstancedArrays) {
    // Monkey-patch to disable instanced arrays extension
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    // Use a typed wrapper that satisfies the overloaded signature
    function patchedGetContext(
      this: HTMLCanvasElement,
      contextId: string,
      options?: unknown
    ): unknown {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional monkey-patch
      const ctx = (origGetContext as (ctx: string, opts?: unknown) => unknown).call(this, contextId, options) as any;
      if (ctx !== null && (contextId === 'webgl' || contextId === 'experimental-webgl')) {
        const origGetExt = (ctx as { getExtension: (name: string) => unknown }).getExtension.bind(ctx);
        (ctx as { getExtension: (name: string) => unknown }).getExtension = (name: string) => {
          if (name === 'ANGLE_instanced_arrays') return null;
          return origGetExt(name);
        };
      }
      return ctx;
    }
    HTMLCanvasElement.prototype.getContext = patchedGetContext as typeof HTMLCanvasElement.prototype.getContext;
  }
}
