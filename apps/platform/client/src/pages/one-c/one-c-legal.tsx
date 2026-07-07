import { useEffect, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchOneCLegal } from "@/lib/one-c-showroom-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function LkPersonLink({
  userId,
  name,
  hrefPrefix,
}: {
  userId: string | null;
  name: string | null;
  hrefPrefix: "/1c/manager" | "/1c/rm";
}): React.ReactNode {
  if (!name?.trim()) return "—";
  if (userId) {
    return (
      <Link href={`${hrefPrefix}/${userId}`} className="text-primary hover:underline">
        {name}
      </Link>
    );
  }
  return (
    <span>
      {name} <span className="text-muted-foreground">(нет в ЛК)</span>
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
  const [stores, setStores] = useState<Awaited<ReturnType<typeof fetchOneCLegal>>["stores"]>([]);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

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
            <span className="inline-flex items-center gap-1">
              ИНН <CopyField value={legal.inn} label="ИНН" />
            </span>
            <span className="inline-flex items-center gap-1">
              КПП <CopyField value={legal.kpp} label="КПП" />
            </span>
            <span className="inline-flex items-center gap-1">
              ОГРН <CopyField value={legal.ogrn} label="ОГРН" />
            </span>
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
          <OneCDetailSection title="Реквизиты" testId="section-one-c-legal-details">
            <OneCFieldRow label="Краткое имя">{dash(legal.name)}</OneCFieldRow>
            <OneCFieldRow label="Полное наименование">{dash(legal.legal_name)}</OneCFieldRow>
            <OneCFieldRow label="Регион">{dash(legal.region)}</OneCFieldRow>
            <OneCFieldRow label="Город">{dash(legal.city)}</OneCFieldRow>
            <OneCFieldRow label="Тип клиента">{dash(legal.client_type)}</OneCFieldRow>
            <OneCFieldRow label="Форма оплаты">{dash(legal.payment_form)}</OneCFieldRow>
            <OneCFieldRow label="Номер MA">{dash(legal.ma_number)}</OneCFieldRow>
            <OneCFieldRow label="Телефон">{dash(legal.phone)}</OneCFieldRow>
            <OneCFieldRow label="Email">{dash(legal.email)}</OneCFieldRow>
            <OneCFieldRow label="Скидка">{formatDiscount(legal.discount_code, legal.discount_percent)}</OneCFieldRow>
          </OneCDetailSection>

          <OneCDetailSection title="Менеджеры" testId="section-one-c-legal-managers">
            <OneCFieldRow label="Региональный">
              <LkPersonLink
                userId={legal.regional_manager_user_id}
                name={legal.regional_manager_name}
                hrefPrefix="/1c/rm"
              />
            </OneCFieldRow>
            <OneCFieldRow label="Ответственный">
              <LkPersonLink
                userId={legal.responsible_manager_user_id}
                name={legal.responsible_manager_name}
                hrefPrefix="/1c/manager"
              />
            </OneCFieldRow>
            <OneCFieldRow label="Фурнитура">
              {legal.furniture_manager_name ? (
                <>
                  {legal.furniture_manager_name}
                  {legal.furniture_manager_phone ? ` · ${legal.furniture_manager_phone}` : null}
                </>
              ) : (
                "—"
              )}
            </OneCFieldRow>
          </OneCDetailSection>

          <OneCDetailSection title="План" testId="section-one-c-legal-plan">
            <OneCFieldRow label="Сумма плана">{formatPlanSum(legal.plan_sum)}</OneCFieldRow>
            <OneCFieldRow label="Ретро-бонус">{dash(legal.plan_retro_bonus)}</OneCFieldRow>
          </OneCDetailSection>

          {legal.parent_1c ? (
            <OneCDetailSection title="Холдинг" testId="section-one-c-legal-parent">
              <Link
                href={`/1c/legal/${legal.parent_1c}`}
                className="inline-flex flex-wrap items-center gap-2 text-primary hover:underline"
              >
                <span>{dash(legal.parent_name)}</span>
                {legal.parent_inn ? (
                  <span className="font-mono text-sm text-muted-foreground">{legal.parent_inn}</span>
                ) : null}
              </Link>
            </OneCDetailSection>
          ) : null}

          {children.length > 0 ? (
            <OneCDetailSection title="Дочерние юрлица" testId="section-one-c-legal-children">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>ИНН</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {children.map((child) => (
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
            </OneCDetailSection>
          ) : null}

          <OneCDetailSection title="Торговые точки" testId="section-one-c-legal-stores">
            {stores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет торговых точек</p>
            ) : (
              <div className="rounded-md border">
                <Table data-testid="table-one-c-legal-stores">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Адрес</TableHead>
                      <TableHead>Менеджер</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((row) => (
                      <TableRow key={row.id_1c}>
                        <TableCell>
                          <Link href={`/1c/store/${row.id_1c}`} className="text-primary hover:underline">
                            {dash(row.address)}
                          </Link>
                        </TableCell>
                        <TableCell>{dash(row.manager_name)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </OneCDetailSection>
        </div>
      ) : null}
    </OneCPageShell>
  );
}
