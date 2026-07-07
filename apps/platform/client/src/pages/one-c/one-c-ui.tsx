/**
 * Shared UI helpers for /1c/* showroom pages.
 */

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { Link } from "wouter";
import { Copy, Loader2, RefreshCw, Search } from "lucide-react";
import { BackNav } from "@/components/navigation/back-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { breadcrumbsFor, type BreadcrumbItem } from "@/lib/navigation/route-hierarchy";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const ONE_C_PAGE_LIMIT = 100;

export function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const s = String(value).trim();
  return s.length > 0 ? s : "—";
}

export function formatPlanSum(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

export function formatDiscount(code: string | null | undefined, percent: number | null | undefined): string {
  const parts: string[] = [];
  if (code?.trim()) parts.push(code.trim());
  if (percent !== null && percent !== undefined) parts.push(`${percent}%`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function useDebouncedSearch(delayMs = 300): {
  searchQ: string;
  setSearchQ: (q: string) => void;
  debouncedQ: string;
} {
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), delayMs);
    return () => clearTimeout(t);
  }, [searchQ, delayMs]);
  return { searchQ, setSearchQ, debouncedQ };
}

export function CopyField({
  label,
  value,
  mono = true,
  className,
}: {
  label?: string;
  value: string | null | undefined;
  mono?: boolean;
  className?: string;
}): ReactElement {
  const { toast } = useToast();
  const display = dash(value);

  async function onCopy() {
    if (!value?.trim()) return;
    try {
      await navigator.clipboard.writeText(value.trim());
      toast({ title: "Скопировано", description: label ?? value });
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className={cn("min-w-0 truncate", mono && display !== "—" ? "font-mono" : undefined)}>{display}</span>
      {value?.trim() ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={`Копировать ${label ?? ""}`}
          onClick={() => void onCopy()}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

export function OneCPageShell({
  path,
  breadcrumbLabels,
  title,
  subtitle,
  children,
  testId,
  actions,
}: {
  path: string;
  breadcrumbLabels?: Parameters<typeof breadcrumbsFor>[1];
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  testId: string;
  actions?: ReactNode;
}): ReactElement {
  const crumbs: BreadcrumbItem[] = breadcrumbsFor(path, breadcrumbLabels);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24 p-4 sm:p-6" data-testid={testId}>
      <BackNav breadcrumbs={crumbs} fallbackHref="/1c" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function OneCRefreshStubButton(): ReactElement {
  return (
    <Button type="button" variant="outline" size="sm" disabled className="gap-2" title="Скоро: синхронизация через VM runner">
      <RefreshCw className="h-4 w-4" />
      Обновить из 1С
    </Button>
  );
}

export function OneCOverviewSubtitle({ importedAt }: { importedAt: string | null | undefined }): ReactElement {
  const when = importedAt ? formatDisplayDateTime(importedAt) : "—";
  return <span>Данные из выгрузки 1С · обновлено {when}</span>;
}

export function OneCSearchInput({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  testId: string;
}): ReactElement {
  return (
    <div className="relative max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        data-testid={testId}
      />
    </div>
  );
}

export function OneCLoadingBlock(): ReactElement {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground" data-testid="one-c-loading">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Загрузка…
    </div>
  );
}

export function OneCStatCard({
  href,
  label,
  count,
  testId,
}: {
  href: string;
  label: string;
  count: number;
  testId: string;
}): ReactElement {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-colors hover:bg-muted/40" data-testid={testId}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tabular-nums">{count.toLocaleString("ru-RU")}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function OneCPagination({
  total,
  limit,
  offset,
  onOffsetChange,
  testIdPrefix,
}: {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  testIdPrefix: string;
}): ReactElement | null {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  const from = offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2" data-testid={`${testIdPrefix}-pagination`}>
      <p className="text-sm text-muted-foreground">
        {from}–{to} из {total.toLocaleString("ru-RU")}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={offset <= 0}
          data-testid={`${testIdPrefix}-prev`}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          Назад
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={offset + limit >= total}
          data-testid={`${testIdPrefix}-next`}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Вперёд
        </Button>
      </div>
    </div>
  );
}

export function OneCDetailSection({
  title,
  children,
  testId,
}: {
  title: string;
  children: ReactNode;
  testId?: string;
}): ReactElement {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function OneCOnlyActiveToggle({
  checked,
  onCheckedChange,
  testId,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  testId: string;
}): ReactElement {
  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <Switch id={`${testId}-switch`} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={`${testId}-switch`} className="text-sm font-normal">
        Только по действующим менеджерам
      </Label>
    </div>
  );
}

export function OneCFieldRow({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}
