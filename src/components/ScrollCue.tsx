import { ChevronDown } from "@carbon/icons-react";
import { useEffect, useState } from "react";

interface ScrollCueState {
  visible: boolean;
}

export const getScrollCueState = (scrollHeight: number, viewportHeight: number, scrollTop: number): ScrollCueState => {
  const maxScroll = Math.max(0, scrollHeight - viewportHeight);
  const remaining = maxScroll - scrollTop;
  return {
    visible: maxScroll > 1 && remaining > 1,
  };
};

const isScrollable = (element: HTMLElement) => {
  const overflowY = window.getComputedStyle(element).overflowY;
  return /auto|scroll|overlay/.test(overflowY) && element.scrollHeight > element.clientHeight + 1;
};

const getScrollTarget = (): HTMLElement => {
  const content = document.querySelector<HTMLElement>(".main-content");
  if (content && isScrollable(content)) return content;

  let candidate = document.querySelector<HTMLElement>(".app-root");
  while (candidate) {
    if (isScrollable(candidate)) return candidate;
    candidate = candidate.parentElement;
  }

  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
};

export function ScrollCue() {
  const [state, setState] = useState<ScrollCueState>({ visible: false });

  useEffect(() => {
    const update = () => {
      const target = getScrollTarget();
      const isDocumentScroll = target === document.documentElement || target === document.body;
      const scrollHeight = isDocumentScroll
        ? Math.max(target.scrollHeight, document.documentElement.scrollHeight, document.body.scrollHeight)
        : target.scrollHeight;
      const viewportHeight = isDocumentScroll ? window.innerHeight : target.clientHeight;
      const scrollTop = isDocumentScroll ? window.scrollY : target.scrollTop;
      const next = getScrollCueState(scrollHeight, viewportHeight, scrollTop);
      setState((current) => (current.visible === next.visible ? current : next));
    };
    const observer = new ResizeObserver(update);
    const mutations = new MutationObserver(update);
    observer.observe(document.documentElement);
    observer.observe(document.body);
    const content = document.querySelector<HTMLElement>(".main-content");
    if (content) observer.observe(content);
    const appRoot = document.querySelector<HTMLElement>(".app-root");
    if (appRoot) observer.observe(appRoot);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    document.addEventListener("scroll", update, { capture: true, passive: true });
    update();
    const frame = window.requestAnimationFrame(update);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      document.removeEventListener("scroll", update, true);
    };
  }, []);

  if (!state.visible) return null;

  return (
    <div className="scroll-cue" aria-hidden="true">
      <ChevronDown size={16} />
    </div>
  );
}
