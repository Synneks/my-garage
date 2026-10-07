import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { i18nReady } from "@/i18n";

beforeAll(async () => {
  await i18nReady;
  window.scrollTo = vi.fn();
  window.matchMedia = vi
    .fn()
    .mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);
