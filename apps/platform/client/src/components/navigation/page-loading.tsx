import { Card, CardContent } from "@/components/ui/card";

/** Лёгкий fallback при lazy-загрузке страниц и тяжёлых секций. */
export function PageLoadingFallback() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8" data-testid="page-loading-fallback">
      <Card className="border-border/70 shadow-xs">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="h-9 w-9 animate-pulse rounded-full bg-primary/20" aria-hidden />
          <p className="text-sm font-medium text-muted-foreground">Загрузка раздела…</p>
        </CardContent>
      </Card>
    </div>
  );
}
