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
    expect(result.current.value.title).toBe("first");
    expect(result.current.canUndo).toBe(false);
  });

  it("preserves intermediate edits when React batches multiple commits", () => {
    const first = emptySnapshot("first");
    const { result } = renderHook(() => useHistory(first));

    // Both commits are queued before React renders again.
    act(() => {
      result.current.commit({ ...first, title: "second" });
      result.current.commit({ ...first, title: "third" });
    });
    expect(result.current.value.title).toBe("third");

    act(() => result.current.undo());
    expect(result.current.value.title).toBe("second");
    act(() => result.current.undo());
    expect(result.current.value.title).toBe("first");
    act(() => result.current.redo());
    expect(result.current.value.title).toBe("second");
    act(() => result.current.redo());
    expect(result.current.value.title).toBe("third");
  });

  it("never invents history on undo/redo of an empty timeline", () => {
    const first = emptySnapshot("first");
    const { result } = renderHook(() => useHistory(first));
    act(() => {
      result.current.undo();
      result.current.redo();
    });
    expect(result.current.value).toEqual(first);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
