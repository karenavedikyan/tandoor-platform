export type BrandBriefThemeMode = "light" | "dark";

export type BrandBriefTheme = {
  mode: BrandBriefThemeMode;
  bg: string;
  text: string;
  muted: string;
  accent: string;
  zebra: string;
  zebraAlt: string;
  plaque: string;
  border: string;
  ink: string;
};

export const BRIEF_VIEW_THEME_LS_KEY = "brief-view-theme";

export function readBriefViewTheme(): BrandBriefThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(BRIEF_VIEW_THEME_LS_KEY);
    return v === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function writeBriefViewTheme(mode: BrandBriefThemeMode): void {
  try {
    window.localStorage.setItem(BRIEF_VIEW_THEME_LS_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function brandBriefTheme(mode: BrandBriefThemeMode): BrandBriefTheme {
  if (mode === "dark") {
    return {
      mode: "dark",
      bg: "#0E0F12",
      text: "#F9FAFB",
      muted: "#9CA3AF",
      accent: "#B0CB1F",
      zebra: "#16181D",
      zebraAlt: "#1B1E24",
      plaque: "#1B1E24",
      border: "#2A2E36",
      ink: "#F9FAFB",
    };
  }
  return {
    mode: "light",
    bg: "#ffffff",
    text: "#222631",
    muted: "#6B7280",
    accent: "#9ACA3C",
    zebra: "#F3F4F6",
    zebraAlt: "#ffffff",
    plaque: "#E5E7EB",
    border: "#E5E7EB",
    ink: "#222631",
  };
}
