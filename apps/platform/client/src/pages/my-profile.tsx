import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCurrentUser } from "@/hooks/use-current-user";
import { releaseDemoRoleLabel } from "@/lib/release-demo-profile";

/**
 * Skeleton «Мой профиль» (mock-auth). Редактирование — в PR auth-profile-cd7c.
 */
export default function MyProfilePage() {
  const { user } = useCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6" data-testid="page-my-profile">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-[#222631]">Мой профиль</h1>
        <p className="text-sm text-[#8F96B0]">Текущая сессия пилота (mock-auth), только просмотр.</p>
      </div>

      <Alert className="border-[#E3E6F3] bg-[#F7F8FC] text-[#222631]">
        <AlertTitle>Редактирование позже</AlertTitle>
        <AlertDescription>
          Редактирование профиля подключится в <span className="font-mono text-xs">auth-profile-cd7c</span>. Контекст:{" "}
          <span className="font-mono text-xs">docs/auth-access-foundation.md</span>.
        </AlertDescription>
      </Alert>

      <dl className="space-y-3 rounded-lg border border-[#E3E6F3] bg-card px-4 py-4 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">ФИО</dt>
          <dd className="mt-0.5 font-medium text-foreground">{user.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Роль</dt>
          <dd className="mt-0.5 text-foreground">{releaseDemoRoleLabel(user.role)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Идентификатор</dt>
          <dd className="mt-0.5 font-mono text-xs text-foreground">{user.id}</dd>
        </div>
        {user.teamId ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Команда (пилот)</dt>
            <dd className="mt-0.5 font-mono text-xs text-foreground">{user.teamId}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
