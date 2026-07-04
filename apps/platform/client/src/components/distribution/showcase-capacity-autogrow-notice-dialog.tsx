import type { ReactElement } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  formatShowcaseCapacityAutoGrowLine,
  type ShowcaseCapacityGrownType,
} from "@/lib/showcase-capacity-autogrow-on-save";

type Props = {
  open: boolean;
  grownTypes: readonly ShowcaseCapacityGrownType[];
  onAcknowledge: () => void;
  onEditManually: () => void;
};

export function ShowcaseCapacityAutogrowNoticeDialog({
  open,
  grownTypes,
  onAcknowledge,
  onEditManually,
}: Props): ReactElement {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        className="max-w-lg border-amber-500/40"
        data-testid="dialog-showcase-capacity-autogrow-notice"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Ёмкость витрины увеличена автоматически</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Вы внесли больше витрин, чем есть в торговой точке по данному типу оборудования. Система
                автоматически увеличила ёмкость витрины. Если это ошибка — внесите точное количество вручную.
              </p>
              <ul className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-50/80 p-3 text-foreground dark:bg-amber-950/30">
                {grownTypes.map((row) => (
                  <li
                    key={row.type}
                    className="text-sm font-medium"
                    data-testid={`showcase-capacity-autogrow-row-${row.type}`}
                  >
                    {formatShowcaseCapacityAutoGrowLine(row)}
                  </li>
                ))}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel
            type="button"
            className="mt-0"
            data-testid="button-showcase-capacity-autogrow-ack"
            onClick={onAcknowledge}
          >
            Понятно
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            data-testid="button-showcase-capacity-autogrow-edit"
            onClick={onEditManually}
          >
            Внести вручную
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
