import { Link } from "wouter";
import { ArrowLeft, Link2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SCOPE_ITEMS = [
  "Основные данные дилера",
  "Торговые точки",
  "Контакты",
  "Ответственные",
  "Заказы",
  "Рекламации",
  "Дебиторка",
  "Задачи",
  "Визиты",
  "Отчёты регионала",
  "Документы",
  "Активность в ЛК дилера",
] as const;

const SOURCE_LINKS = [
  {
    title: "1С",
    lines: ["Код / GUID", "Заказы", "Цены", "Остатки", "Дебиторка"],
  },
  {
    title: "Bitrix-сайт",
    lines: ["Идентификатор пользователя ЛК", "Заказы", "Рекламации"],
  },
  {
    title: "Bitrix24",
    lines: ["Компания", "Контакт", "Сделки", "Коммуникации"],
  },
  {
    title: "Excel",
    lines: ["Исторические списки", "Загрузки и сверки"],
  },
  {
    title: "Google",
    lines: ["Таблицы и доски", "Материалы до миграции"],
  },
  {
    title: "Platform",
    lines: ["Единый ID", "Роли", "Задачи", "Визиты", "Отчёты"],
  },
] as const;

const QUALITY_CHECKS = [
  "Заполненность ИНН",
  "Совпадение по внешним ID",
  "Дубли по названию",
  "Дубли по адресу",
  "Неизвестный ответственный",
  "Нет регионального менеджера",
  "Нет торговой точки",
  "Конфликт статуса между источниками",
] as const;

const ACCESS_RULES = [
  "Менеджер продаж видит своих дилеров",
  "Региональный менеджер видит свои торговые точки",
  "Руководитель видит команду и регион",
  "Администратор видит качество данных и настройки",
  "Дилер видит только свой кабинет и свои данные",
] as const;

export default function DealerCardFoundation() {
  return (
    <div className="space-y-10 sm:space-y-12" data-testid="page-dealer-card-foundation">
      <section
        className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-10"
        data-testid="section-dealer-card-hero"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Единая карточка дилера</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Карточка дилера станет центральной сущностью платформы: вокруг неё будут объединяться данные из 1С, Bitrix,
          Bitrix24, Excel, Google-источников и текущего ЛК дилера.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" asChild className="min-h-11 border-neutral-200 bg-white" data-testid="button-back-preview-home">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Вернуться на главную
            </Link>
          </Button>
          <Button variant="outline" asChild className="min-h-11 border-neutral-200 bg-white" data-testid="button-open-architecture-from-dealer-card">
            <Link href="/platform-architecture">Посмотреть архитектуру</Link>
          </Button>
        </div>
      </section>

      <section data-testid="section-dealer-card-scope">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Что объединяет карточка</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCOPE_ITEMS.map((item) => (
            <Card key={item} className="border-neutral-200/80 bg-white shadow-sm">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-medium leading-snug">{item}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section data-testid="section-dealer-source-links">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-[#5a9e00]" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Связи с источниками</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {SOURCE_LINKS.map((block) => (
            <Card key={block.title} className="border-neutral-200/80 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{block.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {block.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section data-testid="section-data-quality">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Качество данных</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Плановые проверки при нормализации и сверке — без отображения реальных записей.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {QUALITY_CHECKS.map((q) => (
            <Card key={q} className="border-neutral-200/80 bg-white shadow-sm">
              <CardContent className="py-4 text-sm text-muted-foreground">{q}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section data-testid="section-dealer-access-rules">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#5a9e00]" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Права и видимость</h2>
        </div>
        <div className="mt-4 space-y-3">
          {ACCESS_RULES.map((rule) => (
            <Card key={rule} className="border-neutral-200/80 bg-white shadow-sm">
              <CardContent className="py-4 text-sm text-muted-foreground">{rule}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8"
        data-testid="section-next-step-client-import"
      >
        <h2 className="text-lg font-semibold text-foreground">Следующий шаг</h2>
        <p className="mt-2 text-sm font-medium text-foreground sm:text-base">Следующий этап — импорт и сверка клиентской базы.</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Что будет дальше: загрузка источников, staging, поиск дублей, назначение ответственных, создание единой
          карточки.
        </p>
        <Button variant="outline" asChild className="mt-6 min-h-11 border-neutral-200 bg-white" data-testid="button-next-step-back-home">
          <Link href="/">Вернуться на главную</Link>
        </Button>
      </section>
    </div>
  );
}
