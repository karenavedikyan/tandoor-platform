import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import {
  ANALYTICS_WORKSPACE_TAB_META,
  getRowsForTab,
  loadAnalyticsWorkspaceStore,
  saveAnalyticsWorkspaceStore,
  type AnalyticsWorkspaceRow,
  type AnalyticsWorkspaceTabId,
} from "@/lib/analytics-workspace-data";
import {
  getRopOptions,
  isRopOrManagerAllFilter,
  managerDisplayBelongsToRopTeam,
} from "@/lib/rop-manager-filters";
import { cn } from "@/lib/utils";

const ALL = "__all__";

function uniq(vals: string[]): string[] {
  return Array.from(new Set(vals)).sort((a, b) => a.localeCompare(b, "ru"));
}

function persistTab(tab: AnalyticsWorkspaceTabId, rows: AnalyticsWorkspaceRow[]) {
  const prev = loadAnalyticsWorkspaceStore();
  saveAnalyticsWorkspaceStore({ tabs: { ...prev.tabs, [tab]: rows } });
}

function TabTable({
  tab,
  meta,
}: {
  tab: AnalyticsWorkspaceTabId;
  meta: (typeof ANALYTICS_WORKSPACE_TAB_META)[number];
}) {
  const [rows, setRows] = useState<AnalyticsWorkspaceRow[]>(() => getRowsForTab(tab));
  const [mgr, setMgr] = useState(ALL);
  const [rop, setRop] = useState(ALL);
  const [client, setClient] = useState(ALL);
  const [cat, setCat] = useState(ALL);
  const [city, setCity] = useState(ALL);

  useEffect(() => {
    setRows(getRowsForTab(tab));
  }, [tab]);

  const managers = useMemo(() => {
    const names = uniq(rows.map((r) => r.manager));
    if (isRopOrManagerAllFilter(rop)) return names;
    return names.filter((n) => managerDisplayBelongsToRopTeam(n, rop));
  }, [rows, rop]);
  const clients = useMemo(() => uniq(rows.map((r) => r.client)), [rows]);
  const cats = useMemo(() => uniq(rows.map((r) => r.clientCategory)), [rows]);
  const cities = useMemo(() => uniq(rows.map((r) => r.city)), [rows]);

  useEffect(() => {
    if (mgr === ALL) return;
    if (!isRopOrManagerAllFilter(rop) && !managerDisplayBelongsToRopTeam(mgr, rop)) setMgr(ALL);
  }, [rop, mgr]);

  const filtered = useMemo(() => {
    return rows.filter(
      (r) =>
        (isRopOrManagerAllFilter(rop) || managerDisplayBelongsToRopTeam(r.manager, rop)) &&
        (mgr === ALL || r.manager === mgr) &&
        (client === ALL || r.client === client) &&
        (cat === ALL || r.clientCategory === cat) &&
        (city === ALL || r.city === city),
    );
  }, [rows, mgr, client, cat, city, rop]);

  const patch = useCallback(
    (id: string, field: keyof AnalyticsWorkspaceRow, value: string) => {
      setRows((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, [field]: value } : r));
        persistTab(tab, next);
        return next;
      });
    },
    [tab],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Город</Label>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="h-10 min-w-0">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все</SelectItem>
              {cities.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Категория клиента</Label>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-10 min-w-0">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все</SelectItem>
              {cats.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Клиент</Label>
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger className="h-10 min-w-0">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все</SelectItem>
              {clients.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">РОП</Label>
          <Select value={rop} onValueChange={setRop}>
            <SelectTrigger className="h-10 min-w-0" data-testid="select-analytics-workspace-rop">
              <SelectValue placeholder="Все РОПы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все РОПы</SelectItem>
              {getRopOptions().map((o) => (
                <SelectItem key={o.teamId} value={o.teamId}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Менеджер</Label>
          <Select value={mgr} onValueChange={setMgr}>
            <SelectTrigger className="h-10 min-w-0" data-testid="select-analytics-workspace-manager">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все менеджеры</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">Менеджер</TableHead>
              <TableHead className="min-w-[120px]">Клиент</TableHead>
              <TableHead className="min-w-[90px]">Категория</TableHead>
              <TableHead className="min-w-[100px]">Город</TableHead>
              <TableHead className="min-w-[100px]">{meta.h1}</TableHead>
              <TableHead className="min-w-[100px]">{meta.h2}</TableHead>
              <TableHead className="min-w-[100px]">{meta.h3}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="p-1">
                  <Input className="h-9 min-w-[96px] text-xs" value={r.manager} onChange={(e) => patch(r.id, "manager", e.target.value)} />
                </TableCell>
                <TableCell className="p-1">
                  <Input className="h-9 min-w-[110px] text-xs" value={r.client} onChange={(e) => patch(r.id, "client", e.target.value)} />
                </TableCell>
                <TableCell className="p-1">
                  <Input className="h-9 min-w-[80px] text-xs" value={r.clientCategory} onChange={(e) => patch(r.id, "clientCategory", e.target.value)} />
                </TableCell>
                <TableCell className="p-1">
                  <Input className="h-9 min-w-[90px] text-xs" value={r.city} onChange={(e) => patch(r.id, "city", e.target.value)} />
                </TableCell>
                <TableCell className="p-1">
                  <Input className="h-9 min-w-[88px] text-xs" value={r.v1} onChange={(e) => patch(r.id, "v1", e.target.value)} />
                </TableCell>
                <TableCell className="p-1">
                  <Input className="h-9 min-w-[88px] text-xs" value={r.v2} onChange={(e) => patch(r.id, "v2", e.target.value)} />
                </TableCell>
                <TableCell className="p-1">
                  <Input className="h-9 min-w-[88px] text-xs" value={r.v3} onChange={(e) => patch(r.id, "v3", e.target.value)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Изменения сохраняются в sessionStorage для этой вкладки.</p>
    </div>
  );
}

function SummaryPanel() {
  const top = getRowsForTab("top500");
  const sumRub = top.reduce((s, r) => s + (parseFloat(String(r.v1).replace(/\s/g, "")) || 0), 0);
  const sumVh = top.reduce((s, r) => s + (parseFloat(String(r.v2)) || 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-xl border border-border/80">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Сумма оборота (ТОП 500)</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{Math.round(sumRub).toLocaleString("ru-RU")} ₽</CardContent>
        </Card>
        <Card className="rounded-xl border border-border/80">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Сумма ВХ, шт. (ТОП 500)</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{Math.round(sumVh)}</CardContent>
        </Card>
        <Card className="rounded-xl border border-border/80">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Строк в ТОП 500</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{top.length}</CardContent>
        </Card>
      </div>
      <TabTable tab="summary" meta={ANALYTICS_WORKSPACE_TAB_META.find((m) => m.id === "summary")!} />
    </div>
  );
}

export default function AnalyticsWorkspacePage() {
  const [tab, setTab] = useState<AnalyticsWorkspaceTabId>("top500");

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-analytics-workspace">
      <FloatingBackButton href="/main" label="На главную" testId="button-floating-back-analytics-workspace" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Аналитика команды</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Ручной ввод и mock-данные (Release 1, без 1С). Таблицы редактируются локально; фильтры не меняют сохранённые значения.
        </p>
        <p className="text-xs text-muted-foreground">
          Классическая аналитика отдела остаётся в разделе{" "}
          <Link href="/analytics" className="font-medium text-primary underline-offset-2 hover:underline">
            «Аналитика»
          </Link>
          .
        </p>
        <Card className="rounded-2xl border border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Клиентская база Release 1</CardTitle>
            <CardDescription>
              Отдельный справочник клиентов пилота (Excel): фильтры по команде, менеджеру, городу и типу; видимость по демо-ролям.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="min-h-10 font-semibold">
              <Link href="/release-one/clients">Открыть клиентов пилота</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as AnalyticsWorkspaceTabId)} className="w-full min-w-0">
        <div className="w-full overflow-x-auto pb-2">
          <TabsList className="inline-flex h-auto min-w-0 flex-nowrap gap-1 bg-muted/50 p-1" data-testid="tabs-analytics-workspace">
            {ANALYTICS_WORKSPACE_TAB_META.map((m) => (
              <TabsTrigger
                key={m.id}
                value={m.id}
                className={cn("shrink-0 whitespace-nowrap px-3 py-2 text-xs sm:text-sm")}
                data-testid={m.testId}
              >
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {ANALYTICS_WORKSPACE_TAB_META.map((m) => (
          <TabsContent key={m.id} value={m.id} className="mt-4 min-w-0">
            {m.id === "summary" ? <SummaryPanel /> : <TabTable tab={m.id} meta={m} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
