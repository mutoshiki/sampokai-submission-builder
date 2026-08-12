import { ChevronDown } from "@carbon/icons-react";
import { useEffect, useState } from "react";

interface ScrollCueState {
  visible: boolean;
  quiet: boolean;
}

export const getScrollCueState = (scrollHeight: number, viewportHeight: number, scrollTop: number): ScrollCueState => {
  const maxScroll = Math.max(0, scrollHeight - viewportHeight);
  const remaining = maxScroll - scrollTop;
  return {
    visible: maxScroll > 1 && remaining > 1,
    quiet: scrollTop > 8,
  };
};

export function ScrollCue() {
  const [state, setState] = useState<ScrollCueState>({ visible: false, quiet: false });

  useEffect(() => {
    const update = () => {
      const root = document.documentElement;
      const next = getScrollCueState(root.scrollHeight, window.innerHeight, window.scrollY);
      setState((current) => (current.visible === next.visible && current.quiet === next.quiet ? current : next));
    };
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    observer.observe(document.body);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, []);

  if (!state.visible || state.quiet) return null;

  return (
    <div className="scroll-cue" aria-hidden="true">
      <ChevronDown size={16} />
    </div>
  );
}
