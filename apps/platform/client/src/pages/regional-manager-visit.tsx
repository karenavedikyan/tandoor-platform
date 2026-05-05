import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, CheckCircle2, Store } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type {
  DistributionReportItem,
  DistributionReportPayload,
  DistributionReportResponse,
  ShowcaseGoal,
  VisitDetail,
} from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import {
  competitorPresenceLabel,
  dealerTypeLabel,
  displayQualityLabel,
  potentialLevelLabel,
  routeStatusLabel,
  stockStatusLabel,
  storeFormatLabel,
  tradePointStatusLabel,
  visitPriorityLabel,
  visitPurposeLabel,
  visitStatusLabel,
} from "@/lib/labels";

type FormItem = {
  id: number;
  productId: number;
  modelName: string;
  sku: string;
  category: string;
  isPresent: boolean;
  isOnShowcase: boolean;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  comment: string;
};

type FormState = {
  hasShowcase: boolean;
  showcaseDoorsCount: number;
  displayQuality: "excellent" | "good" | "average" | "poor";
  competitorPresence: "none" | "low" | "medium" | "high";
  recommendation: string;
  nextAction: string;
  items: FormItem[];
};

function toFormItem(item: DistributionReportItem): FormItem {
  return {
    id: item.id,
    productId: item.productId,
    modelName: item.modelName,
    sku: item.sku,
    category: item.category,
    isPresent: item.isPresent === 1,
    isOnShowcase: item.isOnShowcase === 1,
    stockStatus: item.stockStatus,
    comment: item.comment ?? "",
  };
}

function buildInitialForm(data: VisitDetail): FormState {
  const report = data.distributionReport?.report;
  const items = (data.distributionReport?.items ?? data.productChecklist).map(toFormItem);
  return {
    hasShowcase: report ? report.hasShowcase === 1 : false,
    showcaseDoorsCount: report?.showcaseDoorsCount ?? 0,
    displayQuality: report?.displayQuality ?? "average",
    competitorPresence: report?.competitorPresence ?? "none",
    recommendation: report?.recommendation ?? "",
    nextAction: report?.nextAction ?? "",
    items,
  };
}

function toPayload(form: FormState): DistributionReportPayload {
  return {
    hasShowcase: form.hasShowcase,
    showcaseDoorsCount: Math.max(0, form.showcaseDoorsCount),
    displayQuality: form.displayQuality,
    competitorPresence: form.competitorPresence,
    recommendation: form.recommendation.trim(),
    nextAction: form.nextAction.trim(),
    items: form.items.map((item) => ({
      productId: item.productId,
      isPresent: item.isPresent,
      isOnShowcase: item.isOnShowcase,
      stockStatus: item.stockStatus,
      comment: item.comment.trim() || null,
    })),
  };
}

export default function RegionalManagerVisitPage() {
  const [match, params] = useRoute("/regional-manager/visits/:id");
  const visitId = match ? Number.parseInt(params.id, 10) : Number.NaN;
  const { toast } = useToast();

  const query = useQuery<VisitDetail>({
    queryKey: ["/api/regional-manager/visits", String(visitId)],
    enabled: Number.isFinite(visitId),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [initializedFromVisitId, setInitializedFromVisitId] = useState<number | null>(null);

  useEffect(() => {
    if (query.data && initializedFromVisitId !== query.data.visit.id) {
      setForm(buildInitialForm(query.data));
      setInitializedFromVisitId(query.data.visit.id);
    }
  }, [query.data, initializedFromVisitId]);

  const draftMutation = useMutation({
    mutationFn: async (payload: DistributionReportPayload) => {
      const response = await apiRequest(
        "POST",
        `/api/regional-manager/visits/${visitId}/distribution-report/draft`,
        payload,
      );
      return (await response.json()) as { success: true; report: DistributionReportResponse };
    },
    onSuccess: () => {
      toast({ title: "Черновик отчета сохранен" });
      void query.refetch();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: DistributionReportPayload) => {
      const response = await apiRequest(
        "POST",
        `/api/regional-manager/visits/${visitId}/distribution-report/submit`,
        payload,
      );
      return (await response.json()) as { success: true; message: string; report: DistributionReportResponse };
    },
    onSuccess: () => {
      toast({
        title: "Отчет отправлен. Цели по витрине можно передать отделу продаж.",
      });
      void query.refetch();
    },
  });

  const [createdGoalLink, setCreatedGoalLink] = useState<string | null>(null);
  const [createdGoalText, setCreatedGoalText] = useState<string | null>(null);

  const createGoalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/regional-manager/visits/${visitId}/distribution-report/create-showcase-goal`,
      );
      return (await response.json()) as {
        success: true;
        message: string;
        goal?: ShowcaseGoal;
      };
    },
    onSuccess: (result) => {
      toast({
        title: result.message ?? "Цель по витрине сформирована и передана менеджеру продаж.",
      });
      const goalId = result.goal?.id;
      if (goalId) {
        setCreatedGoalLink(`/sales/showcase-goals/${goalId}`);
        setCreatedGoalText("Открыть цель");
      } else {
        setCreatedGoalLink("/sales/showcase-goals");
        setCreatedGoalText("Открыть список целей");
      }
    },
  });

  const summary = useMemo(() => {
    if (!form) {
      return {
        total: 0,
        present: 0,
        missing: 0,
        showcase: 0,
      };
    }
    const total = form.items.length;
    const present = form.items.filter((item) => item.isPresent).length;
    const showcase = form.items.filter((item) => item.isOnShowcase).length;
    return {
      total,
      present,
      missing: total - present,
      showcase,
    };
  }, [form]);

  if (!Number.isFinite(visitId)) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Некорректный ID визита</AlertTitle>
        <AlertDescription>Откройте визит из маршрута регионального менеджера.</AlertDescription>
      </Alert>
    );
  }

  if (query.isLoading || (query.data && !form)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить визит</AlertTitle>
        <AlertDescription>
          {query.error instanceof Error ? query.error.message : "Неожиданная ошибка"}
        </AlertDescription>
      </Alert>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Визит не найден</AlertTitle>
        <AlertDescription>Запрошенная карточка визита отсутствует в демо-данных.</AlertDescription>
      </Alert>
    );
  }
  if (!form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const safeForm: FormState = form;
  const isMutating =
    draftMutation.isPending || submitMutation.isPending || createGoalMutation.isPending;

  return (
    <div className="space-y-6" data-testid="page-regional-manager-visit">
      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="space-y-3">
          <Button asChild variant="outline" size="sm" className="w-fit rounded-xl" data-testid="button-back-route">
            <Link href="/regional-manager/route">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к маршруту
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-fit rounded-xl"
            data-testid="button-back-regional-workspace"
          >
            <Link href="/regional-manager/workspace">
              <ArrowLeft className="mr-2 h-4 w-4" />В ЛК регионала
            </Link>
          </Button>
          <div className="space-y-1">
            <CardTitle className="text-xl">{data.visit.dealer.name}</CardTitle>
            <CardDescription>{data.visit.tradePoint.name}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Адрес</p>
            <p className="mt-1 font-medium">
              {data.visit.tradePoint.city}, {data.visit.tradePoint.address}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Время визита</p>
            <p className="mt-1 font-medium">{data.visit.plannedTime}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Статус</p>
            <Badge className="mt-2 bg-white" variant="outline">
              {visitStatusLabel(data.visit.visitStatus)}
            </Badge>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Цель визита</p>
            <p className="mt-1 font-medium">{visitPurposeLabel(data.visit.visitPurpose)}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-visit-client-context">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Контекст клиента</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-3 text-sm">
            <p className="text-xs text-muted-foreground">Дилер</p>
            <p className="mt-1 font-medium">{data.dealer.name}</p>
            <p className="mt-1 text-muted-foreground">
              {dealerTypeLabel(data.dealer.dealerType)} · {data.dealer.segment}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3 text-sm">
            <p className="text-xs text-muted-foreground">Потенциал</p>
            <p className="mt-1 font-medium">{potentialLevelLabel(data.dealer.potentialLevel ?? "medium")}</p>
            <p className="mt-1 text-muted-foreground">Активных задач: {data.activeTaskCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3 text-sm">
            <p className="text-xs text-muted-foreground">Ответственные</p>
            <p className="mt-1 font-medium">
              МП: {data.salesManager ? `${data.salesManager.firstName} ${data.salesManager.lastName}` : "Не назначен"}
            </p>
            <p className="mt-1 text-muted-foreground">
              РМ:{" "}
              {data.regionalManager
                ? `${data.regionalManager.firstName} ${data.regionalManager.lastName}`
                : "Не назначен"}
            </p>
          </div>
          <Button asChild variant="outline" className="w-full rounded-xl sm:col-span-2 lg:col-span-1">
            <Link href={`/dealers/${data.dealer.id}`}>Открыть карточку дилера</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-visit-trade-point">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Торговая точка</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Формат</p>
            <p className="mt-1 font-medium">{storeFormatLabel(data.tradePoint.storeFormat)}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Площадь</p>
            <p className="mt-1 font-medium">{data.tradePoint.areaSqm ?? "—"} м²</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Статус</p>
            <p className="mt-1 font-medium">{tradePointStatusLabel(data.tradePoint.status)}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3 sm:col-span-2 lg:col-span-3">
            <p className="text-xs text-muted-foreground">Ассортиментный профиль</p>
            <p className="mt-1">{data.tradePoint.assortmentProfile}</p>
            <p className="mt-2 text-muted-foreground">{data.tradePoint.comment ?? "Комментарий отсутствует"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-distribution-report-form">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Отчет дистрибуции</CardTitle>
          <CardDescription>
            Маршрут: {routeStatusLabel(data.route.status)} · Приоритет визита:{" "}
            {visitPriorityLabel(data.visit.priority)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="showcase-select">Наличие витрины</Label>
            <Select
              value={safeForm.hasShowcase ? "yes" : "no"}
              onValueChange={(value) => setForm((prev) => (prev ? { ...prev, hasShowcase: value === "yes" } : prev))}
            >
              <SelectTrigger id="showcase-select" className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Да</SelectItem>
                <SelectItem value="no">Нет</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="showcase-doors">Количество дверей на витрине</Label>
            <Input
              id="showcase-doors"
              type="number"
              min={0}
              value={safeForm.showcaseDoorsCount}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        showcaseDoorsCount: Number.parseInt(event.target.value || "0", 10) || 0,
                      }
                    : prev,
                )
              }
              data-testid="input-showcase-doors-count"
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label>Качество выкладки</Label>
            <Select
              value={safeForm.displayQuality}
              onValueChange={(value) =>
                setForm((prev) =>
                  prev ? { ...prev, displayQuality: value as FormState["displayQuality"] } : prev,
                )
              }
            >
              <SelectTrigger data-testid="select-display-quality" className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">{displayQualityLabel("excellent")}</SelectItem>
                <SelectItem value="good">{displayQualityLabel("good")}</SelectItem>
                <SelectItem value="average">{displayQualityLabel("average")}</SelectItem>
                <SelectItem value="poor">{displayQualityLabel("poor")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Присутствие конкурентов</Label>
            <Select
              value={safeForm.competitorPresence}
              onValueChange={(value) =>
                setForm((prev) =>
                  prev
                    ? { ...prev, competitorPresence: value as FormState["competitorPresence"] }
                    : prev,
                )
              }
            >
              <SelectTrigger data-testid="select-competitor-presence" className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{competitorPresenceLabel("none")}</SelectItem>
                <SelectItem value="low">{competitorPresenceLabel("low")}</SelectItem>
                <SelectItem value="medium">{competitorPresenceLabel("medium")}</SelectItem>
                <SelectItem value="high">{competitorPresenceLabel("high")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="recommendation">Рекомендация</Label>
            <Textarea
              id="recommendation"
              value={safeForm.recommendation}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, recommendation: event.target.value } : prev))}
              data-testid="textarea-recommendation"
              className="min-h-24 bg-white"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="next-action">Следующее действие</Label>
            <Textarea
              id="next-action"
              value={safeForm.nextAction}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, nextAction: event.target.value } : prev))}
              data-testid="textarea-next-action"
              className="min-h-24 bg-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-product-checklist">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Проверка моделей</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {safeForm.items.map((item) => (
            <div
              key={item.id}
              className="space-y-3 rounded-xl border border-border bg-white p-4"
              data-testid={`row-product-check-${item.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{item.modelName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.sku} · {item.category}
                  </p>
                </div>
                <Store className="h-4 w-4 text-primary" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                  <Checkbox
                    checked={item.isPresent}
                    onCheckedChange={(checked) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              items: prev.items.map((entry) =>
                                entry.id === item.id ? { ...entry, isPresent: checked === true } : entry,
                              ),
                            }
                          : prev,
                      )
                    }
                    data-testid={`checkbox-product-present-${item.id}`}
                  />
                  Есть в ТТ
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                  <Checkbox
                    checked={item.isOnShowcase}
                    onCheckedChange={(checked) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              items: prev.items.map((entry) =>
                                entry.id === item.id ? { ...entry, isOnShowcase: checked === true } : entry,
                              ),
                            }
                          : prev,
                      )
                    }
                    data-testid={`checkbox-product-showcase-${item.id}`}
                  />
                  На витрине
                </label>
                <Select
                  value={item.stockStatus}
                  onValueChange={(value) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            items: prev.items.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, stockStatus: value as FormItem["stockStatus"] }
                                : entry,
                            ),
                          }
                        : prev,
                    )
                  }
                >
                  <SelectTrigger data-testid={`select-stock-status-${item.id}`} className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">{stockStatusLabel("in_stock")}</SelectItem>
                    <SelectItem value="low_stock">{stockStatusLabel("low_stock")}</SelectItem>
                    <SelectItem value="out_of_stock">{stockStatusLabel("out_of_stock")}</SelectItem>
                    <SelectItem value="unknown">{stockStatusLabel("unknown")}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={item.comment}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            items: prev.items.map((entry) =>
                              entry.id === item.id ? { ...entry, comment: event.target.value } : entry,
                            ),
                          }
                        : prev,
                    )
                  }
                  placeholder="Комментарий"
                  data-testid={`input-product-comment-${item.id}`}
                  className="bg-white"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="card-report-summary">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Итог отчета</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Проверено моделей</p>
            <p className="mt-1 text-lg font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Присутствует</p>
            <p className="mt-1 text-lg font-semibold">{summary.present}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Отсутствует</p>
            <p className="mt-1 text-lg font-semibold">{summary.missing}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">На витрине</p>
            <p className="mt-1 text-lg font-semibold">{summary.showcase}</p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
            <p className="text-xs text-muted-foreground">Потенциальные цели</p>
            <p className="mt-1 text-sm font-medium">
              {summary.missing > 0 ? `Добавить минимум ${summary.missing} моделей` : "Поддерживать текущий уровень"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-create-showcase-goal">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">
            Следующий шаг: цель по витрине
          </CardTitle>
          <CardDescription>
            На основании отсутствующих моделей можно сформировать цель для менеджера продаж.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => createGoalMutation.mutate()}
            disabled={isMutating}
            className="rounded-xl"
            data-testid="button-create-showcase-goal"
          >
            Сформировать цель по витрине
          </Button>
          {createdGoalLink && createdGoalText ? (
            <Button
              asChild
              variant="outline"
              className="rounded-xl"
              data-testid="link-open-created-showcase-goal"
            >
              <Link href={createdGoalLink}>{createdGoalText}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Button
          onClick={() => draftMutation.mutate(toPayload(safeForm))}
          disabled={isMutating}
          data-testid="button-save-report-draft"
          className="rounded-xl"
        >
          Сохранить черновик
        </Button>
        <Button
          onClick={() => submitMutation.mutate(toPayload(safeForm))}
          disabled={isMutating}
          data-testid="button-submit-report"
          className="rounded-xl"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Отправить отчет
        </Button>
        <Button asChild variant="outline" data-testid="button-return-route" className="rounded-xl">
          <Link href="/regional-manager/route">Вернуться к маршруту</Link>
        </Button>
      </div>

      {data.visit.completedAt && (
        <p className="text-xs text-muted-foreground">
          Визит завершен: {formatDateTime(data.visit.completedAt)}
        </p>
      )}
    </div>
  );
}
