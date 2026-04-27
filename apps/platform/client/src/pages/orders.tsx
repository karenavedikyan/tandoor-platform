import { Link } from "wouter";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/status-badge";
import type { Dealer, Order, Organization } from "@/lib/api-types";
import { formatCurrency, formatDate } from "@/lib/format";

function OrdersTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <Skeleton key={idx} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const {
    data: orders,
    isLoading: isOrdersLoading,
    isError: isOrdersError,
    error: ordersError,
  } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: dealers } = useQuery<Dealer[]>({
    queryKey: ["/api/dealers"],
  });
  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const dealerById = new Map((dealers ?? []).map((dealer) => [dealer.id, dealer]));
  const organizationById = new Map((organizations ?? []).map((organization) => [organization.id, organization]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="page-title-orders">
          Orders
        </h1>
        <p className="text-sm text-muted-foreground">Order pipeline across dealer operations.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Order registry</CardTitle>
        </CardHeader>
        <CardContent>
          {isOrdersLoading ? (
            <OrdersTableSkeleton />
          ) : isOrdersError ? (
            <Alert variant="destructive" data-testid="orders-error-state">
              <AlertTitle>Unable to load orders</AlertTitle>
              <AlertDescription>{ordersError.message}</AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-xl border border-border bg-white">
              <Table data-testid="orders-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expected shipment</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders?.map((order) => {
                    const dealer = dealerById.get(order.dealerId);
                    const dealerOrganization = dealer
                      ? organizationById.get(dealer.organizationId)
                      : undefined;
                    return (
                      <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>{dealerOrganization?.name ?? `Dealer #${order.dealerId}`}</TableCell>
                        <TableCell>
                          <OrderStatusBadge status={order.status} />
                        </TableCell>
                        <TableCell>{formatCurrency(order.totalCents, order.currency)}</TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          {order.requestedDeliveryDate
                            ? formatDate(order.requestedDeliveryDate)
                            : "TBD"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" className="rounded-full" data-testid={`view-order-${order.id}`}>
                            <Link href={`/orders/${order.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
