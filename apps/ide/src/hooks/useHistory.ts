import { useCallback, useState } from "react";

export interface HistoryControls<T> {
  state: T;
  set: (next: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  /** Replaces the state and clears both stacks (a different document was loaded; nothing to undo across). */
  reset: (value: T) => void;
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_HISTORY = 50;

export function useHistory<T>(initial: T): HistoryControls<T> {
  const [snapshot, setSnapshot] = useState<{
    current: T;
    past: T[];
    future: T[];
  }>({ current: initial, past: [], future: [] });

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setSnapshot((s) => {
      const value =
        typeof next === "function" ? (next as (prev: T) => T)(s.current) : next;
      return {
        current: value,
        past: [...s.past.slice(-(MAX_HISTORY - 1)), s.current],
        future: [],
      };
    });
  }, []);

  const reset = useCallback((value: T) => {
    setSnapshot({ current: value, past: [], future: [] });
  }, []);

  const undo = useCallback(() => {
    setSnapshot((s) => {
      const prev = s.past[s.past.length - 1];
      if (prev === undefined) return s;
      return {
        current: prev,
        past: s.past.slice(0, -1),
        future: [s.current, ...s.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setSnapshot((s) => {
      const next = s.future[0];
      if (next === undefined) return s;
      return {
        current: next,
        past: [...s.past, s.current],
        future: s.future.slice(1),
      };
    });
  }, []);

  return {
    state: snapshot.current,
    set,
    undo,
    redo,
    reset,
    canUndo: snapshot.past.length > 0,
    canRedo: snapshot.future.length > 0,
  };
}
