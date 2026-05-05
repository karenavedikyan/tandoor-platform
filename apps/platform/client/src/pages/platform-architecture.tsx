import { Link } from "wouter";
import { ArrowLeft, Lock, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LAYERS = [
  {
    title: "Текущие системы",
    items: ["1С", "Bitrix-сайт", "Bitrix24", "Excel", "Google"],
  },
  {
    title: "Интеграционный слой",
    items: ["Staging", "Внешние ID", "Журнал синхронизации", "Дедупликация", "Правила источника истины"],
  },
  {
    title: "Единая модель данных",
    items: [
      "Дилер",
      "Торговая точка",
      "Контакт",
      "Пользователь",
      "Роль",
      "Заказ",
      "Рекламация",
      "Задача",
      "Визит",
      "Отчёт",
      "Документ",
      "Дебиторка",
    ],
  },
  {
    title: "Ролевые кабинеты",
    items: ["Дилер", "Менеджер", "Региональный менеджер", "Руководитель", "Администратор", "Будущие отделы"],
  },
  {
    title: "Управленческий слой",
    items: ["KPI", "Отклонения", "Контроль задач", "Риски", "Качество данных"],
  },
] as const;

const SOURCE_OF_TRUTH: { subject: string; master: string }[] = [
  { subject: "Товары", master: "1С" },
  { subject: "Цены", master: "1С" },
  { subject: "Остатки", master: "1С" },
  { subject: "Заказы", master: "1С / Bitrix-сайт" },
  { subject: "Дебиторка", master: "1С" },
  { subject: "Клиенты / дилеры", master: "Platform после нормализации" },
  { subject: "Контакты", master: "Platform / Bitrix24" },
  { subject: "Задачи", master: "Platform" },
  { subject: "Визиты", master: "Platform" },
  { subject: "Отчёты РМ", master: "Platform" },
  { subject: "Рекламации", master: "Platform + интеграция Bitrix24" },
  { subject: "База знаний", master: "Platform" },
];

export default function PlatformArchitecture() {
  return (
    <div className="space-y-10 sm:space-y-12" data-testid="page-platform-architecture">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Архитектура платформы</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Краткая схема: от текущих систем к единой модели данных и ролевым кабинетам.
          </p>
        </div>
        <Button variant="outline" asChild className="min-h-11 shrink-0 border-neutral-200 bg-white self-start sm:self-auto">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>
        </Button>
      </div>

      <section data-testid="section-architecture-layers">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-[#5a9e00]" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Слои архитектуры</h2>
        </div>
        <div className="mt-4 space-y-4">
          {LAYERS.map((layer) => (
            <Card key={layer.title} className="border-neutral-200/80 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{layer.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-2">
                  {layer.items.map((item) => (
                    <li
                      key={item}
                      className="rounded-full border border-neutral-200 bg-[#f7f8f6] px-3 py-1 text-xs font-medium text-foreground sm:text-sm"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section data-testid="section-source-of-truth">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Источники правды</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Упрощённая матрица: фактические правила уточняются при интеграции каждого контура.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SOURCE_OF_TRUTH.map((row) => (
            <Card key={row.subject} className="border-neutral-200/80 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">{row.subject}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Источник: </span>
                  {row.master}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8"
        data-testid="section-architecture-security"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-[#5a9e00]" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">Безопасность</h2>
        </div>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-muted-foreground sm:text-base">
          <li>Публичный репозиторий — только для очищенного прототипа и документации.</li>
          <li>Реальные данные не попадают в git.</li>
          <li>Секреты — только в ENV, GitHub Secrets, Vercel Env и закрытых хранилищах.</li>
          <li>Репозиторий tandoor-bitrix остаётся приватным production-контуром.</li>
          <li>Тестировщикам показывается только preview-слой интерфейса.</li>
        </ul>
      </section>
    </div>
  );
}
