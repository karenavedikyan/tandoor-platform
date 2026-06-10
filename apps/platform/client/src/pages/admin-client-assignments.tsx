/**
 * Назначения клиентов: список, фильтры, массовое переназначение, история.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { BackNav } from "@/components/navigation/back-nav";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
import { Check, ChevronDown, ChevronsUpDown, History, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveList, ResponsiveListDesktop, ResponsiveListMobile, ResponsiveListMobileItem } from "@/components/ui/responsive-list";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { listUsers, type AdminUser } from "@/lib/admin-users-api";
import {
  addRopGrants,
  getClientHistory,
  listAssignmentFilterOptions,
  listAssignments,
  listRopGrants,
  listTeams,
  reassignClients,
  removeRopGrants,
  type ClientAssignmentHistoryRow,
  type ClientAssignmentRow,
  type AdminTeamOption,
  type ReassignClientsFilter,
  type RopClientGrantRow,
} from "@/lib/client-assignments-api";
import { userCanManageInvitations, userHas } from "@/lib/auth-rbac";
import { canManageClientAssignments, defaultHomePathForUserRole } from "@/lib/auth-access";
import { cn } from "@/lib/utils";

const LIMIT = 50;

const CATEGORY_LABELS: Record<string, string> = {
  top150: "Топ 150",
  top350: "Топ 350",
  top500: "Топ 500",
  top500plus: "Топ 500+",
  new_client: "Новый клиент",
};

type ActionMode = "reassign" | "grant";

function cellText(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function categoryLabel(code: string | null | undefined): string {
  if (!code?.trim()) return "—";
  return CATEGORY_LABELS[code] ?? code;
}

type FilterComboboxOption = {
  value: string;
  label: string;
  searchValue?: string;
};

function FilterCombobox({
  values,
  onValuesChange,
  options,
  placeholder = "Все",
  testId,
}: {
  values: string[];
  onValuesChange: (next: string[]) => void;
  options: FilterComboboxOption[];
  placeholder?: string;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabels = values
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter((label): label is string => Boolean(label));
  let displayLabel = placeholder;
  if (selectedLabels.length === 1) displayLabel = selectedLabels[0]!;
  else if (selectedLabels.length > 1) displayLabel = `${selectedLabels[0]} +${selectedLabels.length - 1}`;

  const toggleValue = (value: string) => {
    if (values.includes(value)) onValuesChange(values.filter((v) => v !== value));
    else onValuesChange([...values, value]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "min-h-11 w-full justify-between bg-background px-3 text-left font-normal",
            values.length === 0 && "text-muted-foreground",
          )}
          data-testid={testId}
        >
          <span className="min-w-0 truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Поиск..." />
          <CommandList className="max-h-72 overflow-auto">
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onValuesChange([]);
                }}
              >
                <Check
                  className={cn("h-4 w-4 text-primary", values.length === 0 ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
                <span className="min-w-0 truncate">Все</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.searchValue ?? option.label}
                  onSelect={() => {
                    toggleValue(option.value);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4 text-primary", values.includes(option.value) ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {values.length > 0 ? (
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full"
                onClick={() => onValuesChange([])}
              >
                Очистить
              </Button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AssignmentHistoryPopover({ clientCode }: { clientCode: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["client-assignments", "history-preview", clientCode],
    queryFn: async () => {
      const r = await getClientHistory(clientCode);
      if (!r.ok) throw new Error(r.message);
      return r.items.slice(0, 5);
    },
    enabled: open,
    staleTime: 30_000,
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="История назначений">
          <History className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка…
          </div>
        ) : q.isError ? (
          <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Ошибка"}</p>
        ) : !q.data?.length ? (
          <p className="text-sm text-muted-foreground">Нет записей</p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
            {q.data.map((h) => (
              <li key={h.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <div className="font-medium text-foreground">{formatDisplayDateTime(h.createdAt)}</div>
                <div className="text-muted-foreground">{h.reason ?? "—"}</div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function AdminClientAssignmentsPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canPage = Boolean(user && canManageClientAssignments(user.role));
  const canManageRopGrants = user?.role === "admin" || user?.role === "director";
  const homeHref = user ? defaultHomePathForUserRole(user.role) : "/";

  const [searchInput, setSearchInput] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(searchInput), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const [userIdFilter, setUserIdFilter] = useState<string[]>([]);
  const [teamIdFilter, setTeamIdFilter] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [regionalFilter, setRegionalFilter] = useState<string[]>([]);
  const [ropFilter, setRopFilter] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);

  const userIdFilterKey = userIdFilter.join(",");
  const teamIdFilterKey = teamIdFilter.join(",");
  const cityFilterKey = cityFilter.join(",");
  const categoryFilterKey = categoryFilter.join(",");
  const regionalFilterKey = regionalFilter.join(",");
  const ropFilterKey = ropFilter.join(",");

  useEffect(() => {
    setOffset(0);
  }, [searchDebounced, userIdFilterKey, teamIdFilterKey, cityFilterKey, categoryFilterKey, regionalFilterKey, ropFilterKey]);

  const teamsQ = useQuery({
    queryKey: ["client-assignments", "teams"],
    queryFn: async () => {
      const r = await listTeams();
      if (!r.ok) throw new Error(r.message);
      return r.teams;
    },
    enabled: canPage,
  });

  const filterOptionsQ = useQuery({
    queryKey: ["client-assignments", "filter-options"],
    queryFn: async () => {
      const r = await listAssignmentFilterOptions();
      if (!r.ok) throw new Error(r.message);
      return r.options;
    },
    enabled: canPage,
  });

  const usersQ = useQuery({
    queryKey: ["client-assignments", "users-active"],
    queryFn: async () => {
      const r = await listUsers({ status: "active", limit: 200, offset: 0 });
      if (!r.ok) throw new Error(r.message);
      return r.result.users;
    },
    enabled: canPage,
  });

  const listQ = useQuery({
    queryKey: [
      "client-assignments",
      "list",
      searchDebounced,
      userIdFilterKey,
      teamIdFilterKey,
      cityFilterKey,
      categoryFilterKey,
      regionalFilterKey,
      ropFilterKey,
      offset,
    ],
    queryFn: async () => {
      const r = await listAssignments({
        limit: LIMIT,
        offset,
        search: searchDebounced.trim() || undefined,
        userId: userIdFilter.length ? userIdFilter : undefined,
        teamId: teamIdFilter.length ? teamIdFilter : undefined,
        city: cityFilter.length ? cityFilter : undefined,
        category: categoryFilter.length ? categoryFilter : undefined,
        regionalManager: regionalFilter.length ? regionalFilter : undefined,
        rop: ropFilter.length ? ropFilter : undefined,
      });
      if (!r.ok) throw new Error(r.message);
      return r;
    },
    enabled: canPage,
  });

  const items: ClientAssignmentRow[] = listQ.data?.ok ? listQ.data.items : [];
  const total = listQ.data?.ok ? listQ.data.total : 0;

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setSelected({});
  }, [items, offset, searchDebounced, userIdFilterKey, teamIdFilterKey, cityFilterKey, categoryFilterKey, regionalFilterKey, ropFilterKey]);

  const currentReassignFilter = useMemo((): ReassignClientsFilter => {
    const filter: ReassignClientsFilter = {};
    if (userIdFilter.length) filter.responsibleUserId = userIdFilter;
    if (teamIdFilter.length) filter.fromTeamId = teamIdFilter;
    if (cityFilter.length) filter.city = cityFilter;
    if (categoryFilter.length) filter.category = categoryFilter;
    if (regionalFilter.length) filter.regionalManager = regionalFilter;
    if (ropFilter.length) filter.rop = ropFilter;
    if (searchDebounced.trim()) filter.search = searchDebounced.trim();
    return filter;
  }, [userIdFilter, teamIdFilter, cityFilter, categoryFilter, regionalFilter, ropFilter, searchDebounced]);

  const hasActiveFilter = useMemo(
    () =>
      Boolean(
        searchDebounced.trim() ||
          userIdFilter.length ||
          teamIdFilter.length ||
          cityFilter.length ||
          categoryFilter.length ||
          regionalFilter.length ||
          ropFilter.length,
      ),
    [searchDebounced, userIdFilter, teamIdFilter, cityFilter, categoryFilter, regionalFilter, ropFilter],
  );

  const selectedCodes = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const selectedCount = selectedCodes.length;

  const allOnPageSelected = items.length > 0 && items.every((r) => selected[r.clientCode]);
  const toggleAllOnPage = (checked: boolean) => {
    const next: Record<string, boolean> = { ...selected };
    for (const r of items) {
      if (checked) next[r.clientCode] = true;
      else delete next[r.clientCode];
    }
    setSelected(next);
  };

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"selected" | "filter">("selected");
  const [bulkToUserId, setBulkToUserId] = useState<string>("");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [actionMode, setActionMode] = useState<ActionMode>("reassign");
  const [grantConfirmOpen, setGrantConfirmOpen] = useState(false);
  const [grantRopUserId, setGrantRopUserId] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantsOpen, setGrantsOpen] = useState(false);

  const [sheetCode, setSheetCode] = useState<string | null>(null);
  const sheetQ = useQuery({
    queryKey: ["client-assignments", "history-full", sheetCode],
    queryFn: async () => {
      if (!sheetCode) return [] as ClientAssignmentHistoryRow[];
      const r = await getClientHistory(sheetCode);
      if (!r.ok) throw new Error(r.message);
      return r.items;
    },
    enabled: Boolean(sheetCode),
  });

  const canPrev = offset > 0;
  const canNext = offset + LIMIT < total;

  const teams: AdminTeamOption[] = teamsQ.data ?? [];
  const users: AdminUser[] = usersQ.data ?? [];
  const ropUsers = useMemo(() => users.filter((u) => u.role === "rop"), [users]);
  const filterOptions = filterOptionsQ.data;

  const userFilterOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.fullName} (${u.email})`,
        searchValue: `${u.fullName} ${u.email}`,
      })),
    [users],
  );

  const teamFilterOptions = useMemo(
    () => teams.map((t) => ({ value: t.id, label: t.name })),
    [teams],
  );

  const cityFilterOptions = useMemo(
    () => (filterOptions?.cities ?? []).map((city) => ({ value: city, label: city })),
    [filterOptions?.cities],
  );

  const regionalFilterOptions = useMemo(
    () => (filterOptions?.regionalManagers ?? []).map((name) => ({ value: name, label: name })),
    [filterOptions?.regionalManagers],
  );

  const ropFilterOptions = useMemo(
    () => (filterOptions?.rops ?? []).map((name) => ({ value: name, label: name })),
    [filterOptions?.rops],
  );

  const ropGrantsQ = useQuery({
    queryKey: ["client-assignments", "rop-grants", grantRopUserId],
    queryFn: async () => {
      const r = await listRopGrants(grantRopUserId);
      if (!r.ok) throw new Error(r.message);
      return r.grants;
    },
    enabled: canPage && canManageRopGrants && Boolean(grantRopUserId),
  });
  const ropGrants: RopClientGrantRow[] = ropGrantsQ.data ?? [];

  const bulkTargetUserName = useMemo(() => {
    if (!bulkToUserId) return "";
    return users.find((u) => u.id === bulkToUserId)?.fullName?.trim() ?? "";
  }, [bulkToUserId, users]);

  const grantRopUserName = useMemo(() => {
    if (!grantRopUserId) return "";
    return ropUsers.find((u) => u.id === grantRopUserId)?.fullName?.trim() ?? "";
  }, [grantRopUserId, ropUsers]);

  const confirmGrantAccess = async () => {
    if (!grantRopUserId || selectedCount === 0) return;
    setGrantLoading(true);
    try {
      const r = await addRopGrants({
        ropUserId: grantRopUserId,
        clientCodes: selectedCodes,
        reason: grantReason.trim() || undefined,
      });
      if (!r.ok) {
        toast({ title: r.message, variant: "destructive" });
        return;
      }
      toast({ title: `Доступ выдан: ${r.added} грант(ов)` });
      setSelected({});
      setGrantConfirmOpen(false);
      await qc.invalidateQueries({ queryKey: ["client-assignments", "rop-grants"] });
    } finally {
      setGrantLoading(false);
    }
  };

  if (!user || !canManageClientAssignments(user.role)) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6" data-testid="page-admin-client-assignments">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Недостаточно прав</CardTitle>
            <CardDescription>Раздел доступен только администратору, директору или РОПу.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={homeHref}>На главную</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-admin-client-assignments">
      <BackNav breadcrumbs={breadcrumbsFor("/admin/client-assignments")} fallbackHref="/" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {userHas(user.role, "users.list") ? (
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/admin/users">Пользователи</Link>
          </Button>
        ) : null}
        {userCanManageInvitations(user.role) ? (
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/admin/invitations">Приглашения</Link>
          </Button>
        ) : null}
        {userHas(user.role, "audit.read") ? (
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/admin/audit">Журнал событий</Link>
          </Button>
        ) : null}
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">Назначения клиентов</h1>
        <p className="text-sm text-muted-foreground">
          Актуальные ответственные по кодам клиентов. РОП видит только свою команду (ограничение на сервере).
        </p>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>Поиск по коду или имени клиента, ответственный, команда и поля карточки клиента.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-0 flex-1 space-y-2 lg:min-w-[200px]">
            <Label htmlFor="ca-search">Поиск</Label>
            <Input
              id="ca-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Код или имя клиента"
              className="min-h-11"
              data-testid="input-client-assignments-search"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2 lg:min-w-[220px]">
            <Label>Ответственный</Label>
            <FilterCombobox
              values={userIdFilter}
              onValuesChange={setUserIdFilter}
              options={userFilterOptions}
              testId="select-client-assignments-user"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2 lg:min-w-[220px]">
            <Label>Команда</Label>
            <FilterCombobox
              values={teamIdFilter}
              onValuesChange={setTeamIdFilter}
              options={teamFilterOptions}
              testId="select-client-assignments-team"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2 lg:min-w-[180px]">
            <Label>Город</Label>
            <FilterCombobox
              values={cityFilter}
              onValuesChange={setCityFilter}
              options={cityFilterOptions}
              testId="select-client-assignments-city"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2 lg:min-w-[180px]">
            <Label>Категория</Label>
            <FilterCombobox
              values={categoryFilter}
              onValuesChange={setCategoryFilter}
              options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
              testId="select-client-assignments-category"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2 lg:min-w-[200px]">
            <Label>Регионал</Label>
            <FilterCombobox
              values={regionalFilter}
              onValuesChange={setRegionalFilter}
              options={regionalFilterOptions}
              testId="select-client-assignments-regional"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2 lg:min-w-[200px]">
            <Label>РОП</Label>
            <FilterCombobox
              values={ropFilter}
              onValuesChange={setRopFilter}
              options={ropFilterOptions}
              testId="select-client-assignments-rop"
            />
          </div>
        </CardContent>
      </Card>

      {canManageRopGrants ? (
        <div className="space-y-2" data-testid="section-client-assignments-action-mode">
          <ToggleGroup
            type="single"
            value={actionMode}
            onValueChange={(v) => {
              if (v === "reassign" || v === "grant") setActionMode(v);
            }}
            className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
          >
            <ToggleGroupItem
              value="reassign"
              className="min-h-11 flex-1 px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              data-testid="toggle-client-assignments-mode-reassign"
            >
              Переназначить ответственного
            </ToggleGroupItem>
            <ToggleGroupItem
              value="grant"
              className="min-h-11 flex-1 px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              data-testid="toggle-client-assignments-mode-grant"
            >
              Дать доступ РОПу
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground" data-testid="text-client-assignments-mode-hint">
            {actionMode === "reassign"
              ? "Меняется ответственный (владелец) у выбранных клиентов."
              : "РОП дополнительно видит выбранных клиентов. Владелец и команда НЕ меняются."}
          </p>
        </div>
      ) : null}

      {canManageRopGrants && actionMode === "grant" ? (
        <Card className="rounded-xl border border-border bg-card shadow-sm" data-testid="section-rop-client-grants">
          <CardHeader className="pb-3">
            <CardTitle>Доп. доступ РОПа</CardTitle>
            <CardDescription>
              РОП дополнительно видит выбранных клиентов. Владелец и команда не меняются.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>РОП</Label>
                <Select value={grantRopUserId || undefined} onValueChange={setGrantRopUserId}>
                  <SelectTrigger className="min-h-11" data-testid="select-rop-grants-rop">
                    <SelectValue placeholder="Выберите РОПа" />
                  </SelectTrigger>
                  <SelectContent>
                    {ropUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rop-grant-reason">Причина (необязательно)</Label>
                <Input
                  id="rop-grant-reason"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  className="min-h-11"
                  data-testid="input-rop-grants-reason"
                />
              </div>
            </div>

            {grantRopUserId ? (
              <Collapsible open={grantsOpen} onOpenChange={setGrantsOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full justify-between px-2 font-normal"
                    data-testid="toggle-rop-grants-list"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="text-sm font-medium">Текущие гранты</span>
                      {ropGrantsQ.isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                      ) : (
                        <>
                          <Badge variant="secondary" className="font-normal tabular-nums">
                            {ropGrants.length}
                          </Badge>
                          {ropGrants.length === 0 ? (
                            <span className="text-xs text-muted-foreground">нет</span>
                          ) : null}
                        </>
                      )}
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", grantsOpen && "rotate-180")}
                      aria-hidden
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {ropGrantsQ.isLoading ? (
                    <div className="mt-2 flex items-center gap-2 px-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Загрузка…
                    </div>
                  ) : ropGrantsQ.isError ? (
                    <p className="mt-2 px-2 text-sm text-destructive">
                      {(ropGrantsQ.error as Error)?.message ?? "Ошибка"}
                    </p>
                  ) : ropGrants.length === 0 ? (
                    <p className="mt-2 px-2 text-sm text-muted-foreground">Нет дополнительных грантов</p>
                  ) : (
                    <ul className="mt-2 max-h-64 space-y-2 overflow-auto rounded-md border border-border/80 bg-muted/20 p-3 text-sm">
                      {ropGrants.map((g) => (
                        <li key={g.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {g.clientCode ? (
                                <>
                                  <span className="shrink-0 font-mono text-xs">{g.clientCode}</span>
                                  {g.clientName ? (
                                    <span className="min-w-0 truncate text-xs">{g.clientName}</span>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  <span className="shrink-0 font-mono text-xs">{g.tradePointId}</span>
                                  {g.tradePointName ? (
                                    <span className="min-w-0 truncate text-xs">{g.tradePointName}</span>
                                  ) : null}
                                </>
                              )}
                            </div>
                            {g.reason ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">{g.reason}</p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            aria-label="Удалить грант"
                            data-testid={`button-rop-grant-remove-${g.id}`}
                            onClick={async () => {
                              const r = await removeRopGrants([g.id]);
                              if (!r.ok) {
                                toast({ title: r.message, variant: "destructive" });
                                return;
                              }
                              toast({ title: "Доступ снят" });
                              await qc.invalidateQueries({ queryKey: ["client-assignments", "rop-grants"] });
                            }}
                          >
                            ×
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Список</CardTitle>
            <CardDescription>
              {listQ.isFetching ? "Обновление…" : null} Всего: {total}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={!canPrev || listQ.isFetching}
              onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
              data-testid="button-client-assignments-prev"
            >
              Назад
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={!canNext || listQ.isFetching}
              onClick={() => setOffset((o) => o + LIMIT)}
              data-testid="button-client-assignments-next"
            >
              Вперёд
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-2">
          {listQ.isError ? (
            <p className="p-4 text-sm text-destructive">{(listQ.error as Error)?.message ?? "Ошибка загрузки"}</p>
          ) : listQ.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Загрузка…
            </div>
          ) : (
            <ResponsiveList>
              <ResponsiveListDesktop>
              <Table>
                <TableHeader>
                  <TableRow className="h-10">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={(v) => toggleAllOnPage(v === true)}
                        aria-label="Выбрать все на странице"
                        data-testid="checkbox-client-assignments-select-all"
                      />
                    </TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Код клиента</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Клиент</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Город</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Категория</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Регионал</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">РОП</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Ответственный</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Команда</TableHead>
                    <TableHead className="px-2 py-1.5 text-xs">Назначен с</TableHead>
                    <TableHead className="w-24 px-2 py-1.5 text-right text-xs">История</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.clientCode} className="h-10">
                      <TableCell className="px-2 py-1.5">
                        <Checkbox
                          checked={Boolean(selected[row.clientCode])}
                          onCheckedChange={(v) => {
                            setSelected((prev) => {
                              const n = { ...prev };
                              if (v === true) n[row.clientCode] = true;
                              else delete n[row.clientCode];
                              return n;
                            });
                          }}
                          aria-label={`Выбрать ${row.clientCode}`}
                          data-testid={`checkbox-client-${row.clientCode}`}
                        />
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <button
                          type="button"
                          className={cn("font-mono text-sm text-primary underline-offset-4 hover:underline")}
                          onClick={() => setSheetCode(row.clientCode)}
                          data-testid={`link-client-code-${row.clientCode}`}
                        >
                          {row.clientCode}
                        </button>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate px-2 py-1.5 text-sm">{cellText(row.clientName)}</TableCell>
                      <TableCell className="max-w-[120px] truncate px-2 py-1.5 text-sm">{cellText(row.city)}</TableCell>
                      <TableCell className="max-w-[120px] truncate px-2 py-1.5 text-sm">{categoryLabel(row.clientCategory)}</TableCell>
                      <TableCell className="max-w-[140px] truncate px-2 py-1.5 text-sm">{cellText(row.regionalManagerName)}</TableCell>
                      <TableCell className="max-w-[140px] truncate px-2 py-1.5 text-sm">{cellText(row.ropName)}</TableCell>
                      <TableCell className="max-w-[200px] truncate px-2 py-1.5 text-sm">{row.responsibleFullName}</TableCell>
                      <TableCell className="max-w-[220px] truncate px-2 py-1.5 text-sm">{row.teamName ?? row.teamId ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap px-2 py-1.5 text-xs text-muted-foreground">
                        {formatDisplayDateTime(row.since)}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-right">
                        <AssignmentHistoryPopover clientCode={row.clientCode} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </ResponsiveListDesktop>
              <ResponsiveListMobile>
                {items.map((row) => (
                  <ResponsiveListMobileItem key={row.clientCode}>
                    <Checkbox
                      checked={Boolean(selected[row.clientCode])}
                      onCheckedChange={(v) => {
                        setSelected((prev) => {
                          const n = { ...prev };
                          if (v === true) n[row.clientCode] = true;
                          else delete n[row.clientCode];
                          return n;
                        });
                      }}
                      aria-label={`Выбрать ${row.clientCode}`}
                      data-testid={`checkbox-client-m-${row.clientCode}`}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 truncate font-mono text-xs font-semibold text-primary underline-offset-4 hover:underline"
                          onClick={() => setSheetCode(row.clientCode)}
                          data-testid={`link-client-code-m-${row.clientCode}`}
                        >
                          {row.clientCode}
                        </button>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatDisplayDateTime(row.since)}</span>
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-foreground">{row.responsibleFullName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[cellText(row.clientName), cellText(row.city)].filter((v) => v !== "—").join(" · ") || "—"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[
                          categoryLabel(row.clientCategory) !== "—" ? categoryLabel(row.clientCategory) : null,
                          cellText(row.regionalManagerName) !== "—" ? cellText(row.regionalManagerName) : null,
                          cellText(row.ropName) !== "—" ? cellText(row.ropName) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{row.teamName ?? row.teamId ?? "—"}</div>
                    </div>
                    <div className="shrink-0">
                      <AssignmentHistoryPopover clientCode={row.clientCode} />
                    </div>
                  </ResponsiveListMobileItem>
                ))}
              </ResponsiveListMobile>
            </ResponsiveList>
          )}
        </CardContent>
      </Card>

      {(!canManageRopGrants || actionMode === "reassign") ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
          data-testid="toolbar-client-assignments-actions"
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            disabled={!hasActiveFilter}
            onClick={() => {
              setBulkMode("filter");
              setBulkOpen(true);
            }}
            data-testid="button-client-assignments-bulk-filter"
          >
            Переназначить всё по фильтру ({total})
          </Button>
          <Button
            type="button"
            variant="default"
            className="min-h-11 w-full sm:w-auto"
            disabled={selectedCount === 0}
            onClick={() => {
              setBulkMode("selected");
              setBulkOpen(true);
            }}
            data-testid="button-client-assignments-bulk"
          >
            Переназначить выбранных ({selectedCount})
          </Button>
        </div>
      ) : null}

      {canManageRopGrants && actionMode === "grant" ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-end"
          data-testid="toolbar-client-assignments-grant-action"
        >
          <Button
            type="button"
            variant="default"
            className="min-h-11 w-full sm:w-auto"
            disabled={!grantRopUserId || selectedCount === 0}
            data-testid="button-rop-grants-add"
            onClick={() => setGrantConfirmOpen(true)}
          >
            Дать доступ РОПу ({selectedCount})
          </Button>
        </div>
      ) : null}

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{bulkMode === "filter" ? "Переназначить по фильтру" : "Переназначить выбранных"}</DialogTitle>
            <DialogDescription>
              {bulkToUserId && bulkTargetUserName ? (
                bulkMode === "filter" ? (
                  <>
                    Будет изменён ответственный у всех клиентов под фильтром (до 1000, сейчас {total}) на:{" "}
                    <span className="font-medium text-foreground">{bulkTargetUserName}</span>.
                  </>
                ) : (
                  <>
                    Будет изменён ответственный у {selectedCount} клиентов на:{" "}
                    <span className="font-medium text-foreground">{bulkTargetUserName}</span>. Действие меняет владельца.
                  </>
                )
              ) : bulkMode === "filter" ? (
                `Выберите нового ответственного. Будут затронуты все клиенты под фильтром (до 1000, сейчас ${total}).`
              ) : (
                `Выберите нового ответственного. Будут затронуты ${selectedCount} выбранных клиентов.`
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Новый ответственный</Label>
              <Select value={bulkToUserId || undefined} onValueChange={(v) => setBulkToUserId(v)}>
                <SelectTrigger className="min-h-11">
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-reason">Причина (необязательно)</Label>
              <Input id="bulk-reason" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} className="min-h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={
                !bulkToUserId ||
                bulkLoading ||
                (bulkMode === "selected" ? selectedCount === 0 : !hasActiveFilter)
              }
              onClick={async () => {
                if (!bulkToUserId) return;
                if (bulkMode === "selected" && selectedCount === 0) return;
                if (bulkMode === "filter" && !hasActiveFilter) return;
                setBulkLoading(true);
                try {
                  const r = await reassignClients(
                    bulkMode === "filter"
                      ? {
                          filter: currentReassignFilter,
                          toUserId: bulkToUserId,
                          reason: bulkReason.trim() || undefined,
                        }
                      : {
                          clientCodes: selectedCodes,
                          toUserId: bulkToUserId,
                          reason: bulkReason.trim() || undefined,
                        },
                  );
                  if (!r.ok) {
                    toast({ title: r.message, variant: "destructive" });
                    return;
                  }
                  toast({ title: `Переназначено: ${r.reassigned}` });
                  setBulkOpen(false);
                  setBulkReason("");
                  setBulkToUserId("");
                  setSelected({});
                  await qc.invalidateQueries({ queryKey: ["client-assignments"] });
                } finally {
                  setBulkLoading(false);
                }
              }}
            >
              {bulkLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение…
                </>
              ) : (
                "Переназначить"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={grantConfirmOpen} onOpenChange={(o) => !grantLoading && setGrantConfirmOpen(o)}>
        <DialogContent className="max-w-md" data-testid="dialog-rop-grants-confirm">
          <DialogHeader>
            <DialogTitle>Дать доступ РОПу</DialogTitle>
            <DialogDescription>
              {grantRopUserName ? (
                <>
                  РОП <span className="font-medium text-foreground">{grantRopUserName}</span> получит доступ к просмотру{" "}
                  {selectedCount} выбранных клиентов и их ТТ. Владелец и команда клиентов НЕ изменятся.
                </>
              ) : (
                "Выберите РОПа в секции выше."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={grantLoading} onClick={() => setGrantConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!grantRopUserId || selectedCount === 0 || grantLoading}
              onClick={() => void confirmGrantAccess()}
            >
              {grantLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение…
                </>
              ) : (
                "Дать доступ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={sheetCode != null} onOpenChange={(o) => !o && setSheetCode(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>История клиента</SheetTitle>
            <SheetDescription className="font-mono">{sheetCode}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-y-auto">
            {sheetQ.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка…
              </div>
            ) : sheetQ.isError ? (
              <p className="text-sm text-destructive">{(sheetQ.error as Error)?.message}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Когда</TableHead>
                    <TableHead>Причина</TableHead>
                    <TableHead>Кто</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sheetQ.data ?? []).map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDisplayDateTime(h.createdAt)}</TableCell>
                      <TableCell className="text-xs">{h.reason ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.actorFullName ?? h.actorUserId ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
