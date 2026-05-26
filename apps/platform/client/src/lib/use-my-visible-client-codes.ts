import { useQuery } from "@tanstack/react-query";

export type MyVisibleCodesResponse =
  | { success: true; all: true; codes: null }
  | { success: true; all: false; codes: string[] }
  | { success: false; code: string; message?: string };

export type MyVisibleCodesResult = { all: boolean; codes: string[] | null };

async function fetchMyVisibleCodes(): Promise<MyVisibleCodesResult> {
  const res = await fetch("/api/auth/my-visible-codes", {
    method: "GET",
    credentials: "same-origin",
  });
  if (res.status === 401) {
    return { all: false, codes: [] };
  }
  const json = (await res.json()) as MyVisibleCodesResponse;
  if (!json.success) {
    return { all: false, codes: [] };
  }
  if (json.all) return { all: true, codes: null };
  return { all: false, codes: json.codes };
}

export function useMyVisibleClientCodes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["auth", "my-visible-codes"],
    queryFn: fetchMyVisibleCodes,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
}
