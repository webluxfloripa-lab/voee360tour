import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useHistory } from "../src/lib/useHistory";
import { emptySnapshot } from "../src/lib/model";
describe("local undo/redo", () => {
  it("undoes and redoes changes, clears redo on new edits, resets after restore", () => {
    const first = emptySnapshot("first");
    const { result } = renderHook(() => useHistory(first));
    act(() => result.current.commit({ ...first, title: "second" }));
    act(() => result.current.undo());
    expect(result.current.value.title).toBe("first");
    act(() => result.current.redo());
    expect(result.current.value.title).toBe("second");
    act(() => result.current.undo());
    act(() => result.current.commit({ ...first, title: "third" }));
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.reset(first));
    expect(result.current.canUndo).toBe(false);
  });
});
