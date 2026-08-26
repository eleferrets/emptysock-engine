import React, { useEffect, useRef, useCallback } from 'react';
import { Monitor, Wifi } from 'lucide-react';
import { BouncingBallsDemo } from '../../demo/BouncingBalls';
import { useIDEStore } from '../../store/ideStore';

export function CanvasPreview(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const demoRef = useRef<BouncingBallsDemo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { fps, setFps, playState, debugOverlay, entities } = useIDEStore();

  const initDemo = useCallback(async (): Promise<void> => {
    if (canvasRef.current === null) return;
    if (demoRef.current !== null) {
      demoRef.current.destroy();
    }
    const demo = new BouncingBallsDemo();
    demoRef.current = demo;
    await demo.init(canvasRef.current, setFps);
  }, [setFps]);

  useEffect(() => {
    void initDemo();
    return () => {
      demoRef.current?.destroy();
      demoRef.current = null;
    };
  }, [initDemo]);

  const rendererType = 'WebGL2';

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden" ref={containerRef}>
      {/* Canvas fills the area */}
      <div className="flex-1 relative overflow-hidden" style={{ background: '#0e0e10' }}>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* HUD overlay */}
        <div
          className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none"
        >
          {/* FPS counter */}
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono"
            style={{
              background: 'rgba(14,14,16,0.85)',
              border: '1px solid rgba(42,42,46,0.8)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: fps >= 55 ? 'var(--green)' : fps >= 30 ? 'var(--yellow)' : 'var(--red)',
                boxShadow: `0 0 4px ${fps >= 55 ? 'var(--green)' : fps >= 30 ? 'var(--yellow)' : 'var(--red)'}`,
              }}
            />
            <span style={{ color: 'var(--text-muted)' }}>FPS</span>
            <span
              style={{
                color: fps >= 55 ? 'var(--green)' : fps >= 30 ? 'var(--yellow)' : 'var(--red)',
                minWidth: '2ch',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fps}
            </span>
          </div>

          {/* Renderer info */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
            style={{
              background: 'rgba(14,14,16,0.85)',
              border: '1px solid rgba(42,42,46,0.8)',
              backdropFilter: 'blur(8px)',
              color: 'var(--text-muted)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <Monitor size={10} />
            {rendererType}
          </div>
        </div>

        {/* Debug overlay */}
        {debugOverlay && (
          <>
            {/* CSS grid overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 31px,rgba(124,106,247,0.12) 31px,rgba(124,106,247,0.12) 32px),repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(124,106,247,0.12) 31px,rgba(124,106,247,0.12) 32px)',
              }}
            />
            {/* Debug info panel */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'rgba(14,14,16,0.9)',
                border: '1px solid rgba(124,106,247,0.4)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--text-muted)',
                lineHeight: 1.8,
                pointerEvents: 'none',
              }}
            >
              <div style={{ color: '#7c6af7', fontWeight: 700, marginBottom: 4, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Debug</div>
              <div>Entities: <span style={{ color: 'var(--text)' }}>{entities.length}</span></div>
              <div>Draw calls: <span style={{ color: 'var(--text)' }}>–</span></div>
              <div>Physics: <span style={{ color: 'var(--text)' }}>–</span></div>
              <div>Mode: <span style={{ color: '#7c6af7' }}>DEBUG</span></div>
            </div>
          </>
        )}

        {/* Play state overlay */}
        {playState === 'stopped' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{
              background: 'rgba(14,14,16,0.6)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div
              className="px-4 py-3 rounded-lg text-center"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                Demo running — click Play to start the game
              </div>
              <div
                className="flex items-center justify-center gap-1.5 text-xs"
                style={{ color: 'var(--accent)' }}
              >
                <Wifi size={11} />
                PixiJS rendering active
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
