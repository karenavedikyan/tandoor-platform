"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type EquipmentContractDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string | null;
  /** Переопределение `data-testid` контента (например, для инфографики). */
  contentTestId?: string;
  /** Переопределение `data-testid` кнопки закрытия. */
  closeButtonTestId?: string;
  /** Краткий текст без пояснений о репозитории (инфографика). */
  shortCopy?: boolean;
};

export function EquipmentContractDialog({
  open,
  onOpenChange,
  equipmentId,
  contentTestId = "dialog-equipment-contract-placeholder",
  closeButtonTestId = "button-equipment-contract-close",
  shortCopy = false,
}: EquipmentContractDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid={contentTestId}>
        <DialogHeader>
          <DialogTitle>Документ договора</DialogTitle>
          <DialogDescription className="space-y-2">
            {shortCopy ? (
              <span>Документ будет доступен после подключения закрытого хранилища.</span>
            ) : (
              <span>
                Документ договора будет доступен после подключения закрытого хранилища. Подключение выполняется в защищённом
                контуре компании и не публикует файлы в открытый репозиторий.
              </span>
            )}
            {equipmentId ? (
              <span className="block font-mono text-sm text-foreground">Запись: {equipmentId}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" className="font-semibold" data-testid={closeButtonTestId} onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
