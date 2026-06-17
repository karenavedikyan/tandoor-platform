import { useCallback } from "react";
import { useLocation } from "wouter";
import {
  getInternalNavDepth,
  markNextNavigationAsReplace,
  saveScrollForCurrentLocation,
} from "../navigation/navigation-depth.js";
import { parentRouteFor } from "../navigation/route-hierarchy.js";

export function useSmartBack() {
  const [location, setLocation] = useLocation();

  const goBack = useCallback(
    (fallbackHref?: string) => {
      const depth = getInternalNavDepth();
      if (depth > 0) {
        saveScrollForCurrentLocation();
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
