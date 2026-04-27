import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, CircleDashed, Layers, LockKeyhole, Package, Radar, Truck } from "lucide-react";

const layers = [
  {
    title: "Ядро платформы",
    description:
      "Общие мастер-данные по организациям, пользователям, ролям, товарам, заказам, документам, рекламациям и событиям жизненного цикла.",
  },
  {
    title: "Операционные модули",
    description:
      "Дилеры, каталог, заказы, рекламации и журнал событий работают как независимые модули.",
  },
  {
    title: "Ролевые интерфейсы",
    description:
      "В MVP уже есть модель пользователей, организаций и назначений ролей для будущего RBAC и сегментации рабочих пространств.",
  },
];

const implemented = [
  "Модель данных (Drizzle SQLite schema)",
  "Демо API для организаций, пользователей, дилеров, товаров, заказов, рекламаций и событий",
  "Данные дилеров и обзор операционного контура",
  "Каталог с SKU, категориями, отделками и ценами",
  "Заказы со статусами и карточкой деталей",
  "Рекламации со статусами жизненного цикла",
  "Лента событий для операционной трассировки",
];

const upcoming = [
  "Реальная аутентификация и политики RBAC",
  "Процесс создания и редактирования заказа",
  "Генерация документов и маршрут согласования",
  "Обработка рекламаций и контроль SLA",
  "Интеграция со складом и логистикой",
  "BI-дашборды и управленческая аналитика",
];

export default function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <Card data-testid="architecture-overview-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Layers className="h-5 w-5 text-primary" />
            Статус архитектуры платформы
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Внутренний обзор модульного B2B2C-фундамента платформы Tandoor.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {layers.map((layer) => (
            <div key={layer.title} className="rounded-xl border border-border bg-background p-4">
              <h3 className="text-sm font-semibold text-foreground">{layer.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{layer.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="architecture-implemented-card">
          <CardHeader>
            <CardTitle className="text-lg">Реализованные блоки MVP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {implemented.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="architecture-upcoming-card">
          <CardHeader>
            <CardTitle className="text-lg">Следующие блоки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                <CircleDashed className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="architecture-map-card">
        <CardHeader>
          <CardTitle className="text-lg">Карта модулей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Ядро данных</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Организации, пользователи, роли, товары.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Операции</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Заказы, рекламации, документы, статусы.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">События</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">События жизненного цикла и журнал платформы.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">RBAC (далее)</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Контроль доступа и слой политик рабочих пространств.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Готовность</p>
              <Separator className="my-2" />
              <Badge className="bg-primary/90 text-primary-foreground">MVP-фундамент запущен</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
