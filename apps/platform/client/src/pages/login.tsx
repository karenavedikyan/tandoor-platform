/**
 * Клиентская страница входа на реальный `POST /api/auth/login` (PR 04, удаление mock-auth).
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/auth-api";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
import { TandoorLogo } from "@/components/tandoor-logo";
import { invalidateAuthUser, useAuthUser } from "@/hooks/use-auth-user";
import { queryClient } from "@/lib/queryClient";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuthUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading) return;
    if (user?.status === "active") {
      setLocation(defaultHomePathForUserRole(user.role));
    }
  }, [isLoading, user, setLocation]);

  if (isLoading || (user?.status === "active")) {
    return (
      <div className="flex min-h-screen items-center justify-center" data-testid="page-login">
        <p className="text-sm text-muted-foreground">{isLoading ? "Загрузка…" : "Перенаправление…"}</p>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const r = await login(email, password);
    if (r.ok) {
      await invalidateAuthUser(queryClient);
      setLocation(defaultHomePathForUserRole(r.user.role));
      return;
    }
    if (r.code === "VALIDATION_ERROR" || r.code === "INTERNAL_ERROR" || r.code === "NETWORK_ERROR") {
      setError(r.message);
      return;
    }
    if (r.code === "INVALID_CREDENTIALS") {
      setError("Неверный email или пароль.");
      return;
    }
    if (r.code === "RATE_LIMITED") {
      const extra =
        r.retryAfterSec != null && Number.isFinite(r.retryAfterSec)
          ? ` Повторите через ${r.retryAfterSec} с.`
          : "";
      setError(`${r.message}${extra}`);
      return;
    }
    setError(r.message);
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10"
      data-testid="page-login"
    >
      <div className="mb-8">
        <TandoorLogo className="h-12 w-auto max-w-[200px]" data-testid="brand-logo-tandoor-login" />
      </div>
      <Card className="w-full max-w-md rounded-2xl border border-border/80 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Вход в платформу</CardTitle>
          <p className="text-sm text-muted-foreground">Введите email и пароль учётной записи.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="min-h-11"
                data-testid="input-login-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Пароль</Label>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11"
                data-testid="input-login-password"
                toggleTestId="button-toggle-login-password"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" data-testid="text-login-error">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="min-h-11 w-full font-semibold" data-testid="button-login-submit">
              Войти
            </Button>
            <div className="text-center">
              <Link
                href="/forgot"
                className="text-sm text-primary underline-offset-4 hover:underline"
                data-testid="link-forgot-password"
              >
                Забыли пароль?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
