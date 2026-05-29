/**
 * Клиентская страница входа на реальный `POST /api/auth/login` (PR 04, удаление mock-auth).
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth-api";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
import { buildHashPath, useRouteSearchParams } from "@/lib/hash-route-utils";
import { AuthScreenBranding } from "@/components/auth-screen-branding";
import { invalidateAuthUser, useAuthUser } from "@/hooks/use-auth-user";
import { queryClient } from "@/lib/queryClient";
import { AUTH_FIELD_CLASS, AUTH_LABEL_CLASS } from "@/lib/auth-form-classes";

function safeReturnPath(raw: string | null): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const routeSearch = useRouteSearchParams();
  const nextReturn = safeReturnPath(routeSearch.get("next"));
  const printAfterLogin = routeSearch.get("print") === "1";

  function postLoginPath(role: Parameters<typeof defaultHomePathForUserRole>[0]): string {
    if (!nextReturn) return defaultHomePathForUserRole(role);
    if (printAfterLogin) return buildHashPath(nextReturn, { print: "1" });
    return nextReturn;
  }

  const { user, isLoading } = useAuthUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (user?.status === "active") {
      setLocation(postLoginPath(user.role));
    }
  }, [isLoading, user, setLocation, nextReturn, printAfterLogin]);

  if (isLoading || user?.status === "active") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" data-testid="page-login">
        <p className="text-sm text-muted-foreground">{isLoading ? "Загрузка…" : "Перенаправление…"}</p>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const r = await login(email, password);
      if (r.ok) {
        await invalidateAuthUser(queryClient);
        setLocation(postLoginPath(r.user.role));
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
          r.retryAfterSec != null && Number.isFinite(r.retryAfterSec) ? ` Повторите через ${r.retryAfterSec} с.` : "";
        setError(`${r.message}${extra}`);
        return;
      }
      setError(r.message);
    } finally {
      setSubmitting(false);
    }
  };

  const emailErrorId = "login-email-error";
  const showCredError = Boolean(error);

  return (
    <div
      className="motion-reduce:transition-none flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10"
      data-testid="page-login"
    >
      <AuthScreenBranding />
      <div className="w-full max-w-md rounded-lg border border-card-border bg-card p-6 shadow-sm motion-reduce:transition-none sm:p-8">
        <h1 className="text-xl font-semibold text-card-foreground">Вход в платформу</h1>
        <p className="mt-1 text-sm text-muted-foreground">Введите email и пароль учётной записи.</p>

        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
          <div>
            <Label htmlFor="login-email" className={AUTH_LABEL_CLASS}>
              Email
            </Label>
            <Input
              id="login-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="name@company.ru"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className={AUTH_FIELD_CLASS}
              aria-invalid={showCredError}
              aria-describedby={showCredError ? emailErrorId : undefined}
              data-testid="input-login-email"
            />
          </div>
          <div>
            <Label htmlFor="login-password" className={AUTH_LABEL_CLASS}>
              Пароль
            </Label>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={AUTH_FIELD_CLASS}
              data-testid="input-login-password"
              toggleTestId="button-toggle-login-password"
            />
          </div>
          {error ? (
            <div
              id={emailErrorId}
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
              data-testid="text-login-error"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}
          <Button
            type="submit"
            disabled={submitting}
            className="h-11 min-h-11 w-full rounded-md bg-primary font-medium text-primary-foreground hover:bg-primary/90 motion-reduce:transition-none"
            data-testid="button-login-submit"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 motion-reduce:animate-none animate-spin" aria-hidden />
                Вход…
              </>
            ) : (
              "Войти"
            )}
          </Button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Link
            href="/forgot"
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-0.5"
            data-testid="link-forgot-password"
          >
            Забыли пароль?
          </Link>
          <span aria-hidden className="select-none">
            ·
          </span>
          <Link
            href="/profile?tab=telegram"
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-0.5"
          >
            Активировать Telegram
          </Link>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">Не помните логин? Обратитесь к РОПу или директору.</p>
      </div>
    </div>
  );
}
