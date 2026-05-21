/** Ключ localStorage для выбора темы (светлая / тёмная / как в системе). */
export const TANDOOR_THEME_LS_KEY = "tandoor-theme-v1";

export type TandoorThemeChoice = "light" | "dark" | "system";

export function parseTandoorThemeChoice(raw: string | null): TandoorThemeChoice | null {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return null;
}

export function readTandoorThemeFromStorage(): TandoorThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    return parseTandoorThemeChoice(localStorage.getItem(TANDOOR_THEME_LS_KEY)) ?? "system";
  } catch {
    return "system";
  }
}

export function prefersColorSchemeDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Нужно ли применить класс `dark` на корне документа. */
export function resolveDarkClass(theme: TandoorThemeChoice): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return prefersColorSchemeDark();
}

export function applyDarkClassToDocument(dark: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.tandoorTheme = dark ? "dark" : "light";
}

export function persistTandoorTheme(theme: TandoorThemeChoice): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TANDOOR_THEME_LS_KEY, theme);
  } catch {
    /* ignore */
  }
}
