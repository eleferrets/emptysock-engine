import React from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useIDEStore } from '../../store/ideStore';
import { gameBuildService } from '../../services/GameBuildService';
import { loadSettings } from '../../services/SettingsService';
import type { IDESettings } from '../../services/SettingsService';

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = React.useState(() => window.innerWidth < 600);
  React.useEffect(() => {
    const handler = (): void => setNarrow(window.innerWidth < 600);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return narrow;
}

export function CodeEditor(): React.ReactElement {
  const { editorCode, setEditorCode, selectedFile, buildMode, setBuildStatus, addLog } = useIDEStore();
  const isNarrow = useIsNarrow();

  // Load settings once on mount
  const [settings] = React.useState<IDESettings>(() => loadSettings());

  // Trigger a build and update store state
  const triggerBuild = React.useCallback(
    (code: string, immediate: boolean): void => {
      if (immediate) {
        setBuildStatus('building');
        addLog('info', 'Building…', 'BuildService');
        void gameBuildService.buildNow({ code, mode: buildMode }).then(result => {
          if (result.success) {
            setBuildStatus('success', [], result.duration);
            addLog(
              'info',
              `Build succeeded in ${result.duration}ms (${result.byteSize} bytes)`,
              'BuildService'
            );
          } else {
            setBuildStatus('error', result.errors, result.duration);
            for (const err of result.errors) {
              addLog('error', err, 'BuildService');
            }
          }
        });
      } else {
        gameBuildService.queueBuild({
          code,
          mode: buildMode,
          onStart: () => {
            setBuildStatus('building');
            addLog('info', 'Building…', 'BuildService');
          },
          onComplete: (result) => {
            if (result.success) {
              setBuildStatus('success', [], result.duration);
              addLog(
                'info',
                `Build succeeded in ${result.duration}ms (${result.byteSize} bytes)`,
                'BuildService'
              );
            } else {
              setBuildStatus('error', result.errors, result.duration);
              for (const err of result.errors) {
                addLog('error', err, 'BuildService');
              }
            }
          },
        });
      }
    },
    [buildMode, setBuildStatus, addLog]
  );

  // Handle code changes from Monaco
  const handleChange = React.useCallback(
    (value: string | undefined): void => {
      if (value === undefined) return;
      setEditorCode(value);
      if (settings.autoBuild) {
        triggerBuild(value, false);
      }
    },
    [setEditorCode, settings.autoBuild, triggerBuild]
  );

  // Ctrl+S handler — attach to container div
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        triggerBuild(editorCode, true);
      }
    },
    [editorCode, triggerBuild]
  );

  // Destroy service on unmount
  React.useEffect(() => {
    return () => {
      gameBuildService.cancel();
    };
  }, []);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      {/* File tab bar */}
      {selectedFile !== null && (
        <div
          className="flex items-center gap-0 px-2 flex-shrink-0"
          style={{
            height: 32,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div
            className="flex items-center gap-2 px-3 h-full text-xs"
            style={{
              borderBottom: '2px solid var(--accent)',
              color: 'var(--text)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <span>{selectedFile.split('/').pop()}</span>
          </div>
        </div>
      )}

      {/* Monaco editor */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          language="typescript"
          theme="vs-dark"
          value={editorCode}
          onChange={handleChange}
          options={{
            fontSize: settings.editorFontSize,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontLigatures: true,
            lineHeight: 1.6,
            minimap: { enabled: !isNarrow, scale: 1 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            overviewRulerBorder: false,
            renderLineHighlight: 'gutter',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            bracketPairColorization: { enabled: true },
            guides: { indentation: true },
          }}
        />
      </div>
    </div>
  );
}
