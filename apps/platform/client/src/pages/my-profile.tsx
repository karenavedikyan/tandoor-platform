import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { displayUserName, useCurrentUser } from "@/hooks/use-current-user";
import { releaseDemoRoleLabel } from "@/lib/release-demo-profile";
import { userRoleToSalesRole } from "@/lib/role-mapping";

/**
 * Карточка «Мой профиль» по данным `GET /api/auth/me`. Редактирование — PR auth-profile-cd7c.
 */
export default function MyProfilePage() {
  const { user } = useCurrentUser();

  if (!user) {
    return null;
  }

  const salesRole = userRoleToSalesRole(user.role);

  return (
    <div className="mx-auto max-w-xl space-y-6" data-testid="page-my-profile">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-[#222631]">Мой профиль</h1>
        <p className="text-sm text-[#8F96B0]">Данные учётной записи (только просмотр в этом PR).</p>
      </div>

      <Alert className="border-[#E3E6F3] bg-[#F7F8FC] text-[#222631]">
        <AlertTitle>Редактирование позже</AlertTitle>
        <AlertDescription>
          Смена пароля и полей профиля подключится в <span className="font-mono text-xs">auth-profile-cd7c</span>. Контекст:{" "}
          <span className="font-mono text-xs">docs/auth-access-foundation.md</span>.
        </AlertDescription>
      </Alert>

      <dl className="space-y-3 rounded-lg border border-[#E3E6F3] bg-card px-4 py-4 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">ФИО</dt>
          <dd className="mt-0.5 font-medium text-foreground">{displayUserName(user)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
          <dd className="mt-0.5 text-foreground">{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Роль (пилот)</dt>
          <dd className="mt-0.5 text-foreground">{releaseDemoRoleLabel(salesRole)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Статус</dt>
          <dd className="mt-0.5 text-foreground">{user.status}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Идентификатор</dt>
          <dd className="mt-0.5 font-mono text-xs text-foreground">{user.id}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Последний вход</dt>
          <dd className="mt-0.5 font-mono text-xs text-foreground">{user.lastLoginAt ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
