import { createContext, useContext, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
export const themeStorageKey = "bandit-theme-v1";

const ThemeContext = createContext<
  | {
      theme: Theme;
      resolvedTheme: "light" | "dark";
      setTheme: (theme: Theme) => void;
    }
  | undefined
>(undefined);

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(themeStorageKey);
      return isTheme(stored) ? stored : "system";
    } catch {
      return "system";
    }
  });
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (value: Theme) => {
    try {
      localStorage.setItem(themeStorageKey, value);
    } catch {
      // Switching still works when browser storage is unavailable.
    }
    updateTheme(value);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
