import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadMockAuthSession,
  loginWithCredentials,
  logoutMockAuth,
  MOCK_AUTH_CHANGED_EVENT,
  type MockAuthSession,
} from "@/lib/mock-auth";
import { getSalesUserById, type SalesUser } from "@/lib/sales-control-data";

export function useMockAuth(): {
  session: MockAuthSession | null;
  user: SalesUser | undefined;
  isAuthenticated: boolean;
  login: (username: string, password: string) => ReturnType<typeof loginWithCredentials>;
  logout: () => void;
  refresh: () => void;
} {
  const [session, setSession] = useState<MockAuthSession | null>(() => loadMockAuthSession());

  const refresh = useCallback(() => {
    setSession(loadMockAuthSession());
  }, []);

  useEffect(() => {
    const on = () => refresh();
    window.addEventListener(MOCK_AUTH_CHANGED_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(MOCK_AUTH_CHANGED_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, [refresh]);

  const user = useMemo(() => {
    if (!session?.userId) return undefined;
    return getSalesUserById(session.userId);
  }, [session]);

  const login = useCallback((username: string, password: string) => {
    const r = loginWithCredentials(username, password);
    if (r.ok) refresh();
    return r;
  }, [refresh]);

  const logout = useCallback(() => {
    logoutMockAuth();
    refresh();
  }, [refresh]);

  return {
    session,
    user,
    isAuthenticated: Boolean(session && user),
    login,
    logout,
    refresh,
  };
}
