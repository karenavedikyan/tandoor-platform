import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthScreenBranding } from "@/components/auth-screen-branding";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createResetRequest, fetchResetRequestApprovers, type ResetApproverOption } from "@/lib/forgot-password-api";
import type { UserRole } from "@shared/auth";
import { AUTH_FIELD_CLASS, AUTH_LABEL_CLASS } from "@/lib/auth-form-classes";
import { cn } from "@/lib/utils";

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
  const [successApprover, setSuccessApprover] = useState<ResetApproverOption | null>(null);

  const emailErrId = "forgot-email-error";

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
      setSelectedId(null);
      setSuccessApprover(null);
      setStep(2);
    } finally {
      setBusy(false);
    }
  }, [email]);

  const onStep2 = useCallback(async () => {
    setError("");
    if (approvers.length === 0) {
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
      const pick = approvers.find((a) => a.id === selectedId) ?? null;
      setSuccessApprover(pick);
      setStep(3);
    } finally {
      setBusy(false);
    }
  }, [approvers, email, selectedId]);

  return (
    <div
      className="motion-reduce:transition-none flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10"
      data-testid="page-forgot-password"
    >
      <AuthScreenBranding showSlogan={false} />
      <div className="w-full max-w-md rounded-lg border border-card-border bg-card p-6 shadow-sm motion-reduce:transition-none sm:p-8">
        {step === 1 ? (
          <>
            <h1 className="text-xl font-semibold text-card-foreground">Восстановление доступа</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Введите ваш email — мы покажем, кому можно отправить запрос на сброс.
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void onStep1();
              }}
              noValidate
            >
              <div>
                <Label htmlFor="forgot-email" className={AUTH_LABEL_CLASS}>
                  Email
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  disabled={busy}
                  className={AUTH_FIELD_CLASS}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? emailErrId : undefined}
                />
                {error ? (
                  <p id={emailErrId} className="mt-2 flex items-start gap-2 text-sm text-destructive" role="alert">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </p>
                ) : null}
              </div>
              <Button
                type="submit"
                className="h-11 min-h-11 w-full rounded-md bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                disabled={!canSubmitEmail || busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 motion-reduce:animate-none animate-spin" aria-hidden />
                    Загрузка…
                  </>
                ) : (
                  "Далее"
                )}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-0.5"
              >
                ← Назад ко входу
              </Link>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-xl font-semibold text-card-foreground">Кому отправить запрос?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Запрос придёт выбранному руководителю. После одобрения он передаст вам ссылку для смены пароля.
            </p>
            <div className="mt-6 space-y-4">
              {approvers.length === 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Для вашей учётной записи восстановление возможно только через администратора или Telegram-бот
                    @Tandoor_ibot.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-h-11 w-full rounded-md"
                    disabled={busy}
                    onClick={() => {
                      setStep(1);
                      setError("");
                    }}
                  >
                    Назад
                  </Button>
                </>
              ) : (
                <>
                  <RadioGroup value={selectedId ?? ""} onValueChange={(v) => setSelectedId(v || null)} className="grid gap-2">
                    {approvers.map((a) => {
                      const selected = selectedId === a.id;
                      return (
                        <label
                          key={a.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-md border p-3 motion-reduce:transition-none",
                            "hover:border-primary focus-within:ring-2 focus-within:ring-primary",
                            selected ? "border-primary bg-primary/5" : "border-border",
                          )}
                        >
                          <RadioGroupItem value={a.id} id={`approver-${a.id}`} className="mt-1 focus-visible:ring-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-foreground">{a.fullName}</span>
                            <span
                              className={cn(
                                "mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-medium",
                                a.role === "director" && "border-primary/30 bg-primary/10 text-primary",
                                a.role === "rop" && "border-blue-300 bg-blue-100 text-blue-700",
                                a.role !== "director" && a.role !== "rop" && "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {rolesRu[a.role] ?? a.role}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                  {error ? (
                    <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>{error}</span>
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    className="h-11 min-h-11 w-full rounded-md bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                    disabled={!selectedId || busy}
                    onClick={() => void onStep2()}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 motion-reduce:animate-none animate-spin" aria-hidden />
                        Отправка…
                      </>
                    ) : (
                      "Отправить запрос"
                    )}
                  </Button>
                </>
              )}
            </div>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-0.5"
              >
                ← Назад ко входу
              </Link>
            </div>
          </>
        ) : null}

        {step === 3 && successApprover ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary motion-reduce:transition-none" aria-hidden />
            <h1 className="mt-4 text-xl font-semibold text-card-foreground">Запрос отправлен</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Свяжитесь с {successApprover.fullName} ({rolesRu[successApprover.role] ?? successApprover.role}) для
              получения ссылки на смену пароля. Срок действия запроса — 30 минут.
            </p>
            <Button
              type="button"
              className="mt-6 h-11 min-h-11 w-full rounded-md bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => setLocation("/login")}
            >
              Вернуться ко входу
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
