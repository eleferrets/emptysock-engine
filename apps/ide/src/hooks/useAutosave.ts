import { useEffect } from "react";
import { useIDEStore } from "../store/ideStore";

const AUTOSAVE_KEY = "es-autosave";
const AUTOSAVE_AT_KEY = "es-autosave-at";

/**
 * Returns true if an autosave snapshot exists in localStorage.
 * Wrapped in try/catch so it is safe in contexts where storage is blocked.
 */
export function offerRestore(): boolean {
  try {
    return localStorage.getItem(AUTOSAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Reads the autosave snapshot and loads it into the IDE store.
 * The snapshot is a project JSON string, so it is passed as the
 * `emptysock.project.json` entry that loadProjectFiles understands.
 */
export function applyRestore(): void {
  try {
    const json = localStorage.getItem(AUTOSAVE_KEY);
    if (json === null) return;
    useIDEStore.getState().loadProjectFiles({ "emptysock.project.json": json });
  } catch {
    // ignore — corrupted or blocked storage
  }
}

/** Removes the autosave snapshot from localStorage. */
export function clearRestore(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(AUTOSAVE_AT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Subscribes to the IDE store and writes a debounced autosave snapshot
 * to localStorage whenever store state changes. Call once in the root component.
 */
export function useAutosave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useIDEStore.subscribe(() => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const json = useIDEStore.getState().saveProjectJson();
          localStorage.setItem(AUTOSAVE_KEY, json);
          localStorage.setItem(AUTOSAVE_AT_KEY, String(Date.now()));
        } catch {
          // storage full — ignore
        }
      }, 2500);
    });

    return () => {
      if (timer !== null) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
