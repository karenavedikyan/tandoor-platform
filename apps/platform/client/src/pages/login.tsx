import { useEffect, useMemo, useState } from "react";
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

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated, user } = useMockAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const pilotRows = useMemo(
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
    setUsername(loginValue);
    setPassword("");
    setError("");
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
      <Card className="w-full max-w-3xl rounded-2xl border border-border/80 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Вход в платформу</CardTitle>
          <p className="text-sm text-muted-foreground">Пилотная авторизация по роли (mock, без 1С).</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Пилотные пользователи
            </p>
            <ul className="space-y-2 text-sm" data-testid="list-login-pilot-users">
              {pilotRows.map((row) => (
                <li
                  key={row.login}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.roleLabel} · логин: <span className="font-mono text-foreground">{row.login}</span>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    data-testid={`button-login-pick-${row.login}`}
                    onClick={() => pickLogin(row.login)}
                  >
                    Выбрать
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-username">Логин</Label>
              <Input
                id="login-username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="min-h-11"
                data-testid="input-login-username"
              />
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
