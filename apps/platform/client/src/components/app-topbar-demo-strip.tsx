import { ReleaseDemoRoleSwitcher } from "@/components/release-demo-role-switcher";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { getSalesUserById } from "@/lib/sales-control-data";
import { releaseDemoRoleLabel } from "@/lib/release-demo-profile";

export function AppTopbarDemoStrip() {
  const { profile } = useReleaseDemoProfile();
  const u = getSalesUserById(profile.personaUserId);
  return (
    <div className="flex min-w-0 max-w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
      <ReleaseDemoRoleSwitcher variant="bar" />
      <span
        className="hidden max-w-[14rem] truncate rounded-md border border-border/70 bg-muted/50 px-2 py-1 text-[11px] font-medium text-secondary-foreground xl:inline-block"
        data-testid="text-release-demo-context"
        title={`${releaseDemoRoleLabel(profile.role)} — ${u?.name ?? ""}`}
      >
        {releaseDemoRoleLabel(profile.role)} · {u?.name ?? ""}
      </span>
    </div>
  );
}
