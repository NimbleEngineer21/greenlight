import { useState, useCallback } from "react";
import { loadState, saveState } from "../lib/storage.js";

export function useStorage() {
  const [state, setState] = useState(() => loadState());

  const updateState = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      saveState(next);
      return next;
    });
  }, []);

  const replaceState = useCallback((newState) => {
    saveState(newState);
    setState(newState);
  }, []);

  return [state, updateState, replaceState];
}
