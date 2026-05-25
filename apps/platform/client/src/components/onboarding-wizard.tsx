"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Progress } from "@/components/ui/progress";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "@/hooks/use-toast";
import { invalidateAuthUser } from "@/hooks/use-auth-user";
import { fetchOnboardingStatus, postOnboardingComplete, postTelegramLinkToken } from "@/lib/onboarding-api";
import { changePasswordSelf, getSelf, updateSelf } from "@/lib/profile-api";
import { isValidRussianPhone, normalizeToCanonical } from "@/lib/phone-format";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 1 | 2 | 3 | 4;

export function OnboardingWizard({ reopenTick }: { reopenTick: number }) {
  const { user, isAuthenticated, isLoading: authLoading } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [tgHint, setTgHint] = useState("");
  const reopenHandled = useRef(0);

  const statusQ = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: fetchOnboardingStatus,
    enabled: !!user && isAuthenticated,
  });

  const profileQ = useQuery({
    queryKey: ["profile-self"],
    queryFn: getSelf,
    enabled: open && !!user,
  });

  const needsAutoModal = useMemo(() => {
    const st = statusQ.data;
    if (!st) return false;
    return (
      st.completedAt == null &&
      (st.mustChangePassword || st.profileNeedsUpdate || !st.telegramLinked)
    );
  }, [statusQ.data]);

  useEffect(() => {
    if (authLoading || !user || !statusQ.data) return;
    if (reopenTick > reopenHandled.current) {
      reopenHandled.current = reopenTick;
      setOpen(true);
      return;
    }
    if (needsAutoModal) setOpen(true);
  }, [authLoading, user, statusQ.data, needsAutoModal, reopenTick]);

  const prevOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      prevOpen.current = false;
      return;
    }
    if (!statusQ.data) return;
    if (!prevOpen.current) {
      setStep(statusQ.data.mustChangePassword ? 1 : 2);
      setTgHint("");
      prevOpen.current = true;
    }
  }, [open, statusQ.data]);

  const progressValue = step >= 4 ? 100 : Math.round((step / 3) * 100);

  const closeAndReset = () => {
    setOpen(false);
    setTgHint("");
  };

  const [pwCur, setPwCur] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profBusy, setProfBusy] = useState(false);

  useEffect(() => {
    const d = profileQ.data;
    if (!d || !open) return;
    setFullName(d.fullName?.trim() ?? "");
    setEmail(d.email?.trim() ?? "");
    const phRaw = d.phone?.trim() ?? "";
    if (phRaw) {
      const c = normalizeToCanonical(phRaw);
      setPhone(isValidRussianPhone(c) ? c : phRaw);
    } else {
      setPhone("");
    }
  }, [profileQ.data, open]);


  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwCur.trim()) {
      toast({ variant: "destructive", title: "Укажите текущий пароль." });
      return;
    }
    if (pw1.length < 8) {
      toast({
        variant: "destructive",
        title: "Пароль должен быть не короче 8 символов и отличаться от email и текущего пароля.",
      });
      return;
    }
    if (pw1 !== pw2) {
      toast({ variant: "destructive", title: "Новый пароль и подтверждение должны совпадать." });
      return;
    }
    setPwBusy(true);
    try {
      const r = await changePasswordSelf({ currentPassword: pwCur, newPassword: pw1 });
      if (!r.ok) {
        toast({ variant: "destructive", title: r.message });
        return;
      }
      await invalidateAuthUser(qc);
      await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
      await statusQ.refetch();
      setPwCur("");
      setPw1("");
      setPw2("");
      setStep(2);
    } finally {
      setPwBusy(false);
    }
  };

  const saveProfile = async () => {
    const fn = fullName.trim();
    if (fn.length < 2 || fn.length > 200) {
      toast({ variant: "destructive", title: "Укажите ФИО (от 2 до 200 символов)." });
      return;
    }
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) {
      toast({ variant: "destructive", title: "Укажите корректный email." });
      return;
    }
    if (phone !== "" && !isValidRussianPhone(phone)) {
      toast({ variant: "destructive", title: "Введите 10 цифр номера после +7." });
      return;
    }
    setProfBusy(true);
    try {
      await updateSelf({
        fullName: fn,
        email: em,
        phone: phone === "" ? null : phone,
      });
      await qc.invalidateQueries({ queryKey: ["profile-self"] });
      await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
      await statusQ.refetch();
      setStep(3);
    } catch (err) {
      const m = err instanceof Error ? err.message : "Не удалось сохранить профиль.";
      toast({ variant: "destructive", title: m });
    } finally {
      setProfBusy(false);
    }
  };

  const openBot = async () => {
    setTgHint("");
    try {
      const { botUrl } = await postTelegramLinkToken();
      window.open(botUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Не удалось получить ссылку.";
      toast({ variant: "destructive", title: m });
    }
  };

  const checkTelegram = async () => {
    setTgHint("");
    try {
      await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
      const st = await fetchOnboardingStatus();
      if (st.telegramLinked) {
        setStep(4);
      } else {
        setTgHint("Пока не вижу привязки. Нажми /start в боте.");
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "Не удалось проверить статус.";
      toast({ variant: "destructive", title: m });
    }
  };

  const finish = async () => {
    try {
      await postOnboardingComplete();
      await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
      closeAndReset();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Не удалось завершить.";
      toast({ variant: "destructive", title: m });
    }
  };

  if (!user || !isAuthenticated) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          "max-h-[min(90vh,40rem)] w-[calc(100%-1rem)] max-w-lg overflow-y-auto motion-reduce:animate-none motion-reduce:transition-none",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold text-[#222631] sm:text-left">
            Добро пожаловать в Tandoor
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground sm:text-left">
            Несколько шагов, чтобы настроить аккаунт.
          </p>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Шаг {Math.min(step, 3)} из 3</span>
          </div>
          <Progress value={progressValue} className="motion-reduce:*:transition-none" />
        </div>

        {step === 1 && statusQ.data?.mustChangePassword ? (
          <form className="grid gap-4" onSubmit={(e) => void submitPassword(e)}>
            <p className="text-sm text-muted-foreground">Задайте новый пароль для входа в платформу.</p>
            <div className="space-y-2">
              <Label htmlFor="ob-cur">Текущий пароль</Label>
              <PasswordInput
                id="ob-cur"
                autoComplete="current-password"
                value={pwCur}
                onChange={(e) => setPwCur(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-n1">Новый пароль</Label>
              <PasswordInput
                id="ob-n1"
                autoComplete="new-password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="min-h-11"
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-n2">Повторите новый пароль</Label>
              <PasswordInput
                id="ob-n2"
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="min-h-11"
                minLength={8}
              />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button type="submit" className="w-full font-semibold" disabled={pwBusy}>
                {pwBusy ? "Сохранение…" : "Сохранить и продолжить"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {step === 2 ? (() => {
          const profileBannerOk =
            fullName.trim().length > 0 &&
            !email.trim().toLowerCase().endsWith("@tandoor.local") &&
            phone.trim().length > 0;
          return (
          <div className="grid gap-4">
            {profileBannerOk ? (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Данные актуальны
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="ob-fn">ФИО</Label>
              <Input id="ob-fn" value={fullName} onChange={(e) => setFullName(e.target.value)} className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-em">Email</Label>
              <Input
                id="ob-em"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11"
              />
              <p className="text-xs text-muted-foreground">Замените служебный email на ваш реальный</p>
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <PhoneInput value={phone} onChange={setPhone} />
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              {profileBannerOk ? (
                <Button type="button" className="w-full font-semibold" onClick={() => setStep(3)}>
                  Далее
                </Button>
              ) : (
                <Button type="button" className="w-full font-semibold" disabled={profBusy} onClick={() => void saveProfile()}>
                  {profBusy ? "Сохранение…" : "Сохранить и продолжить"}
                </Button>
              )}
            </DialogFooter>
          </div>
        );})() : null}

        {step === 3 ? (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Привяжите Telegram-бот @Tandoor_ibot — туда будем присылать уведомления и временные ссылки для восстановления.
            </p>
            <div className="flex flex-col gap-2">
              <Button type="button" className="w-full font-semibold" variant="default" onClick={() => void openBot()}>
                Открыть бота
              </Button>
              <Button type="button" className="w-full font-semibold" variant="secondary" onClick={() => void checkTelegram()}>
                Я привязал, проверить
              </Button>
              {tgHint ? <p className="text-sm text-muted-foreground">{tgHint}</p> : null}
              <button
                type="button"
                className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setStep(4)}
              >
                Пропустить
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <CheckCircle2 className="h-14 w-14 text-primary motion-reduce:transition-none" aria-hidden />
            <p className="text-center text-sm text-muted-foreground">Готово. Можно начинать работать.</p>
            <Button type="button" className="w-full font-semibold" onClick={() => void finish()}>
              Перейти в платформу
            </Button>
          </div>
        ) : null}

        {step < 4 ? (
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setOpen(false)}
            >
              Позже
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
