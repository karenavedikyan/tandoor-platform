import { useQueryClient } from "@tanstack/react-query";
import { logout as apiLogout } from "@/lib/auth-api";
import { invalidateAuthUser, useAuthUser } from "@/hooks/use-auth-user";

/**
 * Текущий пользователь с сервера (`GET /api/auth/me`, HttpOnly cookie).
 */
export function useCurrentUser(): {
  user: import("@/lib/auth-api").AuthUserDTO | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
  logout: () => Promise<void>;
} {
  const qc = useQueryClient();
  const { user, isLoading, isError, refetch } = useAuthUser();

  const isAuthenticated = !!user && user.status === "active";

  const logout = async (): Promise<void> => {
    await apiLogout();
    await invalidateAuthUser(qc);
    const next = new URL(window.location.href);
    next.hash = "#/login";
    window.location.assign(next.toString());
  };

  return {
    user: user === null ? undefined : user,
    isAuthenticated,
    isLoading,
    isError,
    refetch,
    logout,
  };
}

export { displayUserName } from "@/lib/auth-api";
export { invalidateAuthUser } from "@/hooks/use-auth-user";
