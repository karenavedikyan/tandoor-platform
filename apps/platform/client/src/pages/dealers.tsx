import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Building2, MapPin, UserCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status-badge";
import type { Dealer, Organization, User } from "@/lib/api-types";

export default function DealersPage() {
  const {
    data: dealers,
    isLoading: isDealersLoading,
    isError: isDealersError,
    error: dealersError,
  } = useQuery<Dealer[]>({
    queryKey: ["/api/dealers"],
  });

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const dealerCards = useMemo(() => {
    if (!dealers) {
      return [];
    }

    return dealers.map((dealer) => {
      const org = organizations?.find((organization) => organization.id === dealer.organizationId);
      const manager = users?.find((user) => user.id === dealer.managerUserId);

      return {
        ...dealer,
        organizationName: org?.name ?? `Dealer organization #${dealer.organizationId}`,
        city: org?.city ?? "N/A",
        managerName: manager ? `${manager.firstName} ${manager.lastName}` : "Not assigned",
      };
    });
  }, [dealers, organizations, users]);

  if (isDealersLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (isDealersError) {
    return (
      <Alert variant="destructive" data-testid="dealers-error-state">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load dealers</AlertTitle>
        <AlertDescription>
          {dealersError instanceof Error
            ? dealersError.message
            : "An unexpected error occurred while loading dealers."}
        </AlertDescription>
      </Alert>
    );
  }

  if (!dealerCards.length) {
    return (
      <Card data-testid="dealers-empty-state">
        <CardHeader>
          <CardTitle>No dealers yet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Dealer organizations will appear here once they are connected to the platform.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dealers</h1>
        <p className="text-sm text-muted-foreground">Regional partner network and account contacts.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dealerCards.map((dealer) => (
          <Card key={dealer.id} data-testid={`dealer-card-${dealer.id}`}>
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base">{dealer.organizationName}</CardTitle>
                <StatusBadge type="dealer" status={dealer.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {dealer.tier ? `${dealer.tier.toUpperCase()} segment` : "Standard segment"}
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  {dealer.region ?? "No region"}, {dealer.city}
                </span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                <span>Manager: {dealer.managerName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>Onboarded: {new Date(dealer.createdAt).toLocaleDateString("en-GB")}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
