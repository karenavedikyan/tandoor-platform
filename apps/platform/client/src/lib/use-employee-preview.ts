import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AUTH_ME_QUERY_KEY } from "../hooks/use-auth-user.js";
import { DEALER_BASE_ROWS_QUERY_KEY } from "./dealer-base-source.js";
import { myDealerScopeQueryKey } from "./dealers-my-scope-api.js";
import { orgScopeQueryKey } from "./dealers-org-scope-api.js";
import {
  fetchBootstrap,
  prewarmFromBootstrap,
  type EmployeePreviewBootstrap,
} from "./bootstrap-api.js";

export type EmployeePreviewStartInput = {
  employeeGuid: string;
  assignmentType:
    | "head_of_sales"
    | "responsible_manager"
    | "regional_manager"
    | "hardware_manager"
    | "store_manager";
};

type PreviewMutationResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  employee_preview?: EmployeePreviewBootstrap;
};

const PREVIEW_QUERY_KEY = ["auth", "employee-preview"] as const;
const BOOTSTRAP_QUERY_KEY = ["auth", "bootstrap"] as const;

let bootstrapRefreshGeneration = 0;

export function markBootstrapRefreshPending(): number {
  bootstrapRefreshGeneration += 1;
  return bootstrapRefreshGeneration;
}

async function refreshPreviewAndBootstrapCaches(
  qc: ReturnType<typeof useQueryClient>,
  generation: number,
): Promise<void> {
  await qc.cancelQueries({ queryKey: PREVIEW_QUERY_KEY });
  await qc.cancelQueries({ queryKey: BOOTSTRAP_QUERY_KEY });

  const bootstrap = await fetchBootstrap();
  if (generation !== bootstrapRefreshGeneration) return;

  if (bootstrap) {
    prewarmFromBootstrap(qc, bootstrap);
    return;
  }

  const previous = qc.getQueryData<EmployeePreviewBootstrap>(PREVIEW_QUERY_KEY);
  if (previous?.active) {
    qc.setQueryData(PREVIEW_QUERY_KEY, {
      ...previous,
      error: {
        code: "BOOTSTRAP_UNAVAILABLE",
        message: "Не удалось обновить bootstrap. Режим предпросмотра на сервере может оставаться активным.",
      },
    });
  }
}

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
      const body = (await res.json()) as PreviewMutationResponse;
      if (!res.ok || !body.success) {
        throw new Error(body.message ?? body.code ?? "Не удалось начать предпросмотр.");
      }
      return body;
    },
    onSuccess: async (body) => {
      if (body.employee_preview) {
        qc.setQueryData(PREVIEW_QUERY_KEY, body.employee_preview);
      }
      const generation = markBootstrapRefreshPending();
      await Promise.all([
        qc.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: myDealerScopeQueryKey() }),
        qc.invalidateQueries({ queryKey: orgScopeQueryKey() }),
        qc.invalidateQueries({ queryKey: DEALER_BASE_ROWS_QUERY_KEY }),
        refreshPreviewAndBootstrapCaches(qc, generation),
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
      const body = (await res.json()) as PreviewMutationResponse;
      if (!res.ok || !body.success) {
        throw new Error(body.message ?? "Не удалось завершить предпросмотр.");
      }
      return body;
    },
    onSuccess: async (body) => {
      if (body.employee_preview) {
        qc.setQueryData(PREVIEW_QUERY_KEY, body.employee_preview);
      }
      const generation = markBootstrapRefreshPending();
      await Promise.all([
        qc.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: myDealerScopeQueryKey() }),
        qc.invalidateQueries({ queryKey: orgScopeQueryKey() }),
        qc.invalidateQueries({ queryKey: DEALER_BASE_ROWS_QUERY_KEY }),
        refreshPreviewAndBootstrapCaches(qc, generation),
      ]);
    },
  });
}
