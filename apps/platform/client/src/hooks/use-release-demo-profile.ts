import { useCallback, useEffect, useState } from "react";
import {
  loadReleaseDemoProfile,
  saveReleaseDemoProfile,
  RELEASE_DEMO_PROFILE_EVENT,
  type ReleaseDemoProfile,
} from "@/lib/release-demo-profile";

export function useReleaseDemoProfile(): {
  profile: ReleaseDemoProfile;
  setProfile: (p: ReleaseDemoProfile) => void;
  refresh: () => void;
} {
  const [profile, setProfileState] = useState<ReleaseDemoProfile>(() => loadReleaseDemoProfile());

  const refresh = useCallback(() => {
    setProfileState(loadReleaseDemoProfile());
  }, []);

  useEffect(() => {
    const onExt = () => refresh();
    window.addEventListener(RELEASE_DEMO_PROFILE_EVENT, onExt);
    window.addEventListener("storage", onExt);
    return () => {
      window.removeEventListener(RELEASE_DEMO_PROFILE_EVENT, onExt);
      window.removeEventListener("storage", onExt);
    };
  }, [refresh]);

  const setProfile = useCallback((p: ReleaseDemoProfile) => {
    saveReleaseDemoProfile(p);
    setProfileState(p);
  }, []);

  return { profile, setProfile, refresh };
}
