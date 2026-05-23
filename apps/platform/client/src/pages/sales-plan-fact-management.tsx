import { useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SalesPlanFactManagementCockpit } from "@/components/sales-plan-fact-management-cockpit";
import { useSalesPlanFactPersistedState } from "@/hooks/use-sales-plan-fact-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { getSalesUserById, type SalesRole } from "@/lib/sales-control-data";
import { normalizeSalesPlanFactState } from "@/lib/sales-plan-fact-types";

export default function SalesPlanFactManagementPage() {
  const { user } = useCurrentUser();
  const { profile } = useReleaseDemoProfile();
  const role = (user?.role ?? profile.role) as SalesRole;
  const persona = useMemo(() => getSalesUserById(profile.personaUserId), [profile.personaUserId]);

  const { state, loading, saving, error, storageMessage, persist } = useSalesPlanFactPersistedState(profile);

  if (!persona || (role !== "sales_director" && role !== "team_lead" && role !== "sales_manager")) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4" data-testid="page-sales-plan-fact-management">
        <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-muted-foreground hover:text-foreground">
          <Link href="/main">← На главную</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Раздел доступен ролям директор, РОП и менеджер.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-3 pb-12 pt-4 sm:px-4" data-testid="page-sales-plan-fact-management">
      <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-muted-foreground hover:text-foreground">
        <Link href="/main">← На главную</Link>
      </Button>
      <SalesPlanFactManagementCockpit
        profile={profile}
        role={role}
        persona={persona}
        dealers={DEALER_BASE_ROWS}
        state={state}
        loading={loading}
        saving={saving}
        storageMessage={storageMessage}
        apiError={error}
        onPersist={async (next) => {
          await persist(normalizeSalesPlanFactState(next));
        }}
      />
    </div>
  );
}
