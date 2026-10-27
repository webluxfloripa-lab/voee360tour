import { useState } from "react";
import type { Snapshot } from "./model";

type HistoryState = {
  value: Snapshot;
  past: Snapshot[];
  future: Snapshot[];
};

const HISTORY_LIMIT = 100;

/**
 * Undo/redo must be based on the latest queued React state, not a stale
 * render closure. This also preserves every intermediate edit when several
 * updates happen in the same event or React batches them.
 */
export function useHistory(initial: Snapshot) {
  const [history, setHistory] = useState<HistoryState>(() => ({
    value: initial,
    past: [],
    future: [],
  }));

  const commit = (next: Snapshot) => {
    setHistory((current) => ({
      value: next,
      past: [...current.past, current.value].slice(-HISTORY_LIMIT),
      future: [],
    }));
  };

  const undo = () => {
    setHistory((current) => {
      if (!current.past.length) return current;
      const previous = current.past[current.past.length - 1]!;
      return {
        value: previous,
        past: current.past.slice(0, -1),
        future: [...current.future, current.value].slice(-HISTORY_LIMIT),
      };
    });
  };

  const redo = () => {
    setHistory((current) => {
      if (!current.future.length) return current;
      const next = current.future[current.future.length - 1]!;
      return {
        value: next,
        past: [...current.past, current.value].slice(-HISTORY_LIMIT),
        future: current.future.slice(0, -1),
      };
    });
  };

  const reset = (next: Snapshot) => {
    setHistory({ value: next, past: [], future: [] });
  };

  return {
    value: history.value,
    commit,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
