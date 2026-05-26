import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import {
  deriveReleaseClientCategory,
  getClientCategoryBadgeClass,
  getClientCategoryLabel,
  getClientCategoryOptions,
  type ClientCategoryId,
} from "@/lib/client-category";
import {
  clientStatusLabel,
  filterReleaseClientsByVisibleCodes,
  filterReleaseClientsForDemoProfile,
  getReleaseClientSummary,
  getReleaseClients,
  searchReleaseClients,
  type ReleaseClient,
} from "@/lib/release-client-data";
import { displayUserName } from "@/lib/auth-api";
import { releaseDemoRoleLabel } from "@/lib/release-demo-profile";
import { useAuthMe } from "@/lib/use-auth-me";
import { useMyVisibleClientCodes } from "@/lib/use-my-visible-client-codes";
import { getManagersForRopTeam, getRopOptions, isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";
import { getSalesUserById, SALES_TEAMS } from "@/lib/sales-control-data";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const MAX_ROWS = 300;
const CATEGORY_OPTIONS = getClientCategoryOptions();

function uniqSorted(vals: string[]): string[] {
  return Array.from(new Set(vals.filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
}

function platformRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: "Администратор",
    director: "Директор",
    rop: "РОП",
    regional_manager: "Региональный менеджер",
    manager: "Менеджер",
    marketer: "Маркетолог",
    analyst: "Аналитик",
  };
  return labels[role] ?? role;
}

export default function ReleaseClientsPage() {
  const { profile } = useReleaseDemoProfile();
  const { data: me, isLoading: meLoading, isFetched: meFetched, isError: meError } = useAuthMe();
  const isRealUser = Boolean(me?.id);
  const { data: visible, isLoading: visibleLoading } = useMyVisibleClientCodes({ enabled: isRealUser });
  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState<string>(ALL);
  const [managerId, setManagerId] = useState<string>(ALL);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<ClientCategoryId[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [includeClosed, setIncludeClosed] = useState(false);

  const baseRows = useMemo(() => {
    const all = getReleaseClients();
    if (!meFetched || meLoading) return [];
    if (meError) return filterReleaseClientsForDemoProfile(all, profile);
    if (isRealUser) {
      if (visibleLoading || !visible) return [];
      return filterReleaseClientsByVisibleCodes(all, visible.codes);
    }
    return filterReleaseClientsForDemoProfile(all, profile);
  }, [meFetched, meLoading, meError, isRealUser, visible, visibleLoading, profile]);

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
          cities: selectedCities,
          clientCategories: selectedCategories,
          priorityOnly,
          activeOnly,
          includeClosed,
        },
        baseRows,
      ),
    [baseRows, query, teamId, managerId, selectedCities, selectedCategories, priorityOnly, activeOnly, includeClosed],
  );

  const displayRows = useMemo(() => filtered.slice(0, MAX_ROWS), [filtered]);

  const persona = getSalesUserById(profile.personaUserId);

  const teamLabel = (tid: string) => SALES_TEAMS.find((t) => t.id === tid)?.name ?? tid;

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
            {isRealUser && me ? (
              <>
                Вы смотрите клиентов как: {platformRoleLabel(me.role)} · {displayUserName(me)}
              </>
            ) : (
              <>
                Вы смотрите клиентов как: {releaseDemoRoleLabel(profile.role)} · {persona?.name ?? "—"}
              </>
            )}
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
            <MultiSelect
              options={cities.map((c) => ({ value: c, label: c }))}
              value={selectedCities}
              onChange={setSelectedCities}
              placeholder="Все города"
              allLabel="Все города"
              triggerClassName="min-h-10"
              testId="select-release-clients-city"
              ariaLabel="Город"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Категория клиента</Label>
            <MultiSelect
              options={CATEGORY_OPTIONS.filter((o) => o.value !== "all").map((o) => ({ value: o.value, label: o.label }))}
              value={selectedCategories}
              onChange={(next) => setSelectedCategories(next as ClientCategoryId[])}
              placeholder="Все категории"
              allLabel="Все категории"
              triggerClassName="min-h-10"
              testId="select-release-clients-category"
              ariaLabel="Категория клиента"
            />
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
                <TableHead className="whitespace-nowrap">Категория клиента</TableHead>
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
                    <Badge
                      variant="outline"
                      className={cn(
                        "whitespace-nowrap text-xs font-normal",
                        getClientCategoryBadgeClass(deriveReleaseClientCategory(c)),
                      )}
                      data-testid={`text-release-client-category-${c.id}`}
                    >
                      {getClientCategoryLabel(deriveReleaseClientCategory(c))}
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
