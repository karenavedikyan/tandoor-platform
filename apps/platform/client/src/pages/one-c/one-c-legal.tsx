import { useEffect, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCLegal } from "@/lib/one-c-showroom-api";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CopyField,
  dash,
  formatDiscount,
  formatPlanSum,
  OneCDetailSection,
  OneCFieldRow,
  OneCLoadingBlock,
  OneCPageShell,
  OneCRefreshStubButton,
} from "./one-c-ui";
import { OneCStoresFilters } from "./one-c-stores-filters";
import { OneCStoresTable } from "./one-c-stores-table";
import { OneCStoresCardsList } from "./one-c-stores-cards";
import { OneCListDensityToggle } from "./one-c-list-density-toggle";
import { useOneCStoresListView } from "./use-one-c-stores-list";
import { useOneCListDensity } from "./use-one-c-list-density";
import { useOneCStoresColumns } from "./use-one-c-stores-columns";
import { OneCStoresColumnPicker } from "./one-c-stores-column-picker";

function LkPersonLink({
  userId,
  name,
  phone,
  hrefPrefix,
}: {
  userId: string | null;
  name: string | null;
  phone?: string | null;
  hrefPrefix: "/1c/manager" | "/1c/rm" | "/1c/rop";
}): React.ReactNode {
  if (!name?.trim()) return "—";
  const label = phone?.trim() ? `${name} · ${phone}` : name;
  if (userId) {
    return (
      <Link href={`${hrefPrefix}/${userId}`} className="text-primary hover:underline">
        {label}
      </Link>
    );
  }
  return (
    <span>
      {label} <span className="text-muted-foreground">(нет в ЛК)</span>
    </span>
  );
}

export default function OneCLegalPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [, params] = useRoute("/1c/legal/:id");
  const legalId = params?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [legal, setLegal] = useState<Awaited<ReturnType<typeof fetchOneCLegal>>["legal"] | null>(null);
  const [children, setChildren] = useState<Awaited<ReturnType<typeof fetchOneCLegal>>["children"]>([]);
  const [siblings, setSiblings] = useState<Awaited<ReturnType<typeof fetchOneCLegal>>["siblings"]>([]);
  const [stores, setStores] = useState<Awaited<ReturnType<typeof fetchOneCLegal>>["stores"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reqOpen, setReqOpen] = useState(true);
  const { density, setDensity, effectiveDensity } = useOneCListDensity(`legal-${legalId}`, "table");
  const { columns, toggleColumn, reorderColumns, resetColumns } = useOneCStoresColumns();

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;
  const nonTableView = effectiveDensity !== "table";
  const { act, filters, setFilters, filtered, distAggregates, distLoading } = useOneCStoresListView(stores, {
    nonTableView,
  });

  useEffect(() => {
    if (!canAccess || !legalId) return;
    let cancelled = false;
    setLoading(true);
    void fetchOneCLegal(legalId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Юрлицо не найдено.");
          setLegal(null);
          return;
        }
        setLegal(res.legal);
        setChildren(res.children);
        setSiblings(res.siblings ?? []);
        setStores(res.stores);
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
  }, [canAccess, legalId]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;
  if (!legalId) return <Redirect to="/1c/legals" />;

  const title = legal?.legal_name?.trim() || legal?.name || "Юрлицо";

  return (
    <OneCPageShell
      path={`/1c/legal/${legalId}`}
      breadcrumbLabels={{ legal: title }}
      title={title}
      subtitle={
        legal ? (
          <span className="flex flex-wrap items-center gap-3 text-sm">
            <span>{dash(legal.name)}</span>
            <span className="inline-flex items-center gap-1">
              ИНН <CopyField value={legal.inn} label="ИНН" />
            </span>
            <span>КПП {dash(legal.kpp)}</span>
            <span>ОГРН {dash(legal.ogrn)}</span>
            <span>
              {[legal.region, legal.city].filter(Boolean).join(" · ") || "—"}
            </span>
            {legal.parent_1c ? (
              <Badge variant="secondary" className="gap-1">
                Входит в холдинг{" "}
                <Link href={`/1c/legal/${legal.parent_1c}`} className="underline">
                  {dash(legal.parent_name)}
                </Link>
              </Badge>
            ) : null}
          </span>
        ) : undefined
      }
      testId="page-one-c-legal"
      actions={<OneCRefreshStubButton />}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : legal ? (
        <div className="space-y-4">
          <Collapsible open={reqOpen} onOpenChange={setReqOpen}>
            <CardLikeSection title="Реквизиты" testId="section-one-c-legal-details">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="mb-2 gap-1">
                  <ChevronDown className={cn("h-4 w-4 transition-transform", reqOpen && "rotate-180")} />
                  {reqOpen ? "Свернуть" : "Развернуть"}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3">
                <GroupTitle>Юридические</GroupTitle>
                <OneCFieldRow label="Полное наименование">{dash(legal.legal_name)}</OneCFieldRow>
                <OneCFieldRow label="ИНН">
                  <CopyField value={legal.inn} label="ИНН" />
                </OneCFieldRow>
                <OneCFieldRow label="КПП">
                  <CopyField value={legal.kpp} label="КПП" />
                </OneCFieldRow>
                <OneCFieldRow label="ОГРН">
                  <CopyField value={legal.ogrn} label="ОГРН" />
                </OneCFieldRow>
                <GroupTitle>Локация</GroupTitle>
                <OneCFieldRow label="Регион">{dash(legal.region)}</OneCFieldRow>
                <OneCFieldRow label="Город">{dash(legal.city)}</OneCFieldRow>
                <GroupTitle>Коммерческие</GroupTitle>
                <OneCFieldRow label="Тип клиента">{dash(legal.client_type)}</OneCFieldRow>
                <OneCFieldRow label="Форма оплаты">{dash(legal.payment_form)}</OneCFieldRow>
                <OneCFieldRow label="Номер MA">{dash(legal.ma_number)}</OneCFieldRow>
                <OneCFieldRow label="Скидка">
                  {formatDiscount(legal.discount_code, legal.discount_percent)}
                </OneCFieldRow>
                <GroupTitle>Контакты</GroupTitle>
                <OneCFieldRow label="Телефон">{dash(legal.phone)}</OneCFieldRow>
                <OneCFieldRow label="Email">{dash(legal.email)}</OneCFieldRow>
                <GroupTitle>План</GroupTitle>
                <OneCFieldRow label="Сумма плана">{formatPlanSum(legal.plan_sum)}</OneCFieldRow>
                <OneCFieldRow label="Ретро-бонус">{dash(legal.plan_retro_bonus)}</OneCFieldRow>
                <p className="text-xs text-muted-foreground">
                  Импортировано {formatDisplayDateTime(legal.imported_at)}
                </p>
              </CollapsibleContent>
            </CardLikeSection>
          </Collapsible>

          <OneCDetailSection title="Команда" testId="section-one-c-legal-team">
            <OneCFieldRow label="Ответственный менеджер">
              <LkPersonLink
                userId={legal.responsible_manager_user_id}
                name={legal.responsible_manager_name}
                hrefPrefix="/1c/manager"
              />
            </OneCFieldRow>
            <OneCFieldRow label="Региональный менеджер">
              <LkPersonLink
                userId={legal.regional_manager_user_id}
                name={legal.regional_manager_name}
                hrefPrefix="/1c/rm"
              />
            </OneCFieldRow>
            <OneCFieldRow label="Фурнитурный менеджер">
              {legal.furniture_manager_name ? (
                <>
                  {legal.furniture_manager_name}
                  {legal.furniture_manager_phone ? ` · ${legal.furniture_manager_phone}` : null}
                </>
              ) : (
                "—"
              )}
            </OneCFieldRow>
            <OneCFieldRow label="РОП">
              <LkPersonLink userId={legal.rop_user_id} name={legal.rop_name} hrefPrefix="/1c/rop" />
            </OneCFieldRow>
          </OneCDetailSection>

          <OneCDetailSection title="Торговые точки" testId="section-one-c-legal-stores">
            {stores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет торговых точек</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <OneCListDensityToggle value={density} onChange={setDensity} testIdPrefix="one-c-legal-stores" />
                </div>
                <OneCStoresFilters
                  items={stores}
                  filters={filters}
                  onFiltersChange={setFilters}
                  distAggregates={distAggregates}
                  distLoading={distLoading}
                  disableDistributionFilters={nonTableView}
                  filteredCount={filtered.length}
                  testIdPrefix="one-c-legal-stores"
                  headerActions={
                    effectiveDensity === "table" ? (
                      <OneCStoresColumnPicker
                        columns={columns}
                        onToggleColumn={toggleColumn}
                        onReorderColumns={reorderColumns}
                        onResetColumns={resetColumns}
                        testIdPrefix="one-c-legal-stores"
                      />
                    ) : null
                  }
                />
                {effectiveDensity === "table" ? (
                  <OneCStoresTable
                    items={filtered}
                    columns={columns}
                    act={act}
                    emptyLabel="Торговые точки не найдены"
                    testIdPrefix="one-c-legal-stores"
                  />
                ) : (
                  <OneCStoresCardsList
                    items={filtered}
                    density={effectiveDensity}
                    act={act}
                    emptyLabel="Торговые точки не найдены"
                    testIdPrefix="one-c-legal-stores"
                  />
                )}
              </div>
            )}
          </OneCDetailSection>

          {legal.parent_1c ? (
            <OneCDetailSection title="Холдинг" testId="section-one-c-legal-holding">
              <OneCFieldRow label="Родитель">
                <Link href={`/1c/legal/${legal.parent_1c}`} className="text-primary hover:underline">
                  {dash(legal.parent_name)} {legal.parent_inn ? `· ${legal.parent_inn}` : ""}
                </Link>
              </OneCFieldRow>
              {siblings.length > 0 ? (
                <SiblingTable title="Другие юрлица холдинга" rows={siblings} />
              ) : null}
            </OneCDetailSection>
          ) : null}

          {children.length > 0 ? (
            <OneCDetailSection title="Дочерние юрлица" testId="section-one-c-legal-children">
              <SiblingTable title="" rows={children} />
            </OneCDetailSection>
          ) : null}

          {/* TODO: агрегированная дистрибуция по всем ТТ клиента — следующий PR */}
        </div>
      ) : null}
    </OneCPageShell>
  );
}

function CardLikeSection({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <OneCDetailSection title={title} testId={testId}>
      {children}
    </OneCDetailSection>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

function SiblingTable({
  title,
  rows,
}: {
  title: string;
  rows: { id_1c: string; name: string; inn: string | null }[];
}) {
  return (
    <div className="space-y-2">
      {title ? <p className="text-sm font-medium">{title}</p> : null}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>ИНН</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((child) => (
              <TableRow key={child.id_1c}>
                <TableCell>
                  <Link href={`/1c/legal/${child.id_1c}`} className="text-primary hover:underline">
                    {child.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{dash(child.inn)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
