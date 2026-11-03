import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// input-otp polls elementFromPoint to keep the caret in the active slot; jsdom
// has no layout, so the lookups resolve to nothing.
if (!document.elementFromPoint) {
  Object.defineProperty(document, "elementFromPoint", {
    writable: true,
    value: () => null,
  });
}

// Radix measures popovers and dialogs with ResizeObserver, which jsdom does not
// implement. A no-op observer is enough for the component tests that render them.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: ResizeObserverStub,
  });
}
