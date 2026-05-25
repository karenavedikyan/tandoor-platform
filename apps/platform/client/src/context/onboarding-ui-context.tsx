"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { OnboardingWizard } from "@/components/onboarding-wizard";

type OnboardingUiContextValue = {
  reopenOnboarding: () => void;
};

const OnboardingUiContext = createContext<OnboardingUiContextValue>({
  reopenOnboarding: () => {},
});

export function useOnboardingUi(): OnboardingUiContextValue {
  return useContext(OnboardingUiContext);
}

export function OnboardingUiProvider({ children }: { children: ReactNode }) {
  const [reopenTick, setReopenTick] = useState(0);
  const reopenOnboarding = useCallback(() => {
    setReopenTick((n) => n + 1);
  }, []);
  const value = useMemo(() => ({ reopenOnboarding }), [reopenOnboarding]);
  return (
    <OnboardingUiContext.Provider value={value}>
      {children}
      <OnboardingWizard reopenTick={reopenTick} />
    </OnboardingUiContext.Provider>
  );
}
