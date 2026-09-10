import { gameBuildService, GameBuildService } from "./GameBuildService.js";
import { ENGINE_BUNDLE } from "../runtime/engineBundle.generated.js";

export interface RunnerMessage {
  type: "log" | "fps" | "error" | "game-error" | "ready";
  level?: "info" | "warn" | "error" | "debug";
  message?: string;
  fps?: number;
  source?: string;
  stack?: string;
}

export type MessageHandler = (msg: RunnerMessage) => void;

function buildIframeHtml(engineBundle: string, userModuleUrl: string): string {
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

  // RAF throttle — patched before engine bundle loads so the engine inherits the cap
  var _rafCap = 0;
  var _rafLastFrame = 0;
  var _origRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function(cb) {
    if (_rafCap <= 0) return _origRaf(cb);
    var minInterval = 1000 / _rafCap;
    return _origRaf(function(ts) {
      if (ts - _rafLastFrame >= minInterval) {
        _rafLastFrame = ts;
        cb(ts);
      } else {
        window.requestAnimationFrame(cb);
      }
    });
  };

  // Message listener: hot reload + fps cap
  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data.type !== 'string') return;
    if (e.data.type === 'es-hot-reload' && typeof e.data.code === 'string') {
      try {
        if (typeof window.__es_before_reload__ === 'function') window.__es_before_reload__();
        (new Function(e.data.code))();
        if (typeof window.__es_after_reload__ === 'function') window.__es_after_reload__();
        window.parent.postMessage({ type: 'log', level: 'info', message: 'Hot reload applied', source: 'HotReload' }, '*');
      } catch(err) {
        var errMsg = String(err);
        showErrorModal('Hot reload failed: ' + errMsg);
        window.parent.postMessage({ type: 'error', level: 'error', message: 'Hot reload failed: ' + errMsg, source: 'HotReload' }, '*');
      }
    } else if (e.data.type === 'es-hot-reload-sprite' && typeof e.data.name === 'string' && typeof e.data.dataUrl === 'string') {
      if (typeof window.__es_hmr_sprite__ === 'function') window.__es_hmr_sprite__(e.data.name, e.data.dataUrl);
    } else if (e.data.type === 'es-hot-reload-shader' && typeof e.data.name === 'string' && typeof e.data.vert === 'string' && typeof e.data.frag === 'string') {
      if (typeof window.__es_hmr_shader__ === 'function') window.__es_hmr_shader__(e.data.name, e.data.vert, e.data.frag);
    } else if (e.data.type === 'es-hot-reload-room' && typeof e.data.name === 'string' && typeof e.data.roomJson === 'string') {
      if (typeof window.__es_hmr_room__ === 'function') window.__es_hmr_room__(e.data.name, e.data.roomJson);
    } else if (e.data.type === 'set-fps-cap' && typeof e.data.cap === 'number') {
      _rafCap = Math.max(0, e.data.cap);
      _rafLastFrame = 0;
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
try {
  var _esb = window.EmptySockEngine;
  if (_esb && _esb.ideBridge) { _esb.ideBridge.autoInstall(); }
} catch(e) {}
</script>
<script type="module" src="${userModuleUrl}"></script>
</body>
</html>`;
}

export class PlayRunner {
  private _iframe: HTMLIFrameElement | null = null;
  private _blobUrl: string | null = null;
  private _moduleBlobUrl: string | null = null;
  private readonly _handlers: Set<MessageHandler> = new Set();
  private _msgListener: ((e: MessageEvent) => void) | null = null;
  private _container: HTMLElement | null = null;
  private readonly _buildService: GameBuildService = new GameBuildService(0);

  onMessage(handler: MessageHandler): () => void {
    this._handlers.add(handler);
    return () => this._handlers.delete(handler);
  }

  private _emit(msg: RunnerMessage): void {
    for (const h of this._handlers) h(msg);
  }

  async start(
    code: string,
    mode: "debug" | "release",
    container: HTMLElement,
    define: Record<string, string> = {},
    virtualFiles: Record<string, string> = {},
  ): Promise<void> {
    this.stop();
    this._container = container;

    const result = await gameBuildService.buildNow({
      code,
      mode,
      define,
      virtualFiles,
    });
    if (!result.success) {
      for (const err of result.errors) {
        this._emit({
          type: "error",
          level: "error",
          message: err,
          source: "BuildService",
        });
      }
      return;
    }

    const moduleBlob = new Blob([result.js], {
      type: "application/javascript",
    });
    this._moduleBlobUrl = URL.createObjectURL(moduleBlob);

    const html = buildIframeHtml(ENGINE_BUNDLE, this._moduleBlobUrl);
    const blob = new Blob([html], { type: "text/html" });
    this._blobUrl = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.src = this._blobUrl;
    iframe.sandbox.add("allow-scripts");
    iframe.sandbox.add("allow-same-origin");
    iframe.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;border:none;background:#0e0e10;";
    container.appendChild(iframe);
    this._iframe = iframe;

    this._msgListener = (e: MessageEvent) => {
      const data = e.data as RunnerMessage | undefined;
      if (data === undefined || typeof data.type !== "string") return;
      this._emit(data);
    };
    window.addEventListener("message", this._msgListener);
  }

  hotReload(code: string): void {
    this._iframe?.contentWindow?.postMessage(
      { type: "es-hot-reload", code },
      "*",
    );
  }

  hotReloadSprite(name: string, dataUrl: string): void {
    this._iframe?.contentWindow?.postMessage(
      { type: "es-hot-reload-sprite", name, dataUrl },
      "*",
    );
  }

  hotReloadShader(name: string, vert: string, frag: string): void {
    this._iframe?.contentWindow?.postMessage(
      { type: "es-hot-reload-shader", name, vert, frag },
      "*",
    );
  }

  hotReloadRoom(name: string, roomJson: string): void {
    this._iframe?.contentWindow?.postMessage(
      { type: "es-hot-reload-room", name, roomJson },
      "*",
    );
  }

  async hotReloadFast(code: string): Promise<void> {
    const transformed = await this._buildService.transformOnly(code, "game.ts");
    this._iframe?.contentWindow?.postMessage(
      { type: "es-hot-reload", code: transformed },
      "*",
    );
  }

  /**
   * Tell the iframe to cap its requestAnimationFrame loop to `cap` fps.
   * Pass 0 to remove the cap (uncapped / native RAF rate).
   */
  postFpsCap(cap: number): void {
    this._iframe?.contentWindow?.postMessage({ type: "set-fps-cap", cap }, "*");
  }

  stop(): void {
    if (this._msgListener !== null) {
      window.removeEventListener("message", this._msgListener);
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
    if (this._moduleBlobUrl !== null) {
      URL.revokeObjectURL(this._moduleBlobUrl);
      this._moduleBlobUrl = null;
    }
  }

  get isRunning(): boolean {
    return this._iframe !== null;
  }
}

export const playRunner = new PlayRunner();
