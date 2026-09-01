import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Engine } from '@emptysock/engine';
import './styles/globals.css';

// Wire the Tauri file-log handler without touching the engine package itself.
// The engine exposes Engine.onFileLog() precisely so this boundary can stay clean.
if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
  void import('@tauri-apps/api/core').then(({ invoke }) => {
    Engine.onFileLog((msg) => {
      void invoke('log_error', { message: msg }).catch(() => undefined);
    });
  });
}

const root = document.getElementById('root');
if (root === null) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
