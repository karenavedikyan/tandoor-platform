/**
 * PILOT ONLY. Страница входа на временной mock-авторизации; не является безопасным механизмом. Подробности и план: `docs/auth-access-foundation.md`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMockAuth } from "@/hooks/use-mock-auth";
import { defaultHomePathForRole } from "@/lib/auth-access";
import { MOCK_AUTH_CREDENTIALS } from "@/lib/mock-auth";
import { getSalesUserById } from "@/lib/sales-control-data";
import { releaseDemoRoleLabel } from "@/lib/release-demo-profile";
import { TandoorLogo } from "@/components/tandoor-logo";

type LoginPickerRow = {
  login: string;
  name: string;
  roleLabel: string;
};

function rowMatchesQuery(row: LoginPickerRow, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const hay = `${row.name} ${row.roleLabel} ${row.login}`.toLowerCase();
  return t.split(/\s+/).filter(Boolean).every((p) => hay.includes(p));
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated, user } = useMockAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loginPickerOpen, setLoginPickerOpen] = useState(false);
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBlurTimer = useCallback(() => {
    if (blurCloseTimerRef.current) {
      clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
  }, []);

  const openLoginPicker = useCallback(() => {
    clearBlurTimer();
    setLoginPickerOpen(true);
  }, [clearBlurTimer]);

  const scheduleCloseLoginPicker = useCallback(() => {
    clearBlurTimer();
    blurCloseTimerRef.current = setTimeout(() => {
      setLoginPickerOpen(false);
      blurCloseTimerRef.current = null;
    }, 180);
  }, [clearBlurTimer]);

  const loginRows = useMemo(
    () =>
      MOCK_AUTH_CREDENTIALS.map((c) => {
        const u = getSalesUserById(c.userId);
        return {
          login: c.username,
          name: u?.name ?? c.userId,
          roleLabel: u?.role ? releaseDemoRoleLabel(u.role) : "—",
        };
      }),
    [],
  );

  const filteredLoginRows = useMemo(
    () => loginRows.filter((row) => rowMatchesQuery(row, username)),
    [loginRows, username],
  );

  useEffect(() => {
    return () => clearBlurTimer();
  }, [clearBlurTimer]);

  useEffect(() => {
    if (!loginPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearBlurTimer();
        setLoginPickerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loginPickerOpen, clearBlurTimer]);

  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation(defaultHomePathForRole(user.role));
    }
  }, [isAuthenticated, user, setLocation]);

  if (isAuthenticated && user) {
    return (
      <div className="flex min-h-screen items-center justify-center" data-testid="page-login">
        <p className="text-sm text-muted-foreground">Перенаправление…</p>
      </div>
    );
  }

  const pickLogin = (loginValue: string) => {
    clearBlurTimer();
    setUsername(loginValue);
    setPassword("");
    setError("");
    setLoginPickerOpen(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const r = login(username, password);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setLocation(defaultHomePathForRole(r.user.role));
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
          <p className="text-sm text-muted-foreground">Вход по учётной записи и роли в команде продаж.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-username">Логин</Label>
              <p className="text-xs text-muted-foreground">Начните вводить ФИО или логин</p>
              <div className="relative">
                <Input
                  id="login-username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  onFocus={openLoginPicker}
                  onBlur={scheduleCloseLoginPicker}
                  className="min-h-11"
                  data-testid="input-login-username"
                  aria-autocomplete="list"
                  aria-expanded={loginPickerOpen}
                  aria-controls="dropdown-login-users"
                />
                {loginPickerOpen ? (
                  <div
                    id="dropdown-login-users"
                    data-testid="dropdown-login-users"
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div className="border-b border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                      Выберите пользователя
                    </div>
                    {filteredLoginRows.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-muted-foreground">Нет совпадений</div>
                    ) : (
                      <ul className="py-1">
                        {filteredLoginRows.map((row) => (
                          <li key={row.login}>
                            <button
                              type="button"
                              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/80"
                              data-testid={`option-login-user-${row.login}`}
                              onClick={() => pickLogin(row.login)}
                            >
                              <span className="font-medium text-foreground">{row.name}</span>
                              <span className="text-xs text-muted-foreground">{row.roleLabel}</span>
                              <span className="font-mono text-xs text-foreground">{row.login}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Пароль</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11"
                data-testid="input-login-password"
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
