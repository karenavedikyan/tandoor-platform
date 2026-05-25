import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TandoorLogo } from "@/components/tandoor-logo";
import { createResetRequest, fetchResetRequestApprovers, type ResetApproverOption } from "@/lib/forgot-password-api";
import type { UserRole } from "@shared/auth";

const rolesRu: Record<UserRole, string> = {
  director: "Директор",
  rop: "РОП",
  regional_manager: "Региональный менеджер",
  manager: "Менеджер",
  marketer: "Маркетолог",
  analyst: "Аналитик",
  admin: "Администратор",
};

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [approvers, setApprovers] = useState<ResetApproverOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");

  const canSubmitEmail = useMemo(() => email.trim().length > 3 && email.includes("@"), [email]);

  const onStep1 = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const r = await fetchResetRequestApprovers(email);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setApprovers(r.approvers);
      setStep(2);
      setSelectedId(null);
    } finally {
      setBusy(false);
    }
  }, [email]);

  const onStep2 = useCallback(async () => {
    setError("");
    if (approvers.length === 0) {
      setSelectedLabel("");
      setStep(3);
      return;
    }
    if (!selectedId) {
      setError("Выберите одобряющего.");
      return;
    }
    setBusy(true);
    try {
      const r = await createResetRequest(email, selectedId);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      const pick = approvers.find((a) => a.id === selectedId);
      const roleLabel = pick ? rolesRu[pick.role] ?? pick.role : "";
      setSelectedLabel(pick ? `${pick.fullName}, ${roleLabel}` : "");
      setStep(3);
    } finally {
      setBusy(false);
    }
  }, [approvers, email, selectedId]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10"
      data-testid="page-forgot-password"
    >
      <div className="mb-8">
        <TandoorLogo className="h-12 w-auto max-w-[200px]" />
      </div>
      <Card className="w-full max-w-md rounded-2xl border border-border/80 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Забыли пароль?</CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === 1
              ? "Укажите email учётной записи."
              : step === 2
                ? "Выберите сотрудника, который сможет подтвердить сброс."
                : "Запрос отправлен."}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  className="min-h-11"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex flex-col gap-2">
                <Button type="button" className="min-h-11 w-full" disabled={!canSubmitEmail || busy} onClick={() => void onStep1()}>
                  Продолжить
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setLocation("/login")}>
                  Назад ко входу
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              {approvers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Если для вашей учётной записи доступен сброс через коллег, вы получите дальнейшие инструкции. Нажмите
                  «Продолжить».
                </p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                  {approvers.map((a) => {
                    const active = selectedId === a.id;
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          className={`flex w-full flex-col items-start rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                            active ? "border-primary bg-muted" : "border-transparent hover:bg-muted/60"
                          }`}
                          onClick={() => {
                            setSelectedId(a.id);
                            setError("");
                          }}
                        >
                          <span className="font-medium">{a.fullName}</span>
                          <span className="text-xs text-muted-foreground">{rolesRu[a.role] ?? a.role}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex flex-col gap-2">
                {approvers.length > 0 ? (
                  <Button type="button" className="min-h-11 w-full" disabled={busy} onClick={() => void onStep2()}>
                    Отправить запрос
                  </Button>
                ) : (
                  <Button type="button" className="min-h-11 w-full" disabled={busy} onClick={() => void onStep2()}>
                    Продолжить
                  </Button>
                )}
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)} disabled={busy}>
                  Назад
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Запрос отправлен. Свяжитесь с <span className="font-medium text-foreground">{selectedLabel || "выбранным сотрудником"}</span>{" "}
                для получения ссылки. Срок действия запроса — 30 минут.
              </p>
              <Button type="button" className="w-full" variant="secondary" onClick={() => setLocation("/login")}>
                Ко входу
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/login" className="underline underline-offset-2">
          Вход в платформу
        </Link>
      </p>
    </div>
  );
}
