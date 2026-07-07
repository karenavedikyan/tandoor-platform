/**
 * /admin/exchange-stores — shadow-таблица торговых точек из 1С.
 */

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Link2,
  Ban,
  RotateCcw,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type StoreStatus = "new" | "linked" | "ignored" | "created";

type ExchangeStoreItem = {
  id_1c: string;
  name: string;
  address: string | null;
  legal_entity_1c: string | null;
  manager_1c: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  status: StoreStatus;
  linked_trade_point_id: string | null;
  linked_trade_point_name: string | null;
  linked_dealer_id: string | null;
  linked_at: string | null;
  linked_by: string | null;
  imported_at: string;
  match_candidates_count: number;
};

type ListResponse = {
  success: boolean;
  total?: number;
  counts?: Record<StoreStatus, number>;
  items?: ExchangeStoreItem[];
  message?: string;
};

type Candidate = {
  trade_point_id: string;
  name: string;
  address: string | null;
  dealer_name: string;
  dealer_id: string;
  similarity_name: number;
  similarity_address: number;
  combined_score: number;
};

const STATUS_LABELS: Record<StoreStatus, string> = {
  new: "Новая",
  linked: "Связана",
  ignored: "Игнор",
  created: "Создана",
};

const STATUS_VARIANT: Record<StoreStatus, "default" | "secondary" | "outline" | "destructive"> = {
  new: "secondary",
  linked: "default",
  ignored: "outline",
  created: "default",
};

function shortUuid(id: string | null): string {
  if (!id) return "—";
  return id.slice(0, 8);
}

function formatImportedAt(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru });
  } catch {
    return iso;
  }
}

function tradePointHref(item: ExchangeStoreItem): string | null {
  if (!item.linked_trade_point_id || !item.linked_dealer_id) return null;
  return `/dealers/${item.linked_dealer_id}/trade-points/${item.linked_trade_point_id}`;
}

export default function AdminExchangeStoresPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const [statusTab, setStatusTab] = useState<StoreStatus | "all">("all");
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExchangeStoreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<StoreStatus, number>>({
    new: 0,
    linked: 0,
    ignored: 0,
    created: 0,
  });

  const [importing, setImporting] = useState(false);
  const [autoLinking, setAutoLinking] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Record<string, Candidate[]>>({});
  const [candidatesLoading, setCandidatesLoading] = useState<string | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualStoreId, setManualStoreId] = useState<string | null>(null);
  const [manualQ, setManualQ] = useState("");
  const [manualResults, setManualResults] = useState<Candidate[]>([]);
  const [manualSearching, setManualSearching] = useState(false);

  const [createStubOpen, setCreateStubOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        status: statusTab,
        limit: String(limit),
        offset: String(offset),
      });
      if (debouncedQ) qs.set("q", debouncedQ);
      const res = await fetch(`/api/admin/exchange-stores?${qs.toString()}`, { credentials: "include" });
      const json = (await res.json()) as ListResponse;
      if (!json.success) {
        toast({ title: "Ошибка", description: json.message ?? "Не удалось загрузить список.", variant: "destructive" });
        return;
      }
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
      if (json.counts) setCounts(json.counts);
    } catch (e) {
      toast({
        title: "Ошибка сети",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [statusTab, debouncedQ, offset, toast]);

  useEffect(() => {
    if (user?.role === "admin") void loadList();
  }, [user?.role, loadList]);

  useEffect(() => {
    setOffset(0);
  }, [statusTab, debouncedQ]);

  const metricsLine = useMemo(() => {
    const all = counts.new + counts.linked + counts.ignored + counts.created;
    return `Total ${all} · New ${counts.new} · Linked ${counts.linked} · Ignored ${counts.ignored} · Created ${counts.created}`;
  }, [counts]);

  async function runImport() {
    setImporting(true);
    try {
      const res = await fetch("/api/admin/sync-exchange-stores", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        success: boolean;
        total?: number;
        inserted?: number;
        updated?: number;
        unchanged?: number;
        skipped_locked?: number;
        durationMs?: number;
        message?: string;
      };
      if (!json.success) {
        toast({ title: "Импорт не удался", description: json.message, variant: "destructive" });
        return;
      }
      toast({
        title: "Импорт завершён",
        description: `${json.total} записей · +${json.inserted} новых · ${json.updated} обновлено · ${json.durationMs}ms`,
      });
      await loadList();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  async function runAutoLink() {
    setAutoLinking(true);
    try {
      const res = await fetch("/api/admin/exchange-stores/auto-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        success: boolean;
        linked_count?: number;
        ambiguous_count?: number;
        unmatched_count?: number;
        message?: string;
      };
      if (!json.success) {
        toast({ title: "Автосвязка не удалась", description: json.message, variant: "destructive" });
        return;
      }
      toast({
        title: "Автосвязка завершена",
        description: `Связано: ${json.linked_count}, неоднозначно: ${json.ambiguous_count}, без пары: ${json.unmatched_count}`,
      });
      await loadList();
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    } finally {
      setAutoLinking(false);
    }
  }

  async function loadCandidates(id1c: string) {
    if (expandedId === id1c) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id1c);
    if (candidates[id1c]) return;
    setCandidatesLoading(id1c);
    try {
      const res = await fetch(
        `/api/admin/exchange-stores/candidates?id_1c=${encodeURIComponent(id1c)}`,
        { credentials: "include" },
      );
      const json = (await res.json()) as { success: boolean; candidates?: Candidate[] };
      if (json.success && json.candidates) {
        setCandidates((prev) => ({ ...prev, [id1c]: json.candidates! }));
      }
    } finally {
      setCandidatesLoading(null);
    }
  }

  async function postAction(id1c: string, action: "link" | "ignore" | "reset", tradePointId?: string) {
    const res = await fetch("/api/admin/exchange-stores/action", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_1c: id1c, action, trade_point_id: tradePointId }),
    });
    const json = (await res.json()) as { success: boolean; message?: string };
    if (!json.success) {
      toast({ title: "Действие не выполнено", description: json.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Готово", description: `Действие «${action}» применено.` });
    setExpandedId(null);
    setManualOpen(false);
    await loadList();
    return true;
  }

  async function searchManual() {
    if (manualQ.trim().length < 2) return;
    setManualSearching(true);
    try {
      const res = await fetch(
        `/api/admin/exchange-stores/search-trade-points?q=${encodeURIComponent(manualQ.trim())}`,
        { credentials: "include" },
      );
      const json = (await res.json()) as {
        success: boolean;
        items?: Array<{
          trade_point_id: string;
          name: string;
          address: string | null;
          dealer_name: string;
          dealer_id: string;
        }>;
      };
      if (json.success && json.items) {
        setManualResults(
          json.items.map((r) => ({
            ...r,
            similarity_name: 0,
            similarity_address: 0,
            combined_score: 0,
          })),
        );
      }
    } finally {
      setManualSearching(false);
    }
  }

  if (user && user.role !== "admin") {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Доступ только для администратора.</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Торговые точки из 1С</CardTitle>
              <CardDescription className="mt-1">
                Shadow-таблица <code className="text-xs">exchange_stores_raw</code> — связывание с боевыми ТТ без
                автозаписи.
              </CardDescription>
              <p className="mt-2 text-sm text-muted-foreground">{metricsLine}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void runImport()} disabled={importing}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Обновить импорт
              </Button>
              <Button variant="secondary" onClick={() => void runAutoLink()} disabled={autoLinking}>
                {autoLinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Автосвязать по точному совпадению
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/exchange-explorer">Проводник обмена</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Tabs
                value={statusTab}
                onValueChange={(v) => setStatusTab(v as StoreStatus | "all")}
              >
                <TabsList>
                  <TabsTrigger value="all">Все</TabsTrigger>
                  <TabsTrigger value="new">Новые</TabsTrigger>
                  <TabsTrigger value="linked">Связаны</TabsTrigger>
                  <TabsTrigger value="ignored">Игнор</TabsTrigger>
                  <TabsTrigger value="created">Созданы</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Поиск по названию или адресу"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Загрузка…
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Название 1С</TableHead>
                        <TableHead>Адрес 1С</TableHead>
                        <TableHead>Менеджер</TableHead>
                        <TableHead>Юрлицо 1С</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Связано с</TableHead>
                        <TableHead>Импорт</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                            Нет записей. Нажмите «Обновить импорт».
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => {
                          const tpLink = tradePointHref(item);
                          const isExpanded = expandedId === item.id_1c;
                          return (
                            <Fragment key={item.id_1c}>
                              <TableRow>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => void loadCandidates(item.id_1c)}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TableCell>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                  {item.address || "—"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {item.manager_name ? (
                                    <>
                                      {item.manager_name}
                                      {item.manager_phone ? (
                                        <span className="block text-xs text-muted-foreground">{item.manager_phone}</span>
                                      ) : null}
                                    </>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.legal_entity_1c ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help font-mono text-xs">{shortUuid(item.legal_entity_1c)}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>{item.legal_entity_1c}</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                                  {item.match_candidates_count > 0 && item.status === "new" ? (
                                    <span className="ml-1 text-xs text-muted-foreground">
                                      ({item.match_candidates_count})
                                    </span>
                                  ) : null}
                                </TableCell>
                                <TableCell>
                                  {tpLink && item.linked_trade_point_name ? (
                                    <Link href={tpLink} className="text-sm text-primary hover:underline">
                                      {item.linked_trade_point_name}
                                    </Link>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {formatImportedAt(item.imported_at)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void loadCandidates(item.id_1c)}
                                    >
                                      Кандидаты
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setManualStoreId(item.id_1c);
                                        setManualQ(item.name);
                                        setManualResults([]);
                                        setManualOpen(true);
                                      }}
                                    >
                                      Ручной поиск
                                    </Button>
                                    {item.status === "new" ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void postAction(item.id_1c, "ignore")}
                                      >
                                        <Ban className="mr-1 h-3 w-3" />
                                        Игнор
                                      </Button>
                                    ) : null}
                                    {item.status !== "new" ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void postAction(item.id_1c, "reset")}
                                      >
                                        <RotateCcw className="mr-1 h-3 w-3" />
                                        Сбросить
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled
                                      title="TODO: отдельный этап"
                                      onClick={() => setCreateStubOpen(true)}
                                    >
                                      <Plus className="mr-1 h-3 w-3" />
                                      Создать ТТ
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {isExpanded ? (
                                <TableRow key={`${item.id_1c}-candidates`}>
                                  <TableCell colSpan={9} className="bg-muted/30 p-4">
                                    {candidatesLoading === item.id_1c ? (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Загрузка кандидатов…
                                      </div>
                                    ) : (candidates[item.id_1c] ?? []).length === 0 ? (
                                      <p className="text-sm text-muted-foreground">Кандидаты не найдены.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {(candidates[item.id_1c] ?? []).map((c) => (
                                          <div
                                            key={c.trade_point_id}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background p-2 text-sm"
                                          >
                                            <div>
                                              <span className="font-medium">{c.name}</span>
                                              <span className="mx-2 text-muted-foreground">·</span>
                                              <span className="text-muted-foreground">{c.address || "—"}</span>
                                              <span className="mx-2 text-muted-foreground">·</span>
                                              <span>{c.dealer_name}</span>
                                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                                score {(c.combined_score * 100).toFixed(0)}%
                                              </span>
                                            </div>
                                            <Button
                                              size="sm"
                                              onClick={() =>
                                                void postAction(item.id_1c, "link", c.trade_point_id)
                                              }
                                            >
                                              Связать
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Страница {currentPage} из {totalPages} ({total} записей)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={offset === 0}
                      onClick={() => setOffset((o) => Math.max(0, o - limit))}
                    >
                      Назад
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={offset + limit >= total}
                      onClick={() => setOffset((o) => o + limit)}
                    >
                      Вперёд
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ручной поиск торговой точки</DialogTitle>
              <DialogDescription>Найдите боевую ТТ и свяжите с записью 1С.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                value={manualQ}
                onChange={(e) => setManualQ(e.target.value)}
                placeholder="Название, адрес или дилер"
                onKeyDown={(e) => e.key === "Enter" && void searchManual()}
              />
              <Button onClick={() => void searchManual()} disabled={manualSearching}>
                {manualSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Найти"}
              </Button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {manualResults.map((r) => (
                <div
                  key={r.trade_point_id}
                  className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.address || "—"} · {r.dealer_name}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => manualStoreId && void postAction(manualStoreId, "link", r.trade_point_id)}
                  >
                    Связать
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={createStubOpen} onOpenChange={setCreateStubOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать боевую ТТ</DialogTitle>
              <DialogDescription>
                Функция будет реализована в отдельном этапе. Пока используйте «Связать» с существующей торговой точкой.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setCreateStubOpen(false)}>Понятно</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
