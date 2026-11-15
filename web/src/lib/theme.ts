export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "etd.theme.v1";

export function resolveInitialTheme(
  stored: string | null,
  prefersDark: boolean,
): ThemeMode {
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return prefersDark ? "dark" : "light";
}

export function nextTheme(current: ThemeMode): ThemeMode {
  return current === "light" ? "dark" : "light";
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures in restricted contexts.
    }
  }
}

export function readCurrentTheme(): ThemeMode {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.theme;
    if (attr === "dark" || attr === "light") {
      return attr;
    }
  }
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      const prefersDark = window.matchMedia?.(
        "(prefers-color-scheme: dark)",
      ).matches;
      return resolveInitialTheme(stored, Boolean(prefersDark));
    } catch {
      return "light";
    }
  }
  return "light";
}
