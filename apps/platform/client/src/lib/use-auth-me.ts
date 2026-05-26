import { useQuery } from "@tanstack/react-query";
import { me, type AuthUserDTO } from "@/lib/auth-api";

export type { AuthUserDTO as AuthMeUser } from "@/lib/auth-api";

export function useAuthMe() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async (): Promise<AuthUserDTO | null> => {
      try {
        return await me();
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
