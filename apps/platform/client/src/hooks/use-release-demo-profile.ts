import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadReleaseDemoProfile,
  saveReleaseDemoProfile,
  RELEASE_DEMO_PROFILE_EVENT,
  type ReleaseDemoProfile,
} from "@/lib/release-demo-profile";
import { useAuthUser } from "@/hooks/use-auth-user";

export function useReleaseDemoProfile(): {
  profile: ReleaseDemoProfile;
  setProfile: (p: ReleaseDemoProfile) => void;
  refresh: () => void;
} {
  const { user } = useAuthUser();
  const userRef = useRef(user);
  userRef.current = user;

  const [profile, setProfileState] = useState<ReleaseDemoProfile>(() => loadReleaseDemoProfile(user?.role));

  const refresh = useCallback(() => {
    setProfileState(loadReleaseDemoProfile(userRef.current?.role));
  }, []);

  useEffect(() => {
    setProfileState(loadReleaseDemoProfile(user?.role));
  }, [user?.role, user?.id]);

  useEffect(() => {
    const onExt = () => setProfileState(loadReleaseDemoProfile(userRef.current?.role));
    window.addEventListener(RELEASE_DEMO_PROFILE_EVENT, onExt);
    window.addEventListener("storage", onExt);
    return () => {
      window.removeEventListener(RELEASE_DEMO_PROFILE_EVENT, onExt);
      window.removeEventListener("storage", onExt);
    };
  }, []);

  const setProfile = useCallback(
    (p: ReleaseDemoProfile) => {
      saveReleaseDemoProfile(p, !!(user && user.status === "active"));
      setProfileState(p);
    },
    [user],
  );

  return { profile, setProfile, refresh };
}
