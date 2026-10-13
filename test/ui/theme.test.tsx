import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { ModeToggle } from "@/components/mode-toggle";
import { ThemeProvider, themeStorageKey } from "@/components/theme-provider";

beforeEach(async () => {
  localStorage.clear();
  document.documentElement.classList.remove("light", "dark");
  await i18n.changeLanguage("en");
});
afterEach(() => vi.restoreAllMocks());

const show = () =>
  render(
    <ThemeProvider>
      <ModeToggle />
    </ThemeProvider>,
  );
async function select(name: string) {
  await userEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
  await userEvent.click(screen.getByRole("menuitemradio", { name }));
}

it("switches themes, marks the selected option and restores the choice on remount", async () => {
  const view = show();
  expect(document.documentElement.classList.contains("light")).toBe(true);
  await select("Dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(document.documentElement.classList.contains("light")).toBe(false);
  expect(localStorage.getItem(themeStorageKey)).toBe("dark");
  view.unmount();
  show();
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
  expect(
    screen
      .getByRole("menuitemradio", { name: "Dark" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  await userEvent.click(screen.getByRole("menuitemradio", { name: "Light" }));
  expect(document.documentElement.classList.contains("light")).toBe(true);
  expect(localStorage.getItem(themeStorageKey)).toBe("light");
});

it("follows system changes only when System is selected and removes the listener", async () => {
  let onChange = () => {};
  const media = {
    matches: true,
    addEventListener: vi.fn((_event, listener) => {
      onChange = listener;
    }),
    removeEventListener: vi.fn(),
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(
    media as unknown as MediaQueryList,
  );
  const view = show();
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await select("Light");
  act(() => {
    media.matches = false;
    onChange();
  });
  act(() => {
    media.matches = true;
    onChange();
  });
  expect(document.documentElement.classList.contains("light")).toBe(true);
  await select("System");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  act(() => {
    media.matches = false;
    onChange();
  });
  expect(document.documentElement.classList.contains("light")).toBe(true);
  expect(localStorage.getItem(themeStorageKey)).toBe("system");
  view.unmount();
  expect(media.removeEventListener).toHaveBeenCalledWith("change", onChange);
});

it("falls back for an invalid saved theme and still switches when storage is blocked", async () => {
  localStorage.setItem(themeStorageKey, "invalid");
  show();
  expect(document.documentElement.classList.contains("light")).toBe(true);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Blocked");
  });
  await select("Dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});
