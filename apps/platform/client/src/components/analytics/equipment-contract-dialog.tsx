"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type EquipmentContractDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string | null;
};

export function EquipmentContractDialog({ open, onOpenChange, equipmentId }: EquipmentContractDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-equipment-contract-placeholder">
        <DialogHeader>
          <DialogTitle>Документ договора</DialogTitle>
          <DialogDescription>
            Документ договора будет доступен после подключения закрытого хранилища.
            {equipmentId ? (
              <>
                {" "}
                <span className="font-mono text-foreground">Запись: {equipmentId}</span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" className="font-semibold" data-testid="button-equipment-contract-close" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
