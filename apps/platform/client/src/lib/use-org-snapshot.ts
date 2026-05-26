import { useQuery } from "@tanstack/react-query";
import type { UserRole, UserStatus } from "@shared/auth";

export type OrgSnapshotMe = {
  id: string;
  role: UserRole;
  fullName: string;
  teamId: string | null;
};

export type OrgSnapshotTeam = {
  id: string;
  name: string;
  ropUserId: string | null;
  ropName: string | null;
};

export type OrgSnapshotUser = {
  id: string;
  fullName: string;
  role: UserRole;
  teamId: string | null;
  status: UserStatus;
};

export type OrgSnapshot = {
  me: OrgSnapshotMe;
  visibility: {
    all: boolean;
    clientCodes: string[] | null;
    teamIds: string[];
    visibleUserIds: string[];
  };
  teams: OrgSnapshotTeam[];
  users: OrgSnapshotUser[];
};

export function useOrgSnapshot(options?: { enabled?: boolean }) {
  return useQuery<OrgSnapshot | null>({
    queryKey: ["auth", "org-snapshot"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-org-snapshot", { credentials: "same-origin" });
      if (res.status === 401) return null;
      const json = (await res.json()) as { success?: boolean } & Partial<OrgSnapshot>;
      if (!json.success) return null;
      return json as OrgSnapshot;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
}
