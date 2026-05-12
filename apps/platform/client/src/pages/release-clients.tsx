import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import {
  clientStatusLabel,
  filterReleaseClientsForDemoProfile,
  getReleaseClientSummary,
  getReleaseClientTypeLabel,
  getReleaseClientTypeTone,
  getReleaseClients,
  searchReleaseClients,
  type ReleaseClient,
  type ReleaseClientNormalizedType,
} from "@/lib/release-client-data";
import { releaseDemoRoleLabel } from "@/lib/release-demo-profile";
import { getManagersForRopTeam, getRopOptions, isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";
import { getSalesUserById, SALES_TEAMS } from "@/lib/sales-control-data";

const ALL = "__all__";
const MAX_ROWS = 300;

function uniqSorted(vals: string[]): string[] {
  return Array.from(new Set(vals.filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
}

const TYPE_OPTIONS: { value: ReleaseClientNormalizedType | "all"; label: string }[] = [
  { value: "all", label: "Все типы" },
  { value: "active", label: "Активный" },
  { value: "volume", label: "Объемообразующий" },
  { value: "top150", label: "ТОП 150" },
  { value: "top350", label: "ТОП 350" },
  { value: "top500", label: "ТОП 500" },
  { value: "potential", label: "Потенциальный" },
  { value: "closed", label: "Закрытый" },
  { value: "nonTarget", label: "Нецелевой клиент" },
  { value: "unknown", label: "Без типа" },
];

export default function ReleaseClientsPage() {
  const { profile } = useReleaseDemoProfile();
  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState<string>(ALL);
  const [managerId, setManagerId] = useState<string>(ALL);
  const [city, setCity] = useState<string>(ALL);
  const [clientType, setClientType] = useState<ReleaseClientNormalizedType | "all">("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [includeClosed, setIncludeClosed] = useState(false);

  const baseRows = useMemo(() => filterReleaseClientsForDemoProfile(getReleaseClients(), profile), [profile]);

  const scopeSummary = useMemo(() => getReleaseClientSummary(baseRows), [baseRows]);

  const managerOptions = useMemo(() => {
    const pool = getManagersForRopTeam(teamId);
    return pool
      .map((m) => ({ id: m.id, label: m.name }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [teamId]);

  useEffect(() => {
    if (managerId === ALL) return;
    const ok = isRopOrManagerAllFilter(teamId)
      ? baseRows.some((r) => r.managerId === managerId)
      : getManagersForRopTeam(teamId).some((m) => m.id === managerId);
    if (!ok) setManagerId(ALL);
  }, [teamId, managerId, baseRows]);

  const cities = useMemo(() => uniqSorted(baseRows.map((r) => r.city)), [baseRows]);

  const filtered = useMemo(
    () =>
      searchReleaseClients(
        {
          query,
          teamId: teamId === ALL ? "all" : teamId,
          managerId: managerId === ALL ? "all" : managerId,
          city: city === ALL ? "all" : city,
          clientType,
          priorityOnly,
          activeOnly,
          includeClosed,
        },
        baseRows,
      ),
    [baseRows, query, teamId, managerId, city, clientType, priorityOnly, activeOnly, includeClosed],
  );

  const displayRows = useMemo(() => filtered.slice(0, MAX_ROWS), [filtered]);

  const persona = getSalesUserById(profile.personaUserId);

  const teamLabel = (tid: string) => SALES_TEAMS.find((t) => t.id === tid)?.name ?? tid;

  const badgeTone = (c: ReleaseClient) => {
    const t = getReleaseClientTypeTone(c.normalizedClientType);
    return t;
  };

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-6 overflow-x-hidden pb-24" data-testid="page-release-clients">
      <FloatingBackButton href="/release-one" label="К релизу 1" testId="button-floating-back-release-clients" />
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8"
        data-testid="section-release-clients-hero"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative space-y-3 pl-3 sm:pl-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Клиенты пилота Release 1</h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            Справочник из Excel «Spisok-klientov-dlia-Karena.xlsx»: команды, РОП и ответственные менеджеры. Список генерируется скриптом
            импорта; в репозитории без файла Excel используется синтетический набор из 2743 строк для проверки интерфейса.
          </p>
          <p className="text-sm text-foreground" data-testid="text-release-clients-context">
            Вы смотрите клиентов как: {releaseDemoRoleLabel(profile.role)} · {persona?.name ?? "—"}
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="section-release-clients-kpis">
        <Card data-testid="card-release-clients-total" className="rounded-xl border border-border/80">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Всего в зоне видимости</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{scopeSummary.total}</CardContent>
        </Card>
        <Card data-testid="card-release-clients-active" className="rounded-xl border border-border/80">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Активные</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {scopeSummary.active}
          </CardContent>
        </Card>
        <Card data-testid="card-release-clients-priority" className="rounded-xl border border-border/80">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Приоритетные</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{scopeSummary.priority}</CardContent>
        </Card>
        <Card data-testid="card-release-clients-closed" className="rounded-xl border border-border/80">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Закрытые</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums text-destructive">{scopeSummary.closed}</CardContent>
        </Card>
        <Card data-testid="card-release-clients-unknown" className="rounded-xl border border-border/80">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Без типа</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{scopeSummary.unknownType}</CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl border border-border/80" data-testid="section-release-clients-filters">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Фильтры</CardTitle>
          <CardDescription>Фильтрация по всему массиву в зоне видимости; таблица может показывать не более {MAX_ROWS} строк.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label className="text-xs text-muted-foreground">Поиск</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название, код, город, менеджер…"
              className="h-10"
              data-testid="input-release-clients-search"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Город</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-10 min-w-0" data-testid="select-release-clients-city">
                <SelectValue placeholder="Город" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все города</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Тип клиента</Label>
            <Select value={clientType} onValueChange={(v) => setClientType(v as ReleaseClientNormalizedType | "all")}>
              <SelectTrigger className="h-10 min-w-0" data-testid="select-release-clients-type">
                <SelectValue placeholder="Тип" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">РОП</Label>
            <Select
              value={teamId}
              onValueChange={(v) => {
                setTeamId(v);
              }}
            >
              <SelectTrigger className="h-10 min-w-0" data-testid="select-release-clients-rop">
                <SelectValue placeholder="РОП" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все РОПы</SelectItem>
                {getRopOptions().map((r) => (
                  <SelectItem key={r.teamId} value={r.teamId}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Менеджер</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger className="h-10 min-w-0" data-testid="select-release-clients-manager">
                <SelectValue placeholder="Менеджер" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все менеджеры</SelectItem>
                {managerOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-4 lg:flex-row lg:flex-wrap lg:items-center">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={activeOnly}
                onCheckedChange={(v) => setActiveOnly(v === true)}
                data-testid="checkbox-release-clients-active-only"
              />
              Только активные
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={priorityOnly}
                onCheckedChange={(v) => setPriorityOnly(v === true)}
                data-testid="checkbox-release-clients-priority-only"
              />
              Только приоритетные
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={includeClosed}
                onCheckedChange={(v) => setIncludeClosed(v === true)}
                data-testid="checkbox-release-clients-include-closed"
              />
              Показывать закрытых
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" data-testid="text-release-clients-count">
          Найдено по фильтрам: {filtered.length}
          {filtered.length > MAX_ROWS ? ` · в таблице показаны первые ${MAX_ROWS}` : ""}
        </p>
        <Link href="/analytics-workspace" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          Аналитика команды
        </Link>
      </div>

      <section className="min-w-0 rounded-2xl border border-border/80 bg-card" data-testid="section-release-clients-table">
        <div className="overflow-x-auto p-2 sm:p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Код</TableHead>
                <TableHead>Наименование</TableHead>
                <TableHead className="whitespace-nowrap">Город</TableHead>
                <TableHead className="whitespace-nowrap">РОП</TableHead>
                <TableHead>Менеджер</TableHead>
                <TableHead className="whitespace-nowrap">Тип</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead className="whitespace-nowrap">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((c) => (
                <TableRow key={c.id} data-testid={`row-release-client-${c.id}`}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{c.code || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate sm:max-w-xs" title={c.name}>
                    {c.name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{c.city || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{c.ropName || teamLabel(c.teamId)}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm" title={c.managerName}>
                    {c.managerName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeTone(c)} className="whitespace-nowrap text-xs font-normal">
                      {c.clientType?.trim() ? c.clientType : getReleaseClientTypeLabel(c.normalizedClientType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={c.address}>
                    {c.address || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{clientStatusLabel(c)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
