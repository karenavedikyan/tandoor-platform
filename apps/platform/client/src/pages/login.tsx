import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMockAuth } from "@/hooks/use-mock-auth";
import { defaultHomePathForRole } from "@/lib/auth-access";
import { TandoorLogo } from "@/components/tandoor-logo";

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
          <p className="text-sm text-muted-foreground">Пилотная авторизация по роли (mock, без 1С).</p>
        </CardHeader>
        <CardContent>
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
