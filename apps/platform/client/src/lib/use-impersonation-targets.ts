import { useQuery } from "@tanstack/react-query";
import type { UserRole } from "@shared/auth";
import { listUsers } from "@/lib/admin-users-api";
import { userHas } from "@/lib/auth-rbac";

export type ImpersonationTarget = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

const TARGETS_QUERY_KEY = ["impersonation-targets", "active"] as const;

export function useImpersonationTargets(role: UserRole | null | undefined) {
  const canImpersonate = userHas(role, "users.impersonate");

  return useQuery({
    queryKey: TARGETS_QUERY_KEY,
    queryFn: async (): Promise<ImpersonationTarget[]> => {
      const r = await listUsers({ status: "active", limit: 500, offset: 0 });
      if (!r.ok) throw new Error(r.message);
      return r.result.users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
      }));
    },
    enabled: canImpersonate,
    staleTime: 60_000,
  });
}
