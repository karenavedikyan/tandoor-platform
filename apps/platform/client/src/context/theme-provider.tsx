import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyDarkClassToDocument,
  persistTandoorTheme,
  readTandoorThemeFromStorage,
  resolveDarkClass,
  TANDOOR_THEME_LS_KEY,
  type TandoorThemeChoice,
} from "@/lib/tandoor-theme";

export type TandoorResolvedAppearance = "light" | "dark";

type ThemeContextValue = {
  /** Сохранённый выбор пользователя. */
  theme: TandoorThemeChoice;
  /** Фактическое отображение после учёта system. */
  resolved: TandoorResolvedAppearance;
  setTheme: (t: TandoorThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<TandoorThemeChoice>(() => readTandoorThemeFromStorage());

  const resolved: TandoorResolvedAppearance = useMemo(
    () => (resolveDarkClass(theme) ? "dark" : "light"),
    [theme],
  );

  const setTheme = useCallback((t: TandoorThemeChoice) => {
    setThemeState(t);
    persistTandoorTheme(t);
    applyDarkClassToDocument(resolveDarkClass(t));
  }, []);

  useEffect(() => {
    applyDarkClassToDocument(resolveDarkClass(theme));
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyDarkClassToDocument(resolveDarkClass("system"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TANDOOR_THEME_LS_KEY) return;
      const next = readTandoorThemeFromStorage();
      setThemeState(next);
      applyDarkClassToDocument(resolveDarkClass(next));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
