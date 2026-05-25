/**
 * Публичная страница смены пароля по одноразовой ссылке `/#/reset?token=...` или `/?token=...#/reset`.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useRouteSearchParams } from "@/lib/hash-route-utils";
import { redeemPasswordResetLink } from "@/lib/password-reset-api";
import { toast } from "@/hooks/use-toast";
import { AuthScreenBranding } from "@/components/auth-screen-branding";
import { AUTH_FIELD_CLASS, AUTH_LABEL_CLASS } from "@/lib/auth-form-classes";

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

  const strengthId = "reset-password-strength-hint";
  const fieldErrId = "reset-pw-field-err";
  const matchErrId = "reset-pw-match-err";

  return (
    <div
      className="motion-reduce:transition-none flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10"
      data-testid="page-reset-password"
    >
      <AuthScreenBranding showSlogan={false} />
      <div className="w-full max-w-md rounded-lg border border-card-border bg-card p-6 shadow-sm motion-reduce:transition-none sm:p-8">
        <h1 className="text-xl font-semibold text-card-foreground">Новый пароль</h1>
        <p id={strengthId} className="mt-1 text-sm text-muted-foreground">
          Минимум 12 символов, нужны буква и цифра. Рекомендуем также спецсимволы.
        </p>
        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <Label htmlFor="reset-password-new" className={AUTH_LABEL_CLASS}>
              Пароль
            </Label>
            <PasswordInput
              id="reset-password-new"
              autoComplete="new-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              disabled={submitting}
              className={AUTH_FIELD_CLASS}
              aria-invalid={Boolean(fieldErr)}
              aria-describedby={fieldErr ? fieldErrId : strengthId}
              toggleTestId="button-toggle-reset-password-new"
            />
            {fieldErr ? (
              <p id={fieldErrId} className="mt-2 flex items-start gap-2 text-sm text-destructive" data-testid="error-reset-password-strength" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{fieldErr}</span>
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="reset-password-repeat" className={AUTH_LABEL_CLASS}>
              Повторите пароль
            </Label>
            <PasswordInput
              id="reset-password-repeat"
              autoComplete="new-password"
              value={password2}
              onChange={(ev) => setPassword2(ev.target.value)}
              disabled={submitting}
              className={AUTH_FIELD_CLASS}
              aria-invalid={Boolean(matchErr)}
              aria-describedby={matchErr ? matchErrId : undefined}
              toggleTestId="button-toggle-reset-password-repeat"
            />
            {matchErr ? (
              <p id={matchErrId} className="mt-2 flex items-start gap-2 text-sm text-destructive" data-testid="error-reset-password-match" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{matchErr}</span>
              </p>
            ) : null}
          </div>
          {serverErr ? (
            <p className="flex items-start gap-2 text-sm text-destructive" data-testid="error-reset-password-server" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{serverErr}</span>
            </p>
          ) : null}
          <Button
            type="submit"
            className="h-11 min-h-11 w-full rounded-md bg-primary font-medium text-primary-foreground hover:bg-primary/90"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 motion-reduce:animate-none animate-spin" aria-hidden />
                Сохранение…
              </>
            ) : (
              "Сохранить пароль"
            )}
          </Button>
          <Button type="button" variant="ghost" className="h-11 min-h-11 w-full rounded-md" asChild>
            <Link href="/login">На страницу входа</Link>
          </Button>
        </form>
      </div>
    </div>
  );
}
