import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function FeatureInDevelopmentPage() {
  const [loc] = useLocation();
  const feature = useMemo(() => {
    const q = loc.includes("?") ? loc.slice(loc.indexOf("?") + 1) : "";
    if (!q) return null;
    return new URLSearchParams(q).get("feature");
  }, [loc]);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8" data-testid="page-feature-in-development">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-[#222631]" data-testid="text-feature-in-development-title">
          Раздел в разработке
        </h1>
        <p className="text-sm leading-relaxed text-[#8F96B0]" data-testid="text-feature-in-development-description">
          Мы готовим этот инструмент для директора и РОПов. Здесь появятся рабочие сценарии после согласования требований.
        </p>
        <p className="text-sm text-[#8F96B0]">
          Можно оставить пожелания: какие данные, действия и отчёты нужны в этом разделе.
        </p>
        {feature ? (
          <p className="text-xs text-muted-foreground">
            Ключ раздела: <span className="font-mono text-foreground">{feature}</span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild className="bg-[#9ACA3C] text-[#222631] hover:bg-[#86B832]" data-testid="button-feature-in-development-home">
          <Link href="/main">Вернуться на главную</Link>
        </Button>
        <Button type="button" variant="outline" disabled className="border-[#E3E6F3] text-[#8F96B0]" data-testid="button-feature-in-development-feedback">
          Оставить пожелание
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Кнопка «Оставить пожелание» будет доступна после подключения канала обратной связи.</p>
    </div>
  );
}
