export type GPUTier = 'potato' | 'low' | 'mid' | 'high' | 'ultra';

/** Detect GPU tier based on available context info */
export async function detectGPUTier(): Promise<GPUTier> {
  if (typeof document === 'undefined') return 'mid';
  // Try WebGL debug renderer info
  const canvas = document.createElement('canvas');

  // Try WebGL2 first
  const gl2 = canvas.getContext('webgl2');
  if (gl2 !== null) {
    const ext = gl2.getExtension('WEBGL_debug_renderer_info');
    if (ext !== null) {
      const raw: unknown = gl2.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      if (typeof raw === 'string') return classifyRenderer(raw);
    }
    // WebGL2 without debug info → at least mid
    return 'mid';
  }

  // Fall back to WebGL1
  const gl1 = canvas.getContext('webgl');
  if (gl1 !== null) {
    const ext = gl1.getExtension('WEBGL_debug_renderer_info');
    if (ext !== null) {
      const raw: unknown = gl1.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      if (typeof raw === 'string') return classifyRenderer(raw);
    }
    return 'low';
  }

  return 'potato';
}

function classifyRenderer(renderer: string): GPUTier {
  const r = renderer.toLowerCase();

  // Potato tier
  if (r.includes('swiftshader') || r.includes('llvmpipe') || r.includes('softpipe')) {
    return 'potato';
  }

  // Low tier — older mobile or integrated
  if (
    r.includes('mali-4') ||
    r.includes('mali-t') ||
    r.includes('adreno 3') ||
    r.includes('powervr sgx')
  ) {
    return 'low';
  }

  // Mid tier — modern mobile / older integrated
  if (
    r.includes('mali-g') ||
    r.includes('adreno 5') ||
    r.includes('adreno 6') ||
    r.includes('intel hd') ||
    r.includes('intel(r) hd')
  ) {
    return 'mid';
  }

  // High tier — modern discrete / Apple Silicon
  if (
    r.includes('apple m') ||
    r.includes('adreno 7') ||
    r.includes('radeon') ||
    r.includes('gtx') ||
    r.includes('intel iris')
  ) {
    return 'high';
  }

  // Ultra — top discrete GPUs
  if (r.includes('rtx') || r.includes('rx 6') || r.includes('rx 7')) {
    return 'ultra';
  }

  return 'mid';
}
