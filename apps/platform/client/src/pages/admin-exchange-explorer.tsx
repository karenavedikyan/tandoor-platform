/**
 * Admin: проводник HTTPS-директории обмена 1С (s3.toopatch.ru).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ExternalLink, File, FileText, Folder, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const S3_ORIGIN = "https://s3.toopatch.ru";

type ExchangeListItem = {
  name: string;
  type: "directory" | "file";
  href: string;
  sizeText: string | null;
  modifiedText: string | null;
};

type ExchangeListResponse = {
  success: boolean;
  base?: string;
  path?: string;
  url?: string;
  count?: number;
  items?: ExchangeListItem[];
  message?: string;
  code?: string;
};

function formatBytes(sizeText: string | null): string {
  if (!sizeText) return "—";
  const bytes = Number.parseInt(sizeText, 10);
  if (!Number.isFinite(bytes) || bytes < 0) return sizeText;
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function normalizeExplorerPath(path: string): string {
  const trimmed = path.trim() || "/";
  if (!trimmed.startsWith("/")) return `/${trimmed}`;
  return trimmed.replace(/\/+$/, "") || "/";
}

function pathFromItem(currentPath: string, item: ExchangeListItem): string {
  const href = item.href;
  const exchangePrefix = "/images/IMG/exchange";
  if (href.startsWith(exchangePrefix)) {
    const rest = href.slice(exchangePrefix.length).replace(/\/$/, "");
    return normalizeExplorerPath(rest || "/");
  }
  const joined = `${currentPath === "/" ? "" : currentPath}/${item.name}`;
  return normalizeExplorerPath(joined);
}

function resolveItemUrl(listingUrl: string | undefined, href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `${S3_ORIGIN}${href}`;
  if (listingUrl) return new URL(href, listingUrl.endsWith("/") ? listingUrl : `${listingUrl}/`).toString();
  return href;
}

function breadcrumbSegments(currentPath: string): { label: string; path: string }[] {
  const normalized = normalizeExplorerPath(currentPath);
  if (normalized === "/") return [{ label: "/", path: "/" }];
  const parts = normalized.split("/").filter(Boolean);
  const segments: { label: string; path: string }[] = [{ label: "/", path: "/" }];
  let acc = "";
  for (const part of parts) {
    acc += `/${part}`;
    segments.push({ label: part, path: acc });
  }
  return segments;
}

export default function AdminExchangeExplorerPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const [currentPath, setCurrentPath] = useState("/");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExchangeListItem[]>([]);
  const [listingUrl, setListingUrl] = useState<string | undefined>();

  const crumbs = useMemo(() => breadcrumbSegments(currentPath), [currentPath]);

  const loadListing = useCallback(
    async (path: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ path: normalizeExplorerPath(path) });
        const res = await fetch(`/api/admin/exchange-list?${qs.toString()}`, { credentials: "include" });
        const json = (await res.json()) as ExchangeListResponse;
        if (!res.ok || !json.success || !json.items) {
          toast({
            variant: "destructive",
            title: "Не удалось загрузить листинг",
            description: json.message ?? `HTTP ${res.status}`,
          });
          setItems([]);
          setListingUrl(undefined);
          return;
        }
        setItems(json.items);
        setListingUrl(json.url);
        setCurrentPath(normalizeExplorerPath(json.path ?? path));
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Ошибка запроса",
          description: e instanceof Error ? e.message : undefined,
        });
        setItems([]);
        setListingUrl(undefined);
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!isAdmin) return;
    void loadListing(currentPath);
  }, [isAdmin, currentPath, loadListing]);

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24 p-4 sm:p-6" data-testid="page-admin-exchange-explorer">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#222631]">Обмен 1С — файлы на s3.toopatch.ru</h1>
          <p className="mt-1 text-sm text-[#8F96B0]">
            HTTPS-листинг nginx autoindex в <code className="text-xs">/images/IMG/exchange/</code>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          data-testid="button-exchange-explorer-refresh"
          onClick={() => void loadListing(currentPath)}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden />}
          Обновить
        </Button>
      </div>

      <Card className="border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Путь</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-1 text-xs">
            {crumbs.map((crumb, index) => (
              <span key={crumb.path} className="inline-flex items-center gap-1">
                {index > 0 ? <span className="text-muted-foreground">/</span> : null}
                <button
                  type="button"
                  className={cn(
                    "rounded px-1 py-0.5 hover:bg-muted",
                    crumb.path === currentPath ? "font-semibold text-foreground" : "text-primary",
                  )}
                  data-testid={`breadcrumb-exchange-${index}`}
                  onClick={() => setCurrentPath(crumb.path)}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/70">
            <Table data-testid="table-exchange-explorer">
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead className="w-[120px]">Размер</TableHead>
                  <TableHead className="w-[220px]">Изменён</TableHead>
                  <TableHead className="w-[100px] text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Пусто
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const isXml = item.type === "file" && item.name.toLowerCase().endsWith(".xml");
                    const fileUrl = resolveItemUrl(listingUrl, item.href);
                    return (
                      <TableRow key={`${item.type}:${item.name}`} data-testid={`row-exchange-${item.name}`}>
                        <TableCell>
                          {item.type === "directory" ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 text-left font-medium text-primary hover:underline"
                              onClick={() => setCurrentPath(pathFromItem(currentPath, item))}
                            >
                              <Folder className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                              {item.name}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              {isXml ? (
                                <FileText className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                              ) : (
                                <File className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              )}
                              {item.name}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {item.type === "file" ? formatBytes(item.sizeText) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.modifiedText ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {item.type === "file" ? (
                            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                                {isXml ? "Открыть" : <ExternalLink className="h-4 w-4" aria-hidden />}
                              </a>
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/migrate">Каталог 1С: миграция</Link>
        </Button>
      </div>
    </div>
  );
}
