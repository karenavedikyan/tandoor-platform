import { useQuery } from "@tanstack/react-query";

export type MyClientCodesMeta = {
  role: string;
  userId: string;
  isAdmin: boolean;
  isDirector: boolean;
  isRop: boolean;
  isManager: boolean;
};

export type MyClientCodesResponse =
  | {
      success: true;
      ownCodes: string[];
      teamCodes: string[];
      responsibleByCode: Record<string, string>;
      grantedCodes: string[];
      meta: MyClientCodesMeta;
    }
  | { success: false; code: string; message?: string };

export type MyClientCodesData = {
  ownCodes: Set<string>;
  teamCodes: Set<string>;
  grantedCodes: Set<string>;
  responsibleByCode: Record<string, string>;
  meta: MyClientCodesMeta;
};

async function fetchMyClientCodes(): Promise<MyClientCodesData | null> {
  const res = await fetch("/api/clients/my-codes", {
    method: "GET",
    credentials: "same-origin",
  });
  if (res.status === 401) return null;
  const json = (await res.json()) as MyClientCodesResponse;
  if (!json.success) return null;
  return {
    ownCodes: new Set(json.ownCodes),
    teamCodes: new Set(json.teamCodes),
    grantedCodes: new Set(json.grantedCodes ?? []),
    responsibleByCode: json.responsibleByCode ?? {},
    meta: json.meta,
  };
}

export function useMyClientCodes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["my-client-codes"],
    queryFn: fetchMyClientCodes,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
}
