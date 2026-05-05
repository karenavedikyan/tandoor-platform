import { Link, useLocation } from "wouter";
import { ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INTERNAL_PROTOTYPE_ROUTES } from "@/lib/preview-config";

const TITLE_BY_PATH: Record<string, string> = {
  "/sales-department": "ЛК отдела продаж",
  "/regional-manager/workspace": "ЛК регионального менеджера",
  "/dealers": "Дилеры",
  "/catalog": "Каталог",
  "/orders": "Заказы",
  "/claims": "Рекламации",
  "/events": "События",
  "/import": "Импорт клиентской базы",
  "/tasks": "Задачи",
  "/goals": "Цели по витринам",
  "/sales-manager": "Рабочий стол менеджера продаж",
  "/leadership": "Панель руководителя",
};

export default function InternalPrototypePlaceholder() {
  const [location] = useLocation();
  const title = TITLE_BY_PATH[location] ?? "Внутренний прототип";
  const isKnown = (INTERNAL_PROTOTYPE_ROUTES as readonly string[]).includes(location);

  return (
    <div className="mx-auto max-w-lg" data-testid="page-internal-prototype-placeholder">
      <Card className="border-neutral-200/80 bg-white shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-[#5a9e00]">
            <Construction className="h-5 w-5 shrink-0" aria-hidden />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Этот раздел относится к <strong className="text-foreground">внутреннему прототипу</strong> и скрыт из
            публичной навигации preview-режима.
          </p>
          {!isKnown ? (
            <p>Маршрут зарезервирован под будущую реализацию.</p>
          ) : (
            <p>Маршрут сохранён для команды разработки и не входит в публичный preview.</p>
          )}
          <Button variant="outline" asChild className="min-h-11 border-neutral-200 bg-white" data-testid="button-internal-back-home">
            <Link href="/dealer-card-foundation">
              <ArrowLeft className="h-4 w-4" />
              К первому этапу
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
