/**
 * Смена пароля текущего пользователя.
 */

import { useState } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { changePasswordSelf } from "@/lib/profile-api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { invalidateAuthUser } from "@/hooks/use-auth-user";
import { toast } from "@/hooks/use-toast";

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


  return (
    <div className="mx-auto max-w-md space-y-6 p-6" data-testid="page-change-password">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-[#222631]">Смена пароля</h1>
        <p className="text-sm text-[#8F96B0]">Введите текущий пароль и новый пароль.</p>
      </div>

      {user.mustChangePassword ? (
        <Alert>
          <AlertTitle>Требуется смена пароля</AlertTitle>
          <AlertDescription>Для продолжения работы смените временный пароль.</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-[#E3E6F3]">
        <form onSubmit={(e) => void submit(e)}>
          <CardHeader>
            <CardTitle className="text-base">Новый пароль</CardTitle>
            <CardDescription>Минимум 8 символов, не совпадает с email и текущим паролем.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="current-pw">Текущий пароль</Label>
              <Input
                id="current-pw"
                data-testid="input-current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">Новый пароль</Label>
              <Input
                id="new-pw"
                data-testid="input-new-password"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="min-h-11"
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw2">Повторите новый пароль</Label>
              <Input
                id="new-pw2"
                data-testid="input-new-password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="min-h-11"
              />
            </div>
            {localErr ? <p className="text-sm text-destructive">{localErr}</p> : null}
            {serverErr ? <p className="text-sm text-destructive">{serverErr}</p> : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full font-semibold" disabled={busy} data-testid="button-change-password">
              {busy ? "Сохранение…" : "Сменить пароль"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
