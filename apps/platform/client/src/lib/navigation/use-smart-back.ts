import { useCallback } from "react";
import { useLocation } from "wouter";
import { getInternalNavDepth, markNextNavigationAsReplace } from "@/lib/navigation/navigation-depth";
import { parentRouteFor } from "@/lib/navigation/route-hierarchy";

export function useSmartBack() {
  const [location, setLocation] = useLocation();

  const goBack = useCallback(
    (fallbackHref?: string) => {
      const depth = getInternalNavDepth();
      if (depth > 0 && window.history.length > 1) {
        window.history.back();
        return;
      }
      const target = fallbackHref ?? parentRouteFor(location);
      markNextNavigationAsReplace();
      setLocation(target, { replace: true });
    },
    [location, setLocation],
  );

  return { goBack, currentPath: location };
}
