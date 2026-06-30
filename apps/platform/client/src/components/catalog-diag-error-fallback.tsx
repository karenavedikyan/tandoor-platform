import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reloadPageWithSchemaVersionBump } from "@/lib/schema-version-handshake";

type CatalogDiagErrorFallbackProps = {
  error: Error;
  componentStack?: string | null;
  onRetry?: () => void;
};

function truncateStack(stack: string | undefined, maxLines: number): string {
  if (!stack) return "(stack недоступен)";
  return stack.split("\n").slice(0, maxLines).join("\n");
}

export function CatalogDiagErrorFallback({
  error,
  componentStack,
  onRetry,
}: CatalogDiagErrorFallbackProps) {
  useEffect(() => {
    console.error("[catalog-diag]", error, componentStack ?? "");
  }, [error, componentStack]);

  return (
    <div
      className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8"
      data-testid="catalog-diag-error-fallback"
    >
      <div>
        <p className="text-lg font-semibold text-foreground">Диагностика каталога: ошибка рендера</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Режим diag-catalog. Ниже — реальное сообщение и стек для поиска причины.
        </p>
      </div>

      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-left">
        <p className="font-mono text-sm font-semibold text-destructive">
          {error.name}: {error.message}
        </p>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">error.stack</p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-3 font-mono text-xs">
          {truncateStack(error.stack, 30)}
        </pre>
      </div>

      {componentStack ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            componentStack
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-3 font-mono text-xs">
            {componentStack}
          </pre>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            Попробовать снова
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={reloadPageWithSchemaVersionBump}>
          Перезагрузить страницу
        </Button>
      </div>
    </div>
  );
}
