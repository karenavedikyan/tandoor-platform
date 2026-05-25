/**
 * Публичная страница смены пароля по одноразовой ссылке `/#/reset?token=...` или `/?token=...#/reset`.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useRouteSearchParams } from "@/lib/hash-route-utils";
import { redeemPasswordResetLink } from "@/lib/password-reset-api";
import { toast } from "@/hooks/use-toast";
import { TandoorLogo } from "@/components/tandoor-logo";

function readTokenFromLocation(loc: string, qs: URLSearchParams): string {
  const i = loc.indexOf("?");
  if (i >= 0) {
    const q = new URLSearchParams(loc.slice(i + 1));
    const t = q.get("token");
    if (t?.trim()) return t.trim();
  }
  const t2 = qs.get("token");
  return t2?.trim() ?? "";
}

function validateLocal(pw: string): string | null {
  const t = pw.trim();
  if (t.length < 12 || t.length > 200) return "Пароль должен быть не короче 12 символов и содержать букву и цифру.";
  if (!/\d/.test(t)) return "Пароль должен быть не короче 12 символов и содержать букву и цифру.";
  if (!/[a-zA-Z\u0400-\u04FF]/.test(t)) return "Пароль должен быть не короче 12 символов и содержать букву и цифру.";
  return null;
}

export default function ResetPasswordPage() {
  const [loc, setLocation] = useLocation();
  const qs = useRouteSearchParams();
  const token = useMemo(() => readTokenFromLocation(loc, qs), [loc, qs]);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [fieldErr, setFieldErr] = useState("");
  const [matchErr, setMatchErr] = useState("");
  const [serverErr, setServerErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token || token.length < 30) {
      setLocation("/login");
    }
  }, [token, setLocation]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErr("");
    setMatchErr("");
    setServerErr("");
    const fe = validateLocal(password);
    if (fe) {
      setFieldErr(fe);
      return;
    }
    if (password !== password2) {
      setMatchErr("Пароли не совпадают.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await redeemPasswordResetLink(token, password);
      if (!r.ok) {
        setServerErr(r.message);
        return;
      }
      toast({ title: "Пароль обновлён" });
      window.setTimeout(() => setLocation("/login"), 2000);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token || token.length < 30) {
    return null;
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10"
      data-testid="page-reset-password"
    >
      <div className="mb-8">
        <TandoorLogo className="h-10 w-auto" />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Новый пароль</CardTitle>
          <CardDescription>Задайте пароль для входа в систему.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password-new">Новый пароль</Label>
              <PasswordInput
                id="reset-password-new"
                autoComplete="new-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                disabled={submitting}
              />
              {fieldErr ? (
                <p className="text-sm text-destructive" data-testid="error-reset-password-strength">
                  {fieldErr}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-password-repeat">Подтверждение</Label>
              <PasswordInput
                id="reset-password-repeat"
                autoComplete="new-password"
                value={password2}
                onChange={(ev) => setPassword2(ev.target.value)}
                disabled={submitting}
              />
              {matchErr ? (
                <p className="text-sm text-destructive" data-testid="error-reset-password-match">
                  {matchErr}
                </p>
              ) : null}
            </div>
            {serverErr ? (
              <p className="text-sm text-destructive" data-testid="error-reset-password-server">
                {serverErr}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={submitting}>
              Сохранить пароль
            </Button>
            <Button type="button" variant="ghost" className="w-full" asChild>
              <Link href="/login">На страницу входа</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
