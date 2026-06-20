import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";

export function toastTrashMoveSuccess(opts: {
  title: string;
  onOpenTrash?: () => void;
}): void {
  toast({
    title: opts.title,
    description: "Хранятся 14 дней. Восстановить можно в разделе «Корзина».",
    action: opts.onOpenTrash ? (
      <ToastAction altText="Открыть корзину" onClick={opts.onOpenTrash}>
        Открыть корзину
      </ToastAction>
    ) : undefined,
  });
}

export function toastBulkTrashMoveResult(opts: {
  moved: number;
  skipped: number;
  onOpenTrash?: () => void;
  errorMessage?: string;
  ok: boolean;
}): void {
  if (!opts.ok) {
    toast({
      title: "Не удалось переместить в корзину",
      description: opts.errorMessage ?? "Ошибка запроса",
      variant: "destructive",
    });
    return;
  }

  const total = opts.moved + opts.skipped;
  const action = opts.onOpenTrash ? (
    <ToastAction altText="Открыть корзину" onClick={opts.onOpenTrash}>
      Открыть корзину
    </ToastAction>
  ) : undefined;

  if (opts.skipped > 0) {
    toast({
      title: `Перемещено ${opts.moved} из ${total}`,
      description: `Пропущено: ${opts.skipped} — нет прав на эти записи в вашей роли.`,
      action,
    });
    return;
  }

  toast({
    title: `Перемещено в корзину: ${opts.moved}`,
    description: "Хранятся 14 дней. Восстановить можно в разделе «Корзина».",
    action,
  });
}
