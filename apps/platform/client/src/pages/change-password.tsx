/**
 * Смена пароля текущего пользователя.
 */

import { useState } from "react";
import { useHashLocation } from "@/lib/hash-location-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { changePasswordSelf } from "@/lib/profile-api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { invalidateAuthUser } from "@/hooks/use-auth-user";
import { toast } from "@/hooks/use-toast";
import { AuthScreenBranding } from "@/components/auth-screen-branding";
import { AUTH_FIELD_CLASS, AUTH_LABEL_CLASS } from "@/lib/auth-form-classes";

export default function ChangePasswordPage() {
  const { user } = useCurrentUser();
  const [, setLoc] = useHashLocation();
  const qc = useQueryClient();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localErr, setLocalErr] = useState("");
  const [serverErr, setServerErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    return null;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr("");
    setServerErr("");
    if (!current.trim()) {
      setLocalErr("Укажите текущий пароль.");
      return;
    }
    if (next.length < 8) {
      setLocalErr("Пароль должен быть не короче 8 символов и отличаться от email и текущего пароля.");
      return;
    }
    if (next !== confirm) {
      setLocalErr("Новый пароль и подтверждение должны совпадать.");
      return;
    }
    setBusy(true);
    try {
      const r = await changePasswordSelf({ currentPassword: current, newPassword: next });
      if (!r.ok) {
        if (r.code === "INVALID_PASSWORD") setServerErr("Текущий пароль неверен.");
        else if (r.code === "WEAK_PASSWORD")
          setServerErr("Пароль должен быть не короче 8 символов и отличаться от email и текущего пароля.");
        else if (r.code === "NETWORK_ERROR") setServerErr("Сеть недоступна. Повторите попытку.");
        else setServerErr(r.message);
        return;
      }
      toast({
        title: "Пароль изменён",
        description: `Остальные сессии завершены (${r.otherSessionsRevoked}).`,
      });
      await invalidateAuthUser(qc);
      setCurrent("");
      setNext("");
      setConfirm("");
      setLoc("/profile");
    } finally {
      setBusy(false);
    }
  };

  const hintId = "change-password-hint";

  return (
    <div
      className="motion-reduce:transition-none mx-auto flex min-h-[60vh] w-full max-w-md flex-col px-4 py-8 sm:px-6"
      data-testid="page-change-password"
    >
      <AuthScreenBranding />
      <div className="rounded-lg border border-card-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold text-card-foreground">Смена пароля</h1>
        <p className="mt-1 text-sm text-muted-foreground">Введите текущий пароль и новый пароль.</p>

        {user.mustChangePassword ? (
          <Alert className="mt-4">
            <AlertTitle>Требуется смена пароля</AlertTitle>
            <AlertDescription>Для продолжения работы смените временный пароль.</AlertDescription>
          </Alert>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={(e) => void submit(e)}>
          <p id={hintId} className="text-sm text-muted-foreground">
            Минимум 8 символов, рекомендуем буквы, цифры и спецсимвол.
          </p>
          <div>
            <Label htmlFor="current-pw" className={AUTH_LABEL_CLASS}>
              Текущий пароль
            </Label>
            <PasswordInput
              id="current-pw"
              data-testid="input-current-password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={AUTH_FIELD_CLASS}
              toggleTestId="button-toggle-current-password"
            />
          </div>
          <div>
            <Label htmlFor="new-pw" className={AUTH_LABEL_CLASS}>
              Новый пароль
            </Label>
            <PasswordInput
              id="new-pw"
              data-testid="input-new-password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={AUTH_FIELD_CLASS}
              minLength={8}
              aria-describedby={hintId}
              toggleTestId="button-toggle-new-password"
            />
          </div>
          <div>
            <Label htmlFor="new-pw2" className={AUTH_LABEL_CLASS}>
              Повторите пароль
            </Label>
            <PasswordInput
              id="new-pw2"
              data-testid="input-new-password-confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={AUTH_FIELD_CLASS}
              toggleTestId="button-toggle-new-password-confirm"
            />
          </div>
          {localErr ? (
            <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{localErr}</span>
            </p>
          ) : null}
          {serverErr ? (
            <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{serverErr}</span>
            </p>
          ) : null}
          <Button
            type="submit"
            className="h-11 min-h-11 w-full rounded-md bg-primary font-medium text-primary-foreground hover:bg-primary/90"
            disabled={busy}
            data-testid="button-change-password"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 motion-reduce:animate-none animate-spin" aria-hidden />
                Сохранение…
              </>
            ) : (
              "Сменить пароль"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
