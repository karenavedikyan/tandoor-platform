import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ManagementCockpitSkeleton } from "@/components/skeletons/management-cockpit-skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessClients1cForUser } from "@/lib/auth-access";
import { fetchClientBaseOverview1c } from "@/lib/client-base-overview-1c-api";
import { useHashRouteSearchParams } from "@/lib/hash-route-utils";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { ClientsOneCManagementCockpit } from "@/pages/clients-1c-management-cockpit";

const ADMIN_COCKPIT_PROFILE: ReleaseDemoProfile = {
  role: "sales_director",
  personaUserId: "admin-clients-1c-overview",
};

export default function Clients1cOverviewPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const canAccess = user ? canAccessClients1cForUser(user.role) : false;

  const searchParams = useHashRouteSearchParams();
  const teamId = searchParams.get("teamId")?.trim() || undefined;
  const managerUserId = searchParams.get("managerUserId")?.trim() || undefined;

  const overviewQ = useQuery({
    queryKey: ["client-base-overview-1c", teamId, managerUserId],
    queryFn: () => fetchClientBaseOverview1c({ teamId, managerUserId }),
    enabled: canAccess,
    staleTime: 30_000,
  });

  const scopeTotalDealers = useMemo(() => {
    const s = overviewQ.data?.structure;
    if (!s) return null;
    return s.activeClients + s.potentialClients + s.attentionClients;
  }, [overviewQ.data?.structure]);

  if (userLoading) return <ManagementCockpitSkeleton />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;

  if (overviewQ.isLoading && !overviewQ.data) {
    return <ManagementCockpitSkeleton />;
  }

  if (overviewQ.isError) {
    return (
      <div className="space-y-4 p-4" data-testid="page-clients-1c-overview-error">
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {overviewQ.error instanceof Error
                ? overviewQ.error.message
                : "Не удалось загрузить обзор клиентской базы 1С."}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => void overviewQ.refetch()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ClientsOneCManagementCockpit
      rows={[]}
      profile={ADMIN_COCKPIT_PROFILE}
      overview={overviewQ.data ?? null}
      scopeTotalDealers={scopeTotalDealers}
      scopeAvgDistribution={overviewQ.data?.structure.averageDistributionPct ?? null}
    />
  );
}
