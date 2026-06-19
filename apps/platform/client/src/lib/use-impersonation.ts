import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useStartImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await fetch("/api/auth/impersonate-start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string; code?: string };
      if (!res.ok || !json.success) throw new Error(json.message || json.code || "FAILED");
      return json;
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}

export function useStopImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/impersonate-stop", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as { success?: boolean; message?: string; code?: string };
      if (!res.ok || !json.success) throw new Error(json.message || json.code || "FAILED");
      return json;
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}
