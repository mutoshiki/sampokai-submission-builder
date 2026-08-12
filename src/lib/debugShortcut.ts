import { useEffect, useRef } from "react";

/** Register per-webview developer controls once at shared app root. */
export function useDebugShortcut(onToggle: () => void, enabled: boolean) {
  const onToggleRef = useRef(onToggle);

  useEffect(() => {
    onToggleRef.current = onToggle;
  }, [onToggle]);

  useEffect(() => {
    if (!enabled) return;

    const toggleDebugControls = (event: KeyboardEvent) => {
      if (event.repeat || !event.ctrlKey || !event.shiftKey || event.code !== "KeyD") return;
      event.preventDefault();
      onToggleRef.current();
    };

    window.addEventListener("keydown", toggleDebugControls);
    return () => window.removeEventListener("keydown", toggleDebugControls);
  }, [enabled]);
}
