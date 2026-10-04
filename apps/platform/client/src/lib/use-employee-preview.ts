import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AUTH_ME_QUERY_KEY } from "../hooks/use-auth-user.js";
import { DEALER_BASE_ROWS_QUERY_KEY } from "./dealer-base-source.js";
import { myDealerScopeQueryKey } from "./dealers-my-scope-api.js";
import { orgScopeQueryKey } from "./dealers-org-scope-api.js";

export type EmployeePreviewStartInput = {
  employeeGuid: string;
  assignmentType: "head_of_sales" | "responsible_manager" | "regional_manager" | "hardware_manager";
};

export function useStartEmployeePreview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EmployeePreviewStartInput) => {
      const res = await fetch("/api/auth/employee-preview-start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await res.json()) as { success?: boolean; message?: string; code?: string };
      if (!res.ok || !body.success) {
        throw new Error(body.message ?? body.code ?? "Не удалось начать предпросмотр.");
      }
      return body;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: myDealerScopeQueryKey() }),
        qc.invalidateQueries({ queryKey: orgScopeQueryKey() }),
        qc.invalidateQueries({ queryKey: DEALER_BASE_ROWS_QUERY_KEY }),
      ]);
    },
  });
}

export function useStopEmployeePreview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/employee-preview-stop", {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !body.success) {
        throw new Error(body.message ?? "Не удалось завершить предпросмотр.");
      }
      return body;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: myDealerScopeQueryKey() }),
        qc.invalidateQueries({ queryKey: orgScopeQueryKey() }),
        qc.invalidateQueries({ queryKey: DEALER_BASE_ROWS_QUERY_KEY }),
      ]);
    },
  });
}
