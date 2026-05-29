import { Globe, Lock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildPublicBriefShareUrl,
  updateBrief,
  type MarketingBriefRow,
  type MarketingBriefVisibility,
} from "@/lib/marketing-briefs-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function BriefVisibilityIcon({
  visibility,
  className,
}: {
  visibility: MarketingBriefVisibility;
  className?: string;
}) {
  const isPublic = visibility === "public";
  const Icon = isPublic ? Globe : Lock;
  const label = isPublic
    ? "Публичный — доступен по ссылке без входа"
    : "Приватный — виден только в ЛК";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("inline-flex shrink-0 text-muted-foreground", className)}
          aria-label={label}
          data-testid={`brief-visibility-icon-${visibility}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function BriefVisibilityToggle({
  briefId,
  visibility,
  disabled,
  onUpdated,
}: {
  briefId: string;
  visibility: MarketingBriefVisibility;
  disabled?: boolean;
  onUpdated: (brief: MarketingBriefRow) => void;
}) {
  async function setVisibility(next: MarketingBriefVisibility) {
    if (next === visibility || disabled) return;
    try {
      const updated = await updateBrief(briefId, { visibility: next });
      onUpdated(updated);
      toast({ title: "Доступ обновлён" });
    } catch (e) {
      toast({
        title: "Не удалось обновить доступ",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }

  return (
    <div
      className="flex flex-col gap-1 sm:flex-row sm:items-center"
      role="group"
      aria-label="Доступ к брифу"
      data-testid="brief-visibility-toggle"
    >
      <Button
        type="button"
        size="sm"
        variant={visibility === "private" ? "secondary" : "outline"}
        className="h-9 gap-1.5 justify-start"
        disabled={disabled}
        onClick={() => void setVisibility("private")}
        data-testid="button-brief-visibility-private"
      >
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-left">
          <span className="block text-xs font-medium">Приватный</span>
          <span className="block text-[10px] font-normal text-muted-foreground">Видят только сотрудники ЛК</span>
        </span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={visibility === "public" ? "secondary" : "outline"}
        className="h-9 gap-1.5 justify-start"
        disabled={disabled}
        onClick={() => void setVisibility("public")}
        data-testid="button-brief-visibility-public"
      >
        <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-left">
          <span className="block text-xs font-medium">Публичный</span>
          <span className="block text-[10px] font-normal text-muted-foreground">Доступен по ссылке без входа</span>
        </span>
      </Button>
    </div>
  );
}

export function BriefShareActions({
  brief,
  onBriefUpdated,
}: {
  brief: MarketingBriefRow;
  onBriefUpdated?: (brief: MarketingBriefRow) => void;
}) {
  if (brief.status !== "published") return null;

  const isPublic = brief.visibility === "public";

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(buildPublicBriefShareUrl(brief.id));
      toast({ title: "Ссылка скопирована" });
    } catch {
      toast({ title: "Не удалось скопировать ссылку", variant: "destructive" });
    }
  }

  async function makePublicAndCopy() {
    try {
      const updated = await updateBrief(brief.id, { visibility: "public" });
      onBriefUpdated?.(updated);
      await navigator.clipboard.writeText(buildPublicBriefShareUrl(brief.id));
      toast({ title: "Бриф теперь публичный, ссылка скопирована" });
    } catch (e) {
      toast({
        title: "Не удалось сделать бриф публичным",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }

  if (isPublic) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            data-testid="button-brief-share"
            onClick={() => void copyShareLink()}
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Поделиться
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-xs">
          Ссылка работает без входа — её можно отправить менеджерам
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="gap-1.5"
      data-testid="button-brief-make-public"
      onClick={() => void makePublicAndCopy()}
    >
      <Globe className="h-4 w-4" aria-hidden />
      Сделать публичным
    </Button>
  );
}
