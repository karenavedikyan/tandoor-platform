/**
 * Публичная страница принятия приглашения по одноразовой ссылке `/invite/:token`.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@shared/auth";
import { acceptInvitation, previewInvitation } from "@/lib/invitations-api";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
import { TandoorLogo } from "@/components/tandoor-logo";
import { invalidateAuthUser } from "@/hooks/use-auth-user";
import { queryClient } from "@/lib/queryClient";

const rolesRu: Record<UserRole, string> = {
  director: "Директор",
  rop: "РОП",
  regional_manager: "Региональный менеджер",
  manager: "Менеджер",
  marketer: "Маркетолог",
  analyst: "Аналитик",
  admin: "Администратор",
};

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const previewQ = useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: () => previewInvitation(token),
    enabled: token.length >= 30,
    retry: false,
  });

  const previewResult = previewQ.data;

  useEffect(() => {
    if (previewResult?.ok === true && previewResult.preview.fullName?.trim()) {
      setFullName(previewResult.preview.fullName.trim());
    }
  }, [previewResult]);

  const roleLabel = useMemo(() => {
    if (previewResult?.ok !== true) return "";
    return rolesRu[previewResult.preview.role] ?? previewResult.preview.role;
  }, [previewResult]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (password.length < 8) {
      setSubmitError("Пароль не короче 8 символов.");
      return;
    }
    if (password !== passwordRepeat) {
      setSubmitError("Пароли не совпадают.");
      return;
    }
    const name = fullName.trim();
    if (!name) {
      setSubmitError("Укажите ФИО.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await acceptInvitation({ token, fullName: name, password });
      if (!r.ok) {
        setSubmitError(r.message);
        return;
      }
      await invalidateAuthUser(queryClient);
      setLocation(defaultHomePathForUserRole(r.user.role));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token || token.length < 30) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10"
        data-testid="page-invite"
      >
        <Card className="w-full max-w-md border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Некорректная ссылка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground" data-testid="text-invite-error">
              Ссылка приглашения повреждена или укорочена.
            </p>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <Link href="/login">Вернуться на /login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (previewQ.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" data-testid="page-invite">
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      </div>
    );
  }

  if (previewQ.isError || !previewResult) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10"
        data-testid="page-invite"
      >
        <Card className="w-full max-w-md border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Ошибка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground" data-testid="text-invite-error">
              Не удалось загрузить данные приглашения.
            </p>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <Link href="/login">Вернуться на /login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (previewResult.ok === false) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10"
        data-testid="page-invite"
      >
        <div className="mb-8">
          <TandoorLogo className="h-12 w-auto max-w-[200px]" />
        </div>
        <Card className="w-full max-w-md border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Приглашение недоступно</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive" data-testid="text-invite-error">
              {previewResult.message}
            </p>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <Link href="/login">Вернуться на /login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { preview } = previewResult;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10"
      data-testid="page-invite"
    >
      <div className="mb-8">
        <TandoorLogo className="h-12 w-auto max-w-[200px]" />
      </div>
      <Card className="w-full max-w-md rounded-2xl border border-border/80 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Приглашение в платформу</CardTitle>
          <p className="text-sm text-muted-foreground">Заполните данные, чтобы активировать учётную запись.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium text-foreground" data-testid="text-invite-email">
                {preview.email}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Роль</span>
              <p className="font-medium text-foreground" data-testid="text-invite-role">
                {roleLabel}
              </p>
            </div>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="invite-fullname">ФИО</Label>
              <Input
                id="invite-fullname"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setSubmitError("");
                }}
                autoComplete="name"
                className="min-h-11"
                data-testid="input-invite-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password">Пароль</Label>
              <PasswordInput
                id="invite-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSubmitError("");
                }}
                className="min-h-11"
                data-testid="input-invite-password"
                toggleTestId="button-toggle-invite-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password-repeat">Повтор пароля</Label>
              <PasswordInput
                id="invite-password-repeat"
                autoComplete="new-password"
                value={passwordRepeat}
                onChange={(e) => {
                  setPasswordRepeat(e.target.value);
                  setSubmitError("");
                }}
                className="min-h-11"
                data-testid="input-invite-password-repeat"
                toggleTestId="button-toggle-invite-password-repeat"
              />
            </div>
            {submitError ? (
              <p className="text-sm text-destructive" data-testid="text-invite-error">
                {submitError}
              </p>
            ) : null}
            <Button type="submit" className="min-h-11 w-full font-semibold" disabled={submitting} data-testid="button-invite-submit">
              {submitting ? "Отправка…" : "Принять приглашение"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
