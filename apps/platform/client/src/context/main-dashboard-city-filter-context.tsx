import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type MainDashboardCityFilterContextValue = {
  selectedCity: string | null;
  setSelectedCity: (city: string | null) => void;
  toggleCity: (city: string) => void;
  clearCity: () => void;
};

const MainDashboardCityFilterContext = createContext<MainDashboardCityFilterContextValue | null>(null);

export function MainDashboardCityFilterProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const toggleCity = useCallback((city: string) => {
    setSelectedCity((prev) => (prev === city ? null : city));
  }, []);

  const clearCity = useCallback(() => setSelectedCity(null), []);

  const value = useMemo(
    () => ({ selectedCity, setSelectedCity, toggleCity, clearCity }),
    [selectedCity, toggleCity, clearCity],
  );

  return (
    <MainDashboardCityFilterContext.Provider value={value}>{children}</MainDashboardCityFilterContext.Provider>
  );
}

export function useMainDashboardCityFilter(): MainDashboardCityFilterContextValue {
  const ctx = useContext(MainDashboardCityFilterContext);
  if (!ctx) {
    throw new Error("useMainDashboardCityFilter must be used within MainDashboardCityFilterProvider");
  }
  return ctx;
}

/** Без провайдера — null (страницы вне дашборда). */
export function useMainDashboardCityFilterOptional(): MainDashboardCityFilterContextValue | null {
  return useContext(MainDashboardCityFilterContext);
}
