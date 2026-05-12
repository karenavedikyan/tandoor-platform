import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMockAuth } from "@/hooks/use-mock-auth";
import { defaultHomePathForRole } from "@/lib/auth-access";
import { TandoorLogo } from "@/components/tandoor-logo";
import { getSalesLoginCredentials, type SalesCredentialEntry } from "@/lib/mock-auth";
import { releaseDemoRoleLabel } from "@/lib/release-demo-profile";
import type { SalesRole } from "@/lib/sales-control-data";

const ROLE_GROUP_ORDER: SalesRole[] = ["sales_director", "team_lead", "sales_manager"];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated, user } = useMockAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation(defaultHomePathForRole(user.role));
    }
  }, [isAuthenticated, user, setLocation]);

  const grouped = useMemo(() => {
    const all = getSalesLoginCredentials();
    const byRole = new Map<SalesRole, SalesCredentialEntry[]>();
    for (const entry of all) {
      const list = byRole.get(entry.user.role) ?? [];
      list.push(entry);
      byRole.set(entry.user.role, list);
    }
    return ROLE_GROUP_ORDER
      .map((role) => ({ role, entries: byRole.get(role) ?? [] }))
      .filter((g) => g.entries.length > 0);
  }, []);

  if (isAuthenticated && user) {
    return (
      <div className="flex min-h-screen items-center justify-center" data-testid="page-login">
        <p className="text-sm text-muted-foreground">Перенаправление…</p>
      </div>
    );
  }

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

  const quickFill = (entry: SalesCredentialEntry) => {
    setUsername(entry.username);
    setPassword(entry.password);
    setError("");
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
        <CardContent>
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
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
              <p className="text-[11px] text-muted-foreground">
                Пароли: РОП продаж — <code>1</code>, тимлид/РОП команды — <code>22</code>, менеджер — <code>333</code>.
              </p>
            </form>
            <section
              className="rounded-xl border border-border/80 bg-muted/30 p-4"
              data-testid="section-login-credentials"
              aria-label="Пилотные учётки"
            >
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">Учётки для пилота</h2>
                <span className="text-[11px] text-muted-foreground">Нажмите на строку, чтобы подставить</span>
              </div>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {grouped.map((group) => (
                  <div key={group.role} data-testid={`login-group-${group.role}`}>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {releaseDemoRoleLabel(group.role)} · пароль <code>{group.entries[0].password}</code>
                    </div>
                    <ul className="space-y-1">
                      {group.entries.map((entry) => (
                        <li key={entry.userId}>
                          <button
                            type="button"
                            onClick={() => quickFill(entry)}
                            className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent bg-background px-3 py-2 text-left text-xs hover:border-border hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                            data-testid={`button-login-quickfill-${entry.username}`}
                          >
                            <span className="min-w-0 flex-1 truncate font-medium">{entry.user.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              <span data-testid={`text-login-username-${entry.username}`}>{entry.username}</span>
                              <span className="mx-1 opacity-60">/</span>
                              <span data-testid={`text-login-password-${entry.username}`}>{entry.password}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
