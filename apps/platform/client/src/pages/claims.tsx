import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, MessageSquareWarning } from "lucide-react";
import type { Claim, Dealer, Order, Organization } from "@/lib/api-types";
import { formatDate, statusLabel } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export default function ClaimsPage() {
  const claimsQuery = useQuery<Claim[]>({
    queryKey: ["/api/claims"],
  });
  const dealersQuery = useQuery<Dealer[]>({
    queryKey: ["/api/dealers"],
  });
  const organizationsQuery = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });
  const ordersQuery = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const isLoading =
    claimsQuery.isLoading ||
    dealersQuery.isLoading ||
    organizationsQuery.isLoading ||
    ordersQuery.isLoading;
  const hasError =
    claimsQuery.isError ||
    dealersQuery.isError ||
    organizationsQuery.isError ||
    ordersQuery.isError;

  const dealerById = useMemo(() => {
    const dealers = dealersQuery.data ?? [];
    return new Map<number, Dealer>(dealers.map((dealer) => [dealer.id, dealer]));
  }, [dealersQuery.data]);

  const orgById = useMemo(() => {
    const organizations = organizationsQuery.data ?? [];
    return new Map<number, Organization>(organizations.map((org) => [org.id, org]));
  }, [organizationsQuery.data]);

  const orderById = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    return new Map<number, Order>(orders.map((order) => [order.id, order]));
  }, [ordersQuery.data]);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="claims-loading">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (hasError) {
    return (
      <Card data-testid="claims-error">
        <CardContent className="flex items-center gap-3 p-6 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive" />
          Не удалось загрузить данные по рекламациям.
        </CardContent>
      </Card>
    );
  }

  const claims = claimsQuery.data ?? [];

  if (claims.length === 0) {
    return (
      <Card data-testid="claims-empty">
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <MessageSquareWarning className="h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">Рекламации отсутствуют</p>
          <p className="text-sm text-muted-foreground">
            Здесь появятся обращения дилеров после создания рекламаций.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Рекламации</h1>
        <p className="text-sm text-muted-foreground">
          Рекламации и сервисные обращения в партнерском контуре.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base uppercase tracking-wide">Реестр рекламаций</CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="claims-table">
            <TableHeader>
              <TableRow>
                <TableHead>Рекламация</TableHead>
                <TableHead>Заказ</TableHead>
                <TableHead>Дилер</TableHead>
                <TableHead>Причина</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата создания</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim) => {
                const dealer = dealerById.get(claim.dealerId);
                const dealerOrganization = dealer
                  ? orgById.get(dealer.organizationId)
                  : undefined;
                const order = claim.orderId ? orderById.get(claim.orderId) : undefined;

                return (
                  <TableRow key={claim.id} data-testid={`claim-row-${claim.id}`}>
                    <TableCell className="font-medium">{claim.claimNumber}</TableCell>
                    <TableCell>{order?.orderNumber ?? "Не привязан"}</TableCell>
                    <TableCell>{dealerOrganization?.name ?? `Дилер #${claim.dealerId}`}</TableCell>
                    <TableCell>{statusLabel(claim.reason)}</TableCell>
                    <TableCell>
                      <StatusBadge type="claim" status={claim.status} />
                    </TableCell>
                    <TableCell>
                      {formatDate(claim.createdAt)}
                      {claim.resolutionNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">{claim.resolutionNote}</p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
