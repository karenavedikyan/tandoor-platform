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

const PHONE_RE = /^[+\d\s\-()]+$/;

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

export default function MyProfilePage() {
  const { user } = useCurrentUser();
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
    const ph = d.phone?.trim() ?? "";
    setFullName(fn);
    setPhone(ph);
    setBaseline({ fullName: fn, phone: ph });
  }, [profileQ.data]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return fullName.trim() !== baseline.fullName || phone.trim() !== baseline.phone;
  }, [baseline, fullName, phone]);

  const validationErr = useMemo(() => {
    const fn = fullName.trim();
    if (fn.length < 2 || fn.length > 200) {
      return "Укажите ФИО (от 2 до 200 символов).";
    }
    const ph = phone.trim();
    if (ph && (ph.length < 4 || ph.length > 32 || !PHONE_RE.test(ph))) {
      return "Укажите корректный телефон.";
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
      if (baseline && phone.trim() !== baseline.phone) {
        payload.phone = phone.trim() ? phone.trim() : null;
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
        <h1 className="text-xl font-semibold text-[#222631]">Мой профиль</h1>
        <p className="text-sm text-[#8F96B0]">Данные учётной записи и контакты.</p>
      </div>

      <Card className="border-[#E3E6F3]">
        <CardHeader>
          <CardTitle className="text-base">Данные учётной записи</CardTitle>
          <CardDescription>Email, роль и статус меняются только администратором.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {profileQ.isError ? <p className="text-destructive">Не удалось загрузить профиль.</p> : null}
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd className="mt-0.5 text-foreground">{p?.email ?? user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Роль (пилот)</dt>
              <dd className="mt-0.5 text-foreground">{releaseDemoRoleLabel(salesRole)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Роль (платформа)</dt>
              <dd className="mt-0.5 text-foreground">{rolesRuLabel(user.role)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Статус</dt>
              <dd className="mt-0.5 text-foreground">{p?.status ?? user.status}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Идентификатор</dt>
              <dd className="mt-0.5 font-mono text-xs text-foreground">{user.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Дата создания</dt>
              <dd className="mt-0.5 text-foreground">
                {p?.createdAt ? formatDisplayDateTime(p.createdAt) : user.createdAt ? formatDisplayDateTime(user.createdAt) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Последний вход</dt>
              <dd className="mt-0.5 text-foreground">
                {p?.lastLoginAt ? formatDisplayDateTime(p.lastLoginAt) : user.lastLoginAt ? formatDisplayDateTime(user.lastLoginAt) : "—"}
              </dd>
            </div>
          </dl>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="pf-fn">ФИО</Label>
            <Input
              id="pf-fn"
              data-testid="input-profile-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-h-11"
              disabled={profileQ.isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-ph">Телефон</Label>
            <Input
              id="pf-ph"
              data-testid="input-profile-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-11"
              placeholder="Необязательно"
              disabled={profileQ.isLoading}
            />
            <p className="text-xs text-muted-foreground">4–32 символа, допускаются цифры, +, пробелы, скобки и дефис.</p>
          </div>
          {submitErr ? <p className="text-sm text-destructive">{submitErr}</p> : null}
          <Button
            type="button"
            className="font-semibold"
            data-testid="button-profile-save"
            disabled={!dirty || !!validationErr || saving || profileQ.isLoading}
            onClick={() => void save()}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-[#E3E6F3]">
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


      <Card className="border-[#E3E6F3]" data-testid="section-self-sessions">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Устройство</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Истекает</TableHead>
                <TableHead className="text-right">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sessionsQ.data ?? []).map((s) => (
                <TableRow key={s.id} data-testid={`row-self-session-${s.id}`}>
                  <TableCell className="max-w-[220px] truncate text-xs" title={s.userAgent ?? ""}>
                    {s.userAgent ? s.userAgent.slice(0, 80) + (s.userAgent.length > 80 ? "…" : "") : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{s.ip ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{formatDisplayDateTime(s.expiresAt)}</TableCell>
                  <TableCell className="text-right">
                    {s.current ? (
                      <span className="text-xs text-muted-foreground">текущая</span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
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
        </CardContent>
      </Card>


      <p className="text-xs text-muted-foreground"> <strong>{displayUserName(user)}</strong>
      </p>
    </div>
  );
}
