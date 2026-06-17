import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-platform";
import type { DealerRow } from "@/lib/dealer-base-mock-data";

export function DealerCatalogLoadError({
  catalogQ,
  testId = "dealer-catalog-load-error",
}: {
  catalogQ: Pick<UseQueryResult<DealerRow[]>, "isError" | "refetch">;
  testId?: string;
}): ReactElement {
  return (
    <EmptyState
      title="Не удалось загрузить каталог клиентов"
      hint="Попробуйте обновить страницу или обратитесь к администратору."
      cta={
        <Button type="button" onClick={() => void catalogQ.refetch()}>
          Обновить
        </Button>
      }
      testId={testId}
    />
  );
}

export function DealerCatalogEmpty({
  testId = "dealer-catalog-empty",
}: {
  testId?: string;
}): ReactElement {
  return (
    <EmptyState
      title="Каталог пуст"
      hint="В базе ещё нет клиентов."
      testId={testId}
    />
  );
}
