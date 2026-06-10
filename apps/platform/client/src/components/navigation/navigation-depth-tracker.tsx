import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  onPopState,
  saveScrollForCurrentLocation,
  syncInAppLocation,
} from "@/lib/navigation/navigation-depth";

/** Подключается один раз в корне приложения для учёта глубины внутренней навигации. */
export function NavigationDepthTracker() {
  const [location] = useLocation();

  useEffect(() => {
    const onPop = () => {
      onPopState();
      syncInAppLocation();
    };
    const onHash = () => syncInAppLocation();

    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onHash);
    syncInAppLocation(true);

    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  useEffect(() => {
    syncInAppLocation();
  }, [location]);

  useEffect(() => {
    const onBeforeUnload = () => saveScrollForCurrentLocation();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return null;
}
