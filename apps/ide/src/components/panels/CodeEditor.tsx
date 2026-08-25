import React from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useIDEStore } from '../../store/ideStore';

export function CodeEditor(): React.ReactElement {
  const { editorCode, setEditorCode, selectedFile } = useIDEStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
          onChange={value => {
            if (value !== undefined) setEditorCode(value);
          }}
          options={{
            fontSize: 13,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontLigatures: true,
            lineHeight: 1.6,
            minimap: { enabled: true, scale: 1 },
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
