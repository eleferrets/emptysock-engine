/**
 * PlayRunner — compiles the editor's TypeScript source and injects it into a
 * sandboxed <iframe>, then streams console output and FPS back via postMessage.
 *
 * Architecture:
 *   Editor code (TS) → GameBuildService.buildNow() → IIFE bundle string
 *   → injected into blob-URL HTML page in <iframe sandbox>
 *   → iframe posts { type: 'log'|'fps'|'error', ... } to parent via postMessage
 *
 * The iframe HTML wraps the game bundle in a minimal PixiJS canvas host.
 * In production the build step would call the real esbuild transform via a
 * Tauri command; here we use GameBuildService which does lightweight
 * in-process validation and returns the (un-minified) source as the bundle.
 */

import { gameBuildService } from './GameBuildService.js';
import { ENGINE_BUNDLE } from '../runtime/engineBundle.generated.js';

export interface RunnerMessage {
  type: 'log' | 'fps' | 'error' | 'ready';
  level?: 'info' | 'warn' | 'error' | 'debug';
  message?: string;
  fps?: number;
  source?: string;
}

export type MessageHandler = (msg: RunnerMessage) => void;

function buildIframeHtml(engineBundle: string, userBundle: string): string {
  const bundle = userBundle;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0e0e10; overflow: hidden; width: 100vw; height: 100vh; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<canvas id="game-canvas"></canvas>
<script>
// Intercept console so we can relay to the IDE
(function() {
  var _send = function(level, args) {
    try {
      window.parent.postMessage({
        type: 'log',
        level: level,
        message: Array.from(args).map(function(a) {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        }).join(' '),
        source: 'Game'
      }, '*');
    } catch(e) {}
  };
  var _levels = ['log','info','warn','error','debug'];
  _levels.forEach(function(l) {
    var orig = console[l].bind(console);
    console[l] = function() { orig.apply(console, arguments); _send(l === 'log' ? 'info' : l, arguments); };
  });
  window.addEventListener('error', function(e) {
    window.parent.postMessage({ type: 'error', level: 'error', message: e.message, source: 'Runtime' }, '*');
  });
})();

// Minimal FPS counter
(function() {
  var last = performance.now();
  var frames = 0;
  function tick() {
    frames++;
    var now = performance.now();
    if (now - last >= 500) {
      var fps = Math.round(frames * 1000 / (now - last));
      window.parent.postMessage({ type: 'fps', fps: fps }, '*');
      frames = 0;
      last = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

window.parent.postMessage({ type: 'ready' }, '*');
</script>
<script>
// Engine runtime
try {
${engineBundle}
} catch(e) {
  window.parent.postMessage({ type: 'error', level: 'error', message: 'Engine load failed: ' + String(e), source: 'Engine' }, '*');
}
</script>
<script>
// User game bundle
try {
${bundle}
} catch(e) {
  window.parent.postMessage({ type: 'error', level: 'error', message: String(e), source: 'Bundle' }, '*');
}
</script>
</body>
</html>`;
}

export class PlayRunner {
  private _iframe: HTMLIFrameElement | null = null;
  private _blobUrl: string | null = null;
  private readonly _handlers: Set<MessageHandler> = new Set();
  private _msgListener: ((e: MessageEvent) => void) | null = null;
  private _container: HTMLElement | null = null;

  onMessage(handler: MessageHandler): () => void {
    this._handlers.add(handler);
    return () => this._handlers.delete(handler);
  }

  private _emit(msg: RunnerMessage): void {
    for (const h of this._handlers) h(msg);
  }

  async start(code: string, mode: 'debug' | 'release', container: HTMLElement): Promise<void> {
    this.stop();
    this._container = container;

    const result = await gameBuildService.buildNow({ code, mode });
    if (!result.success) {
      for (const err of result.errors) {
        this._emit({ type: 'error', level: 'error', message: err, source: 'BuildService' });
      }
      return;
    }

    const html = buildIframeHtml(ENGINE_BUNDLE, result.js);
    const blob = new Blob([html], { type: 'text/html' });
    this._blobUrl = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.src = this._blobUrl;
    iframe.sandbox.add('allow-scripts');
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;background:#0e0e10;';
    container.appendChild(iframe);
    this._iframe = iframe;

    this._msgListener = (e: MessageEvent) => {
      const data = e.data as RunnerMessage | undefined;
      if (data === undefined || typeof data.type !== 'string') return;
      this._emit(data);
    };
    window.addEventListener('message', this._msgListener);
  }

  stop(): void {
    if (this._msgListener !== null) {
      window.removeEventListener('message', this._msgListener);
      this._msgListener = null;
    }
    if (this._iframe !== null) {
      this._iframe.remove();
      this._iframe = null;
    }
    if (this._blobUrl !== null) {
      URL.revokeObjectURL(this._blobUrl);
      this._blobUrl = null;
    }
  }

  get isRunning(): boolean { return this._iframe !== null; }
}

export const playRunner = new PlayRunner();
