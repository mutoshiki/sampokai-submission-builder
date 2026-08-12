/** @vitest-environment jsdom */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getScrollCueState, ScrollCue } from "./ScrollCue";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

const setViewport = (height: number) => Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
const setScrollTop = (value: number) => Object.defineProperty(window, "scrollY", { configurable: true, value });
const setScrollHeight = (value: number) => Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value });

beforeEach(() => {
  setViewport(800);
  setScrollTop(0);
  setScrollHeight(800);
});

afterEach(cleanup);

describe("scroll cue", () => {
  it("shows only when content remains below viewport", () => {
    expect(getScrollCueState(1200, 800, 0)).toEqual({ visible: true, quiet: false });
    expect(getScrollCueState(800, 800, 0)).toEqual({ visible: false, quiet: false });
    expect(getScrollCueState(1200, 800, 400)).toEqual({ visible: false, quiet: true });
  });

  it("hides after scrolling starts", () => {
    expect(getScrollCueState(1200, 800, 9)).toEqual({ visible: true, quiet: true });
  });

  it("updates for scroll position and viewport resizing", () => {
    setScrollHeight(1200);
    const { container } = render(<ScrollCue />);
    expect(container.querySelector(".scroll-cue")).not.toBeNull();

    setScrollTop(9);
    act(() => window.dispatchEvent(new Event("scroll")));
    expect(container.querySelector(".scroll-cue")).toBeNull();

    setScrollTop(0);
    setViewport(1200);
    act(() => window.dispatchEvent(new Event("resize")));
    expect(container.querySelector(".scroll-cue")).toBeNull();
  });
});
