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

function countLabel(n: number, word: string): string {
  return `${n} ${word}`;
}

function RopRow({
  node,
  searchActive,
  defaultOpen,
}: {
  node: OneCRopNode;
  searchActive: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = searchActive ? true : open;

  return (
    <div className="border-b last:border-b-0" data-testid={`one-c-rop-${node.userId}`}>
      <div className="flex items-start gap-2 py-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 rounded p-1 hover:bg-muted"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/1c/rop/${node.userId}`} className="font-semibold text-primary hover:underline">
            {node.fullName}
          </Link>
          <span className="ml-2 text-xs text-muted-foreground">(РОП)</span>
          <p className="text-sm text-muted-foreground">
            {node.rmCount} РМ · {node.managerCount} менеджеров · {node.storeCount.toLocaleString("ru-RU")} ТТ
          </p>
        </div>
      </div>
      {isOpen ? (
        <div className="ml-6 space-y-1 border-l pl-3 pb-2">
          {node.rms.map((rm) => (
            <RmBlock key={`${node.teamId}-${rm.userId}`} rm={rm} searchActive={searchActive} defaultOpen={defaultOpen} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RmBlock({
  rm,
  searchActive,
  defaultOpen,
}: {
  rm: OneCRopNode["rms"][number];
  searchActive: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = searchActive ? true : open;
  const muted = rm.storeCount === 0 && rm.managers.every((m) => m.storeCount === 0);

  return (
    <div className={cn(muted && "opacity-60")} data-testid={`one-c-rm-${rm.userId}`}>
      <div className="flex items-start gap-2 py-1.5">
        <button
          type="button"
          className="mt-0.5 shrink-0 rounded p-1 hover:bg-muted"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/1c/rm/${rm.userId}`} className="font-medium text-primary hover:underline">
            {rm.fullName}
          </Link>
          <span className="ml-2 text-xs text-muted-foreground">(РМ)</span>
          <p className="text-xs text-muted-foreground">
            {countLabel(rm.managers.length, "менедж.")} · {rm.storeCount.toLocaleString("ru-RU")} ТТ
          </p>
        </div>
      </div>
      {isOpen ? (
        <div className="ml-6 space-y-0.5 border-l pl-3 pb-1">
          {rm.managers.map((mgr) => (
            <ManagerRow key={mgr.userId} mgr={mgr} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ManagerRow({ mgr }: { mgr: OneCRopNode["rms"][number]["managers"][number] }) {
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

export default function OneCTeamPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { searchQ, setSearchQ, debouncedQ } = useDebouncedSearch();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OneCRopNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;
  const searchActive = debouncedQ.length > 0;

  useEffect(() => {
    if (!canAccess) return;
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
  }, [canAccess, debouncedQ]);

  const subtitle = useMemo(() => {
    const rops = items.length;
    const rms = items.reduce((s, r) => s + r.rms.length, 0);
    const mgrs = items.reduce((s, r) => s + r.rms.reduce((ss, rm) => ss + rm.managers.length, 0), 0);
    return `${rops} РОП · ${rms} РМ · ${mgrs} менеджеров (из ЛК)`;
  }, [items]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;

  return (
    <OneCPageShell
      path="/1c/team"
      title="Команда"
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
      ) : (
        <div className="rounded-md border px-3" data-testid="tree-one-c-hierarchy">
          {items.map((rop) => (
            <RopRow key={rop.userId} node={rop} searchActive={searchActive} defaultOpen={false} />
          ))}
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено</p>
          ) : null}
        </div>
      )}
    </OneCPageShell>
  );
}
