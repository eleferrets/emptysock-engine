import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { Diagnostics } from "@emptysock/engine";
import "./styles/globals.css";
import "./styles/rc-dock-overrides.css";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// Use the locally bundled monaco-editor instead of loading from CDN.
loader.config({ monaco });

// Wire the Tauri file-log handler without touching the engine package itself.
// The engine exposes Diagnostics.onFileLog() precisely so this boundary can stay clean.
if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
  const tauriCore = "@tauri-apps/api/core";
  void import(/* @vite-ignore */ tauriCore).then(({ invoke }) => {
    Diagnostics.onFileLog((msg) => {
      void invoke("log_error", { message: msg }).catch(() => undefined);
    });
  });
}

const root = document.getElementById("root");
if (root === null) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
