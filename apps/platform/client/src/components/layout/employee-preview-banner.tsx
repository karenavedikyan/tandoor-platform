import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStopEmployeePreview } from "@/lib/use-employee-preview";

export type EmployeePreviewBannerProps = {
  fullName: string;
  assignmentType: string | null;
  basis: string | null;
  confirmed: boolean;
  reason: string | null;
};

const ASSIGNMENT_LABELS: Record<string, string> = {
  head_of_sales: "РОП",
  responsible_manager: "Ответственный менеджер",
  regional_manager: "Региональный менеджер",
  hardware_manager: "Менеджер по фурнитуре",
};

export function EmployeePreviewBanner(props: EmployeePreviewBannerProps) {
  const stop = useStopEmployeePreview();
  const typeLabel = props.assignmentType ? (ASSIGNMENT_LABELS[props.assignmentType] ?? props.assignmentType) : "";

  return (
    <div
      className="border-b border-amber-500/40 bg-amber-50 px-4 py-2 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50"
      data-testid="banner-employee-preview"
      role="status"
    >
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">Предпросмотр сотрудника · {props.fullName}</p>
            <p className="text-xs opacity-90">
              {typeLabel ? `${typeLabel}. ` : ""}
              {props.basis ?? "Область сформирована на сервере по данным 1С. Только чтение."}
            </p>
            {!props.confirmed && props.reason ? (
              <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                Неподтверждённая область: {props.reason}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-600/40 bg-transparent"
          disabled={stop.isPending}
          onClick={() => void stop.mutateAsync()}
          data-testid="btn-employee-preview-stop"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Вернуться к admin
        </Button>
      </div>
    </div>
  );
}
