import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Публичный первый этап: один экран для `/#/` и `/#/dealer-card-foundation`. */

const CARD_SECTIONS: { label: string; testId: string }[] = [
  { label: "Основная информация", testId: "card-dealer-section-main-info" },
  { label: "Торговые точки", testId: "card-dealer-section-outlets" },
  { label: "Ответственные", testId: "card-dealer-section-owners" },
  { label: "Контакты", testId: "card-dealer-section-contacts" },
  { label: "Заказы", testId: "card-dealer-section-orders" },
  { label: "Дебиторка", testId: "card-dealer-section-ar" },
  { label: "Рекламации", testId: "card-dealer-section-claims" },
  { label: "Документы", testId: "card-dealer-section-docs" },
  { label: "История взаимодействий", testId: "card-dealer-section-history" },
  { label: "Активность из ЛК дилера", testId: "card-dealer-section-dealer-portal" },
];

const REVIEW_FOCUS = [
  "структура карточки дилера;",
  "понятность разделов;",
  "какие данные нужны менеджеру;",
  "какие данные нужны региональному менеджеру;",
  "какие данные нужны руководителю;",
  "что лишнее или не хватает.",
] as const;

export function DealerCardFoundationContent() {
  return (
    <div className="space-y-8 sm:space-y-10" data-testid="page-dealer-card-foundation">
      <section
        className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-10"
        data-testid="section-dealer-card-hero"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("border-[#7DC400]/40 bg-[#7DC400]/20 font-medium text-foreground")}
            data-testid="badge-preview-stage"
          >
            Preview · Первый этап
          </Badge>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Единая карточка дилера</h1>
        <p className="mt-2 text-lg font-medium text-foreground sm:text-xl">Первый этап платформы Tandoor</p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Здесь будет собираться единая информация о дилере из текущих систем: 1С, Bitrix, Bitrix24, Excel и
          Google-источников.
        </p>
      </section>

      <section data-testid="section-dealer-card-scope">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Каркас карточки дилера</h2>
        <p className="mt-1 text-sm text-muted-foreground">Разделы первого экрана — без реальных данных, для согласования структуры.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CARD_SECTIONS.map(({ label, testId }) => (
            <Card key={label} className="border-neutral-200/80 bg-white shadow-sm" data-testid={testId}>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-medium leading-snug">{label}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8"
        data-testid="section-dealer-card-review-focus"
      >
        <h2 className="text-lg font-semibold text-foreground">Что проверяем сейчас</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-muted-foreground sm:text-base">
          {REVIEW_FOCUS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <p className="text-center text-xs text-muted-foreground" data-testid="text-preview-footer-note">
        Демонстрационный интерфейс без доступа к production-данным.
      </p>
    </div>
  );
}

export default function DealerCardFoundation() {
  return <DealerCardFoundationContent />;
}
