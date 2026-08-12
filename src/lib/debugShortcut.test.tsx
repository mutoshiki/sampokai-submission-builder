// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDebugShortcut } from "./debugShortcut";

function DebugShortcutHarness({ enabled = true }: { enabled?: boolean }) {
  const [count, setCount] = useState(0);
  useDebugShortcut(() => setCount((current) => current + 1), enabled);
  return <output>{count}</output>;
}

function DebugShortcutListener({ onToggle }: { onToggle: () => void }) {
  useDebugShortcut(onToggle, true);
  return null;
}

describe("useDebugShortcut", () => {
  it("handles Ctrl+Shift+D once while mounted", () => {
    const { getByText } = render(<DebugShortcutHarness />);

    fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, code: "KeyD" });
    fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, code: "KeyD", repeat: true });

    expect(getByText("1")).toBeTruthy();
  });

  it("cleans up when unmounted", () => {
    const onToggle = vi.fn();
    const { unmount } = render(<DebugShortcutListener onToggle={onToggle} />);
    unmount();

    fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, code: "KeyD" });

    expect(onToggle).not.toHaveBeenCalled();
  });
});
