import { useRef, useState } from "react";
import type { Snapshot } from "./model";
export function useHistory(initial: Snapshot) {
  const [value, setValue] = useState(initial),
    past = useRef<Snapshot[]>([]),
    future = useRef<Snapshot[]>([]);
  const commit = (next: Snapshot) => {
    past.current = [...past.current, value].slice(-100);
    future.current = [];
    setValue(next);
  };
  const undo = () => {
    const next = past.current.pop();
    if (next) {
      future.current.push(value);
      setValue(next);
    }
  };
  const redo = () => {
    const next = future.current.pop();
    if (next) {
      past.current.push(value);
      setValue(next);
    }
  };
  const reset = (next: Snapshot) => {
    past.current = [];
    future.current = [];
    setValue(next);
  };
  return {
    value,
    commit,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
