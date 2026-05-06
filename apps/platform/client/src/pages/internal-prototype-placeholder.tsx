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
  "/claims": "Рекламации",
  "/events": "События",
  "/import": "Импорт клиентской базы",
  "/goals": "Цели по витринам",
  "/leadership": "Панель руководителя",
};

export default function InternalPrototypePlaceholder() {
  const [location] = useLocation();
  const title = TITLE_BY_PATH[location] ?? "Раздел в разработке";
  const isKnown = (INTERNAL_PROTOTYPE_ROUTES as readonly string[]).includes(location);

  return (
    <div className="mx-auto max-w-lg" data-testid="page-internal-prototype-placeholder">
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Construction className="h-5 w-5 shrink-0" aria-hidden />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Раздел в подготовке и скрыт из основного меню. Вернитесь к клиентской базе.</p>
          {!isKnown ? (
            <p>Маршрут зарезервирован.</p>
          ) : (
            <p>Скоро будет доступен в общем интерфейсе.</p>
          )}
          <Button variant="outline" asChild className="min-h-11 border-border bg-card" data-testid="button-back-to-dealer-base">
            <Link href="/dealer-base">
              <ArrowLeft className="h-4 w-4" />
              К клиентской базе
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
