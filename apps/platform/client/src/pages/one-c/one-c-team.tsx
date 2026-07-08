import { useEffect, useMemo, useState } from "react";
import { Link, Redirect } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCHierarchy, type OneCRopNode } from "@/lib/one-c-showroom-api";
import { cn } from "@/lib/utils";
import {
  OneCLoadingBlock,
  OneCPageShell,
  OneCRefreshStubButton,
  OneCSearchInput,
  useDebouncedSearch,
} from "./one-c-ui";

function RopRow({
  node,
  searchActive,
  defaultOpen,
  hideRopLink = false,
}: {
  node: OneCRopNode;
  searchActive: boolean;
  defaultOpen: boolean;
  hideRopLink?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = searchActive ? true : open;

  return (
    <div className="border-b last:border-b-0" data-testid={`one-c-rop-${node.userId}`}>
      <div className="flex items-start gap-2 py-2">
        {!hideRopLink ? (
          <button
            type="button"
            className="mt-0.5 shrink-0 rounded p-1 hover:bg-muted"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={isOpen}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          {hideRopLink ? (
            <p className="font-semibold">{node.teamName}</p>
          ) : (
            <Link href={`/1c/rop/${node.userId}`} className="font-semibold text-primary hover:underline">
              {node.fullName}
            </Link>
          )}
          {!hideRopLink ? <span className="ml-2 text-xs text-muted-foreground">(РОП)</span> : null}
          <p className="text-sm text-muted-foreground">
            {node.rmCount} РМ · {node.managerCount} менеджеров · {node.storeCount.toLocaleString("ru-RU")} ТТ
          </p>
        </div>
      </div>
      {isOpen || hideRopLink ? (
        <div className={cn("space-y-3 pb-2", !hideRopLink && "ml-6 border-l pl-3")}>
          {node.rms.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">РМ ({node.rms.length})</p>
              <div className="space-y-0.5">
                {node.rms.map((rm) => (
                  <RmRow key={`${node.teamId}-${rm.userId}`} rm={rm} />
                ))}
              </div>
            </div>
          ) : null}
          {node.managers.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Менеджеры ({node.managers.length})
              </p>
              <div className="space-y-0.5">
                {node.managers.map((mgr) => (
                  <ManagerRow key={mgr.userId} mgr={mgr} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RmRow({ rm }: { rm: OneCRopNode["rms"][number] }) {
  const muted = rm.storeCount === 0;

  return (
    <div
      className={cn("flex items-center justify-between gap-2 py-1.5 text-sm", muted && "opacity-60")}
      data-testid={`one-c-rm-${rm.userId}`}
    >
      <div className="min-w-0">
        <Link href={`/1c/rm/${rm.userId}`} className="font-medium text-primary hover:underline">
          {rm.fullName}
        </Link>
        <span className="ml-2 text-xs text-muted-foreground">(РМ)</span>
      </div>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {rm.storeCount.toLocaleString("ru-RU")} ТТ
      </span>
    </div>
  );
}

function ManagerRow({ mgr }: { mgr: OneCRopNode["managers"][number] }) {
  const muted = mgr.storeCount === 0;
  return (
    <div
      className={cn("flex items-center justify-between gap-2 py-1 text-sm", muted && "text-muted-foreground")}
      data-testid={`one-c-manager-${mgr.userId}`}
    >
      <Link href={`/1c/manager/${mgr.userId}`} className="text-primary hover:underline">
        {mgr.fullName}
      </Link>
      <span className="shrink-0 tabular-nums">{mgr.storeCount.toLocaleString("ru-RU")} ТТ</span>
    </div>
  );
}

function RmTeamView({
  userName,
  userId,
  items,
}: {
  userName: string;
  userId: string;
  items: OneCRopNode[];
}) {
  const selfRm = items.flatMap((n) => n.rms).find((rm) => rm.userId === userId);
  const managers = items.flatMap((n) => n.managers);

  return (
    <div className="space-y-4" data-testid="view-one-c-rm-team">
      <div className="rounded-md border px-4 py-3">
        <p className="font-semibold">{userName}</p>
        <p className="text-sm text-muted-foreground">
          Региональный менеджер · {(selfRm?.storeCount ?? 0).toLocaleString("ru-RU")} ТТ
        </p>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Менеджеры ({managers.length})
        </p>
        <div className="rounded-md border px-3">
          {managers.length > 0 ? (
            managers.map((mgr) => <ManagerRow key={mgr.userId} mgr={mgr} />)
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Менеджеры не найдены</p>
          )}
        </div>
      </div>
    </div>
  );
}

function buildTeamSubtitle(role: string | undefined, items: OneCRopNode[]): string {
  const mgrs = items.reduce((s, r) => s + r.managers.length, 0);
  if (role === "regional_manager") {
    return `${mgrs} менеджеров (из ЛК)`;
  }
  if (role === "rop") {
    const rms = items.reduce((s, r) => s + r.rms.length, 0);
    return `${rms} РМ · ${mgrs} менеджеров (из ЛК)`;
  }
  const rops = items.length;
  const rms = items.reduce((s, r) => s + r.rms.length, 0);
  return `${rops} РОП · ${rms} РМ · ${mgrs} менеджеров (из ЛК)`;
}

export default function OneCTeamPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { searchQ, setSearchQ, debouncedQ } = useDebouncedSearch();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OneCRopNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;
  const searchActive = debouncedQ.length > 0;
  const isManager = user?.role === "manager";
  const isRm = user?.role === "regional_manager";
  const isRop = user?.role === "rop";

  useEffect(() => {
    if (!canAccess || isManager) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCHierarchy(debouncedQ)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Не удалось загрузить иерархию.");
          return;
        }
        setItems(res.items);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAccess, debouncedQ, isManager]);

  const subtitle = useMemo(() => buildTeamSubtitle(user?.role, items), [items, user?.role]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;
  if (isManager) return <Redirect to="/1c" />;

  return (
    <OneCPageShell
      path="/1c/team"
      title={isRm ? `Команда · ${user.fullName}` : "Команда"}
      subtitle={subtitle}
      testId="page-one-c-team"
      actions={<OneCRefreshStubButton />}
    >
      <OneCSearchInput
        value={searchQ}
        onChange={setSearchQ}
        placeholder="Поиск по ФИО…"
        testId="input-one-c-team-search"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : isRm ? (
        <RmTeamView userName={user.fullName} userId={user.id} items={items} />
      ) : (
        <div className="rounded-md border px-3" data-testid="tree-one-c-hierarchy">
          {items.map((rop) => (
            <RopRow
              key={rop.userId}
              node={rop}
              searchActive={searchActive}
              defaultOpen={isRop}
              hideRopLink={isRop}
            />
          ))}
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено</p>
          ) : null}
        </div>
      )}
    </OneCPageShell>
  );
}
