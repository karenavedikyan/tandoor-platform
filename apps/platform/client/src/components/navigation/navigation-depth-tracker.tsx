import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { onLocationChange, onPopState } from "@/lib/navigation/navigation-depth";

/** Подключается один раз в корне приложения для учёта глубины внутренней навигации. */
export function NavigationDepthTracker() {
  const [location] = useLocation();
  const isFirst = useRef(true);

  useEffect(() => {
    const handlePop = () => onPopState();
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      onLocationChange(location, true);
      return;
    }
    onLocationChange(location);
  }, [location]);

  return null;
}
