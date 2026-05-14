import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import {
  defaultPersonaForRole,
  listPersonasForRole,
  releaseDemoRoleLabel,
} from "@/lib/release-demo-profile";
import type { SalesRole } from "@/lib/sales-control-data";

const ROLES: SalesRole[] = ["sales_director", "team_lead", "sales_manager", "analyst", "marketer"];

export function ReleaseDemoRoleSwitcher({ variant = "bar" }: { variant?: "bar" | "stacked" }) {
  const { profile, setProfile } = useReleaseDemoProfile();

  function setRole(role: SalesRole) {
    const personaUserId = defaultPersonaForRole(role);
    setProfile({ role, personaUserId });
  }

  function setPersona(personaUserId: string) {
    setProfile({ ...profile, personaUserId });
  }

  const personas = listPersonasForRole(profile.role);

  const inner = (
    <>
      <div className={variant === "bar" ? "flex min-w-0 flex-col gap-1 sm:max-w-[140px]" : "flex flex-col gap-1"}>
        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Роль</Label>
        <Select value={profile.role} onValueChange={(v) => setRole(v as SalesRole)}>
          <SelectTrigger className="h-9 min-h-9 text-xs" data-testid="select-release-demo-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                {releaseDemoRoleLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={variant === "bar" ? "flex min-w-0 flex-col gap-1 sm:max-w-[160px]" : "flex flex-col gap-1"}>
        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Персона</Label>
        <Select value={profile.personaUserId} onValueChange={setPersona}>
          <SelectTrigger className="h-9 min-h-9 text-xs" data-testid="select-release-demo-persona">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {personas.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  if (variant === "bar") {
    return (
      <div
        className="flex min-w-0 max-w-full flex-wrap items-end gap-2 rounded-lg border border-dashed border-primary/35 bg-primary/5 px-2 py-1.5 sm:gap-3"
        data-testid="section-release-demo-role-switcher"
      >
        {inner}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3" data-testid="section-release-demo-role-switcher">
      {inner}
    </div>
  );
}
