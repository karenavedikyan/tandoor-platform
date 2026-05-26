/**
 * Мой профиль: просмотр учётных данных и редактирование ФИО и телефона.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useHashLocation } from "wouter/use-hash-location";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayUserName, useCurrentUser } from "@/hooks/use-current-user";
import { useOnboardingUi } from "@/context/onboarding-ui-context";
import { releaseDemoRoleLabel } from "@/lib/release-demo-profile";
import { userRoleToSalesRole } from "@/lib/role-mapping";
import { getSelf, updateSelf, type ProfileSelfDTO } from "@/lib/profile-api";
import { invalidateAuthUser } from "@/hooks/use-auth-user";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listSelfSessions, revokeOtherSelfSessions, revokeSelfSession } from "@/lib/sessions-self-api";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidRussianPhone, normalizeToCanonical } from "@/lib/phone-format";
import { cn } from "@/lib/utils";

function rolesRuLabel(role: string): string {
  const m: Record<string, string> = {
    director: "Директор",
    rop: "РОП",
    regional_manager: "Региональный менеджер",
    manager: "Менеджер",
    marketer: "Маркетолог",
    analyst: "Аналитик",
    admin: "Администратор",
  };
  return m[role] ?? role;
}

const readOnlyInputClass =
  "min-h-11 cursor-default border-transparent bg-muted text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";

export default function MyProfilePage() {
  const { user } = useCurrentUser();
  const { reopenOnboarding } = useOnboardingUi();
  const qc = useQueryClient();
  const [, setLoc] = useHashLocation();

  const profileQ = useQuery({
    queryKey: ["profile-self"],
    queryFn: getSelf,
    enabled: !!user,
  });

  const sessionsQ = useQuery({
    queryKey: ["self-sessions"],
    queryFn: listSelfSessions,
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [baseline, setBaseline] = useState<{ fullName: string; phone: string } | null>(null);
  const [submitErr, setSubmitErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = profileQ.data;
    if (!d) return;
    const fn = d.fullName?.trim() ?? "";
    const phRaw = d.phone?.trim() ?? "";
    let ph = "";
    if (phRaw) {
      const c = normalizeToCanonical(phRaw);
      ph = isValidRussianPhone(c) ? c : phRaw;
    }
    setFullName(fn);
    setPhone(ph);
    setBaseline({ fullName: fn, phone: ph });
  }, [profileQ.data]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return fullName.trim() !== baseline.fullName || phone !== baseline.phone;
  }, [baseline, fullName, phone]);

  const validationErr = useMemo(() => {
    const fn = fullName.trim();
    if (fn.length < 2 || fn.length > 200) {
      return "Укажите ФИО (от 2 до 200 символов).";
    }
    if (phone !== "" && !isValidRussianPhone(phone)) {
      return "Введите 10 цифр номера после +7.";
    }
    return "";
  }, [fullName, phone]);

  if (!user) {
    return null;
  }

  const salesRole = userRoleToSalesRole(user.role);
  const p: ProfileSelfDTO | undefined = profileQ.data;

  const save = async () => {
    setSubmitErr("");
    if (validationErr) {
      setSubmitErr(validationErr);
      return;
    }
    setSaving(true);
    try {
      const payload: { fullName?: string; phone?: string | null } = {};
      if (baseline && fullName.trim() !== baseline.fullName) payload.fullName = fullName.trim();
      if (baseline && phone !== baseline.phone) {
        payload.phone = phone === "" ? null : phone;
      }
      if (Object.keys(payload).length === 0) return;
      await updateSelf(payload);
      toast({ title: "Профиль обновлён" });
      await invalidateAuthUser(qc);
      await qc.invalidateQueries({ queryKey: ["profile-self"] });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setSubmitErr(m);
    } finally {
      setSaving(false);
    }
  };

  const onRevokeSession = async (id: string) => {
    try {
      await revokeSelfSession(id);
      await qc.invalidateQueries({ queryKey: ["self-sessions"] });
      toast({ title: "Сессия завершена" });
    } catch (e) {
      const m = e instanceof Error ? e.message : "Не удалось отозвать сессию.";
      toast({ title: "Ошибка", description: m, variant: "destructive" });
    }
  };

  const onRevokeOthers = async () => {
    try {
      const { revoked } = await revokeOtherSelfSessions();
      await qc.invalidateQueries({ queryKey: ["self-sessions"] });
      toast({ title: "Сессии завершены", description: `Завершено сессий: ${revoked}.` });
    } catch (e) {
      const m = e instanceof Error ? e.message : "Не удалось завершить сессии.";
      toast({ title: "Ошибка", description: m, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-16" data-testid="page-my-profile">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Мой профиль</h1>
        <p className="text-sm text-muted-foreground">Данные учётной записи и контакты.</p>
        <Button type="button" variant="outline" className="mt-2 font-semibold" onClick={() => reopenOnboarding()}>
          Открыть онбординг повторно
        </Button>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Данные учётной записи</CardTitle>
          <CardDescription>Email, роль и статус меняются только администратором.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {profileQ.isError ? <p className="text-destructive">Не удалось загрузить профиль.</p> : null}
          <div className="space-y-2">
            <Label htmlFor="pf-email-ro">Email</Label>
            <Input id="pf-email-ro" readOnly tabIndex={-1} value={p?.email ?? user.email} className={readOnlyInputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-role-demo-ro">Роль (пилот)</Label>
            <Input id="pf-role-demo-ro" readOnly tabIndex={-1} value={releaseDemoRoleLabel(salesRole)} className={readOnlyInputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-role-platform-ro">Роль (платформа)</Label>
            <Input id="pf-role-platform-ro" readOnly tabIndex={-1} value={rolesRuLabel(user.role)} className={readOnlyInputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-status-ro">Статус</Label>
            <Input id="pf-status-ro" readOnly tabIndex={-1} value={p?.status ?? user.status} className={readOnlyInputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-id-ro">Идентификатор</Label>
            <Input id="pf-id-ro" readOnly tabIndex={-1} value={user.id} className={cn(readOnlyInputClass, "font-mono text-xs")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-created-ro">Дата создания</Label>
            <Input
              id="pf-created-ro"
              readOnly
              tabIndex={-1}
              value={p?.createdAt ? formatDisplayDateTime(p.createdAt) : user.createdAt ? formatDisplayDateTime(user.createdAt) : "—"}
              className={readOnlyInputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-last-ro">Последний вход</Label>
            <Input
              id="pf-last-ro"
              readOnly
              tabIndex={-1}
              value={p?.lastLoginAt ? formatDisplayDateTime(p.lastLoginAt) : user.lastLoginAt ? formatDisplayDateTime(user.lastLoginAt) : "—"}
              className={readOnlyInputClass}
            />
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="pf-fn">ФИО</Label>
            <Input
              id="pf-fn"
              data-testid="input-profile-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-h-11 border-border bg-card focus-visible:ring-2 focus-visible:ring-primary"
              disabled={profileQ.isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-ph">Телефон</Label>
            <PhoneInput
              id="pf-ph"
              data-testid="input-profile-phone"
              value={phone}
              onChange={setPhone}
              className="min-h-11 border-border bg-card focus-visible:ring-2 focus-visible:ring-primary"
              disabled={profileQ.isLoading}
            />
            {phone !== "" && !isValidRussianPhone(phone) ? (
              <p className="text-sm text-destructive" data-testid="text-profile-phone-error">
                Введите 10 цифр номера после +7.
              </p>
            ) : null}
          </div>
          {submitErr ? <p className="text-sm text-destructive">{submitErr}</p> : null}
          <Button
            type="button"
            className="bg-primary font-semibold text-primary-foreground hover:bg-[hsl(var(--figma-primary-hover))] disabled:opacity-60"
            data-testid="button-profile-save"
            disabled={!dirty || !!validationErr || saving || profileQ.isLoading}
            onClick={() => void save()}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Безопасность</CardTitle>
          <CardDescription>Смена пароля на отдельной странице.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" className="font-semibold" onClick={() => setLoc("/profile/change-password")}>
            Сменить пароль
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border bg-card shadow-sm" data-testid="section-self-sessions">
        <CardHeader>
          <CardTitle className="text-base">Активные сессии</CardTitle>
          <CardDescription>Устройства, с которых выполнен вход в аккаунт.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionsQ.isError ? (
            <p className="text-sm text-destructive">Не удалось загрузить список сессий.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" data-testid="button-self-sessions-revoke-others">
                  Завершить остальные сессии
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Завершить остальные сессии</AlertDialogTitle>
                  <AlertDialogDescription>
                    Будут завершены все сессии, кроме текущего устройства. Продолжить?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel type="button">Отмена</AlertDialogCancel>
                  <AlertDialogAction type="button" onClick={() => void onRevokeOthers()}>
                    Завершить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Устройство</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">IP</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Истекает</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sessionsQ.data ?? []).map((s) => (
                  <TableRow key={s.id} className="min-h-12 border-b border-border hover:bg-muted/40" data-testid={`row-self-session-${s.id}`}>
                    <TableCell className="max-w-[220px] truncate text-xs text-foreground" title={s.userAgent ?? ""}>
                      {s.userAgent ? s.userAgent.slice(0, 80) + (s.userAgent.length > 80 ? "…" : "") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">{s.ip ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDisplayDateTime(s.expiresAt)}</TableCell>
                    <TableCell className="text-right">
                      {s.current ? (
                        <span className="text-xs text-muted-foreground">текущая</span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          data-testid={`button-self-session-revoke-${s.id}`}
                          onClick={() => void onRevokeSession(s.id)}
                        >
                          Отозвать
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(sessionsQ.data?.length ?? 0) === 0 && !sessionsQ.isFetching ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Нет активных сессий.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {(sessionsQ.data ?? []).map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6" data-testid={`row-self-session-${s.id}`}>
                <p className="text-xs text-foreground break-all" title={s.userAgent ?? ""}>
                  {s.userAgent ? s.userAgent.slice(0, 120) + (s.userAgent.length > 120 ? "…" : "") : "—"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">IP: {s.ip ?? "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Истекает: {formatDisplayDateTime(s.expiresAt)}</p>
                <div className="mt-3">
                  {s.current ? (
                    <span className="text-xs text-muted-foreground">текущая сессия</span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 sm:w-auto"
                      data-testid={`button-self-session-revoke-${s.id}`}
                      onClick={() => void onRevokeSession(s.id)}
                    >
                      Отозвать
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {(sessionsQ.data?.length ?? 0) === 0 && !sessionsQ.isFetching ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">Нет активных сессий.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">{displayUserName(user)}</strong>
      </p>
    </div>
  );
}
