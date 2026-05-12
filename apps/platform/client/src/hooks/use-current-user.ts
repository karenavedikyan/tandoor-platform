import { useMockAuth } from "@/hooks/use-mock-auth";

/** Текущий пользователь mock-auth (роль и персона из sales-control). */
export function useCurrentUser() {
  const a = useMockAuth();
  return {
    user: a.user,
    session: a.session,
    isAuthenticated: a.isAuthenticated,
    login: a.login,
    logout: a.logout,
  };
}
