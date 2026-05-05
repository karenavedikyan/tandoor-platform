import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Публичный первый этап: каркас карточки дилера по структуре sensus (отдел продаж).
 * Только demo-данные. Для `/#/` и `/#/dealer-card-foundation`.
 */

function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-lg font-semibold tracking-tight text-foreground sm:text-xl", className)}>{children}</h2>;
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-neutral-100 py-2 last:border-0 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-xs font-medium text-muted-foreground sm:min-w-[40%]">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function KpiTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="border-neutral-200/80 bg-[#fafafa] shadow-sm">
      <CardHeader className="pb-2 pt-4">
        <CardDescription className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardDescription>
        <CardTitle className="text-xl font-semibold text-foreground sm:text-2xl">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

export function DealerCardFoundationContent() {
  return (
    <div className="space-y-8 sm:space-y-10" data-testid="page-dealer-card-foundation">
      {/* Hero */}
      <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-10">
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
          Собираем единую рабочую карточку клиента: данные из 1С, Bitrix, Bitrix24, Excel/Google-источников и будущих
          отчетов региональных менеджеров.
        </p>
      </section>

      {/* Сводка */}
      <section data-testid="section-dealer-summary">
        <SectionTitle>Сводка дилера</SectionTitle>
        <Card className="mt-4 border-neutral-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-muted-foreground">
              Данные обезличены. Структура основана на таблице отдела продаж.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            <FieldRow label="№" value="001 (демо)" />
            <FieldRow label="Название клиента" value="Демо-дилер" />
            <FieldRow label="Категория клиента" value="TOP / ключевой клиент" />
            <FieldRow label="Статус" value="Активный" />
            <FieldRow label="Холдинг / сеть" value="Демо-холдинг" />
            <FieldRow label="Юрлицо" value="Демо-юрлицо" />
            <FieldRow label="Регион / город" value="Демо-регион" />
          </CardContent>
        </Card>
      </section>

      {/* Ответственные */}
      <section data-testid="section-dealer-responsibles">
        <SectionTitle>Ответственные</SectionTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { role: "Руководитель", name: "Иванов И.И.", zone: "Стратегия и контроль команды" },
            { role: "Менеджер продаж", name: "Петров П.П.", zone: "Сопровождение договоренностей и заказов" },
            { role: "Региональный менеджер", name: "Сидорова С.С.", zone: "Визиты, витрины, отчеты по региону" },
            { role: "Ассистент / будущая роль", name: "Кузнецова К.К.", zone: "Подготовка материалов и координация" },
          ].map((p) => (
            <Card key={p.role} className="border-neutral-200/80 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wide text-[#5a9e00]">
                  {p.role}
                </CardDescription>
                <CardTitle className="text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{p.zone}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Торговые точки */}
      <section data-testid="section-dealer-trade-points">
        <SectionTitle>Торговые точки</SectionTitle>
        <Card className="mt-4 border-neutral-200/80 bg-white shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <FieldRow label="Адрес" value="ул. Примерная, д. 1, Демо-регион" />
            <FieldRow label="Формат точки" value="Монобрендовый салон" />
            <FieldRow label="Оборудование" value="Стенд МК, образцы ВХ" />
            <FieldRow label="Работа в склад фурнитура/двери" value="Да, по согласованному графику" />
            <FieldRow label="Дата последнего обновления" value="15.04.2026 (демо)" />
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Фото ТТ снаружи и внутри</p>
              <p className="mt-2 rounded-lg border border-dashed border-neutral-200 bg-[#fafafa] px-3 py-4 text-sm text-muted-foreground">
                Фото будет загружаться из отчета регионального менеджера
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Контакты */}
      <section data-testid="section-dealer-contacts">
        <SectionTitle>Контакты и ЛПР</SectionTitle>
        <Card className="mt-4 border-neutral-200/80 bg-white shadow-sm">
          <CardContent className="space-y-0 pt-6">
            <FieldRow label="ЛПР" value="Директор точки (демо)" />
            <FieldRow label="Собственник / закупщик" value="Закупщик (демо)" />
            <FieldRow label="Телефон" value="+7 XXX XXX-XX-XX" />
            <FieldRow label="Email" value="demo@example.com" />
            <FieldRow label="Предпочтительный канал связи" value="Email и мессенджер" />
          </CardContent>
        </Card>
      </section>

      {/* Условия работы */}
      <section data-testid="section-dealer-terms">
        <SectionTitle>Условия работы</SectionTitle>
        <Card className="mt-4 border-neutral-200/80 bg-white shadow-sm">
          <CardContent className="space-y-0 pt-6">
            <FieldRow label="Тандор клуб" value="Участник (демо)" />
            <FieldRow label="Спец. условия" value="Индивидуальная скидка по согласованию" />
            <FieldRow label="Тип оплаты" value="Отсрочка 14 дней (демо)" />
            <FieldRow label="ЭДО" value="Диадок / аналог (демо)" />
            <FieldRow label="Лимит / индивидуальные условия" value="Лимит 2,0 млн ₽ (демо)" />
            <FieldRow label="Бонусы / мотивация продавцов" value="Квартальная программа (демо)" />
          </CardContent>
        </Card>
      </section>

      {/* Продажи */}
      <section data-testid="section-dealer-sales">
        <SectionTitle>Продажи</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">Средние показатели за квартал — демо-значения.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Средние продажи за квартал" value="1,2 млн ₽" hint="Обновление: демо" />
          <KpiTile label="МК, шт." value="450 шт." />
          <KpiTile label="ВХ, шт." value="150 шт." />
          <KpiTile label="Фурнитура" value="150 тыс. ₽" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Последняя активность / обновление: 01.05.2026 (демо)</p>
      </section>

      {/* Дистрибуция */}
      <section data-testid="section-dealer-distribution">
        <SectionTitle>Дистрибуция</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Источник данных: отчет регионального менеджера. Дата последней проверки: 20.04.2026 (демо).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { label: "МК", pct: 63 },
            { label: "ВХ", pct: 53 },
            { label: "Общая дистрибуция", pct: 59 },
          ].map((d) => (
            <Card key={d.label} className="border-neutral-200/80 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{d.label}</CardTitle>
                <p className="text-2xl font-semibold text-foreground">{d.pct}%</p>
              </CardHeader>
              <CardContent>
                <Progress value={d.pct} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Витрины и оборудование */}
      <section data-testid="section-dealer-showcases">
        <SectionTitle>Витрины и оборудование</SectionTitle>
        <Card className="mt-4 border-neutral-200/80 bg-white shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <FieldRow label="Установленное оборудование" value="Стенд МК, план ВХ Q2 (демо)" />
            <FieldRow label="Что нужно добавить" value="Доп. образцы фурнитуры (демо)" />
            <FieldRow label="Статус витрины" value="В работе — 80% (демо)" />
            <FieldRow label="Связь с целями отдела продаж" value="Цель по МК на квартал (демо)" />
            <p className="rounded-md bg-[#f7f8f6] px-3 py-2 text-xs text-muted-foreground">
              На основании отчетов регионального менеджера здесь будут формироваться цели по витринам.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Конкуренты */}
      <section data-testid="section-dealer-competitors">
        <SectionTitle>Конкуренты</SectionTitle>
        <Card className="mt-4 border-neutral-200/80 bg-white shadow-sm">
          <CardContent className="space-y-0 pt-6">
            <FieldRow label="Конкуренты в торговой точке" value="Конкурент A, Конкурент B, Конкурент C" />
            <FieldRow label="Сильные позиции конкурентов" value="Цена на ВХ, быстрые поставки (демо)" />
            <FieldRow label="Комментарий менеджера" value="Держим позицию по МК, усиливаем ВХ (демо)" />
            <FieldRow label="Комментарий регионального менеджера" value="Запланирован визит для фото витрины (демо)" />
          </CardContent>
        </Card>
      </section>

      {/* Проблемы */}
      <section data-testid="section-dealer-problems">
        <SectionTitle>Проблемы и комментарии</SectionTitle>
        <Card className="mt-4 border-destructive/25 bg-white shadow-sm">
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm font-medium text-destructive">
              Необходимо проверить полноту витрины и актуальность контактных данных.
            </p>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Кто зафиксировал</p>
                <p className="mt-1 text-foreground">Региональный менеджер (демо)</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Дата</p>
                <p className="mt-1 text-foreground">28.04.2026</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Следующий шаг</p>
                <p className="mt-1 text-foreground">Визит и обновление карточки</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Статус</p>
                <p className="mt-1 text-foreground">В работе</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Источники данных */}
      <section data-testid="section-dealer-data-sources">
        <SectionTitle>Источники данных</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">Прикладной обзор для тестировщиков — без архитектурных схем.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card className="border-neutral-200/80 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">1С</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Продажи, отгрузки, юрлица, дебиторка</CardContent>
          </Card>
          <Card className="border-neutral-200/80 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Bitrix / ЛК дилера</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Заказы, рекламации, активность</CardContent>
          </Card>
          <Card className="border-neutral-200/80 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Bitrix24</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Задачи, коммуникации, сделки и рекламации</CardContent>
          </Card>
          <Card className="border-neutral-200/80 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Excel / Google</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Текущие таблицы отдела продаж (сенсус и др.)</CardContent>
          </Card>
          <Card className="border-neutral-200/80 bg-white shadow-sm sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Отчет РМ</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Визиты, фото, дистрибуция, витрины</CardContent>
          </Card>
        </div>
      </section>

      {/* Что проверяем */}
      <section
        className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8"
        data-testid="section-dealer-review-focus"
      >
        <SectionTitle>Что проверяем на первом этапе</SectionTitle>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-muted-foreground sm:text-base">
          <li>достаточно ли полей для отдела продаж;</li>
          <li>понятна ли структура карточки;</li>
          <li>какие поля обязательные, а какие второстепенные;</li>
          <li>что нужно менеджеру продаж;</li>
          <li>что нужно региональному менеджеру;</li>
          <li>что нужно руководителю;</li>
          <li>какие данные можно синхронизировать, а какие нужно вводить вручную.</li>
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled
            className="min-h-11 border-neutral-200"
            data-testid="button-dealer-open-feedback"
            title="Форма обратной связи появится на следующем этапе"
          >
            Открыть обратную связь
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled
            className="min-h-11 border-neutral-200"
            data-testid="button-dealer-mark-field-missing"
            title="Отметка полей будет доступна после подключения данных"
          >
            Отметить недостающее поле
          </Button>
        </div>
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
