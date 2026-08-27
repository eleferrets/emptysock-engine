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
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0e0e10; overflow: hidden; width: 100vw; height: 100vh; }
  canvas { display: block; width: 100%; height: 100%; }
  #es-error-modal {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.72); z-index: 9999; padding: 16px;
  }
  #es-error-modal .box {
    background: #1a1a2e; border: 1px solid rgba(248,113,113,0.4); border-radius: 10px;
    padding: 20px 24px; max-width: 480px; width: 100%; font-family: monospace;
  }
  #es-error-modal .title { color: #f87171; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
  #es-error-modal pre { color: #fca5a5; font-size: 11px; white-space: pre-wrap; word-break: break-word; margin: 0; line-height: 1.5; }
  #es-error-modal button { margin-top: 12px; background: rgba(248,113,113,0.15); border: 1px solid rgba(248,113,113,0.3); color: #f87171; padding: 4px 14px; border-radius: 5px; font-size: 11px; cursor: pointer; }
</style>
</head>
<body>
<canvas id="game-canvas"></canvas>
<script>
(function() {
  function showErrorModal(msg) {
    var existing = document.getElementById('es-error-modal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'es-error-modal';
    var safe = String(msg).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    modal.innerHTML = '<div class="box"><div class="title">Runtime Error</div><pre>' + safe + '</pre><button onclick="document.getElementById(\'es-error-modal\').remove()">Dismiss</button></div>';
    document.body.appendChild(modal);
  }

  // Relay console to IDE
  var _send = function(level, args) {
    try {
      window.parent.postMessage({ type: 'log', level: level, message: Array.from(args).map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' '), source: 'Game' }, '*');
    } catch(e) {}
  };
  ['log','info','warn','error','debug'].forEach(function(l) {
    var orig = console[l].bind(console);
    console[l] = function() { orig.apply(console, arguments); _send(l === 'log' ? 'info' : l, arguments); };
  });

  window.addEventListener('error', function(e) {
    var msg = e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '');
    showErrorModal(msg);
    window.parent.postMessage({ type: 'error', level: 'error', message: msg, source: 'Runtime' }, '*');
  });

  window.addEventListener('unhandledrejection', function(e) {
    var msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
    showErrorModal('Unhandled rejection: ' + msg);
    window.parent.postMessage({ type: 'error', level: 'error', message: 'Unhandled rejection: ' + msg, source: 'Runtime' }, '*');
  });

  // Hot reload listener
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'es-hot-reload' || typeof e.data.code !== 'string') return;
    try {
      // eslint-disable-next-line no-new-func
      (new Function(e.data.code))();
      window.parent.postMessage({ type: 'log', level: 'info', message: 'Hot reload applied', source: 'HotReload' }, '*');
    } catch(err) {
      var errMsg = String(err);
      showErrorModal('Hot reload failed: ' + errMsg);
      window.parent.postMessage({ type: 'error', level: 'error', message: 'Hot reload failed: ' + errMsg, source: 'HotReload' }, '*');
    }
  });

  // FPS counter
  var last = performance.now(), frames = 0;
  function tick() {
    frames++;
    var now = performance.now();
    if (now - last >= 500) {
      window.parent.postMessage({ type: 'fps', fps: Math.round(frames * 1000 / (now - last)) }, '*');
      frames = 0; last = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  window.parent.postMessage({ type: 'ready' }, '*');
})();
</script>
<script>
try { ${engineBundle} } catch(e) {
  window.parent.postMessage({ type: 'error', level: 'error', message: 'Engine load failed: ' + String(e), source: 'Engine' }, '*');
}
</script>
<script>
try { ${userBundle} } catch(e) {
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

  hotReload(code: string): void {
    this._iframe?.contentWindow?.postMessage({ type: 'es-hot-reload', code }, '*');
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
