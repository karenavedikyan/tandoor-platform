import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { me } from "@/lib/auth-api";

export const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

export async function invalidateAuthUser(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: [...AUTH_ME_QUERY_KEY] });
}

export function useAuthUser(): {
  user: import("@/lib/auth-api").AuthUserDTO | null | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
  invalidate: () => Promise<void>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: me,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  return {
    user: q.data,
    isLoading: q.isPending,
    isError: q.isError,
    refetch: q.refetch,
    invalidate: () => invalidateAuthUser(qc),
  };
}
