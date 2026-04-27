import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRightCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type {
  ClientImportCommitResult,
  ClientImportPreview,
  ClientImportTemplateField,
} from "@/lib/api-types";
import {
  assignmentGapTypeLabel,
  clientLifecycleStatusLabel,
  importIssueSeverityLabel,
  importRowStatusLabel,
  importSourceLabel,
  importSourceStatusLabel,
} from "@/lib/labels";

function rowStatusClass(status: string): string {
  if (status === "new") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "update") return "bg-sky-100 text-sky-800 border-sky-200";
  if (status === "duplicate") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "error") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function sourceCardIcon(source: string) {
  if (source === "one_c") return Database;
  if (source === "bitrix24") return RefreshCw;
  return FileSpreadsheet;
}

export default function SalesClientImportPage() {
  const { toast } = useToast();
  const [selectedFileName, setSelectedFileName] = useState<string>("client-import-template.xlsx");
  const [previewOverride, setPreviewOverride] = useState<ClientImportPreview | null>(null);
  const [commitResult, setCommitResult] = useState<ClientImportCommitResult | null>(null);

  const templateQuery = useQuery<ClientImportTemplateField[]>({
    queryKey: ["/api/sales/client-import/template"],
  });
  const previewQuery = useQuery<ClientImportPreview>({
    queryKey: ["/api/sales/client-import/preview"],
  });

  const preview = previewOverride ?? previewQuery.data ?? null;

  const validateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sales/client-import/validate");
      return (await response.json()) as ClientImportPreview;
    },
    onSuccess: (result) => {
      setPreviewOverride(result);
      toast({
        title: "Файл проверен",
        description: "Проверка структуры и дубликатов выполнена в демо-режиме.",
      });
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sales/client-import/commit");
      return (await response.json()) as ClientImportCommitResult;
    },
    onSuccess: (result) => {
      setCommitResult(result);
      toast({
        title: "Импорт завершен",
        description: result.message,
      });
    },
  });

  const requiredFields = useMemo(
    () => (templateQuery.data ?? []).filter((field) => field.required),
    [templateQuery.data],
  );
  const optionalFields = useMemo(
    () => (templateQuery.data ?? []).filter((field) => !field.required),
    [templateQuery.data],
  );

  const isLoading = templateQuery.isLoading || previewQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="page-sales-client-import">
        <Skeleton className="h-14 w-80" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (templateQuery.isError || previewQuery.isError) {
    return (
      <Alert variant="destructive" data-testid="page-sales-client-import">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить данные импорта</AlertTitle>
        <AlertDescription>
          {templateQuery.error instanceof Error
            ? templateQuery.error.message
            : previewQuery.error instanceof Error
              ? previewQuery.error.message
              : "Произошла ошибка получения данных для экрана импорта."}
        </AlertDescription>
      </Alert>
    );
  }

  if (!preview) {
    return (
      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="page-sales-client-import">
        <CardHeader>
          <CardTitle>Нет данных предпросмотра</CardTitle>
          <CardDescription>
            Демо-данные для импорта клиентской базы пока недоступны.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const validationProgress = Math.max(
    0,
    Math.round(
      ((preview.summary.totalRows - preview.summary.errors - preview.summary.duplicates) /
        Math.max(preview.summary.totalRows, 1)) *
        100,
    ),
  );

  return (
    <div className="space-y-6" data-testid="page-sales-client-import">
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Импорт клиентской базы</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Загрузка дилеров из 1С, Битрикс24 и Excel с проверкой дублей, ошибок и
              распределением по ответственным.
            </p>
          </div>
          <Badge className="rounded-full bg-primary/15 text-foreground" variant="secondary">
            MVP
          </Badge>
        </div>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Источники данных</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {preview.sources.map((source) => {
            const Icon = sourceCardIcon(source.source);
            const cardTestId =
              source.source === "one_c"
                ? "card-import-source-1c"
                : source.source === "bitrix24"
                  ? "card-import-source-bitrix24"
                  : "card-import-source-excel";
            return (
              <div
                key={source.id}
                className="rounded-xl border border-border bg-white p-4"
                data-testid={cardTestId}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">{importSourceLabel(source.source)}</p>
                  </div>
                  <Badge variant="outline">{importSourceStatusLabel(source.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{source.description}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Загрузка файла</CardTitle>
          <CardDescription>Поддерживаемые форматы: .xlsx, .csv</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="file"
              accept=".xlsx,.csv"
              data-testid="input-client-import-file"
              onChange={(event) => {
                const fileName = event.target.files?.[0]?.name;
                if (fileName) setSelectedFileName(fileName);
              }}
            />
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              Выбран файл: <span className="font-medium text-foreground">{selectedFileName}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              variant="outline"
              className="h-11 justify-between rounded-xl bg-white"
              data-testid="button-download-client-template"
              onClick={() =>
                toast({
                  title: "Шаблон готов",
                  description: "Демо-шаблон для импорта будет скачиваться в следующем блоке.",
                })
              }
            >
              Скачать шаблон
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-11 justify-between rounded-xl bg-white"
              data-testid="button-validate-client-import"
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
            >
              Проверить файл
              <CheckCircle2 className="h-4 w-4" />
            </Button>
            <Button
              className="h-11 justify-between rounded-xl"
              data-testid="button-check-client-import"
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
            >
              Проверить файл
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-client-import-template-fields"
      >
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Колонки шаблона</CardTitle>
          <CardDescription>Обязательные и желательные поля для единой клиентской базы.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-sm font-semibold">Обязательные поля</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {requiredFields.map((field) => (
                <li key={field.key} className="rounded-lg border border-border/70 bg-muted/20 p-2">
                  <p className="font-medium text-foreground">{field.title}</p>
                  <p>{field.description}</p>
                  <p className="text-xs">Пример: {field.example}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-sm font-semibold">Желательные поля</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {optionalFields.map((field) => (
                <li key={field.key} className="rounded-lg border border-border/70 bg-muted/20 p-2">
                  <p className="font-medium text-foreground">{field.title}</p>
                  <p>{field.description}</p>
                  <p className="text-xs">Пример: {field.example}</p>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-client-import-flow">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Процесс импорта</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            "1. Загрузка файла",
            "2. Проверка структуры",
            "3. Поиск дублей",
            "4. Распределение ответственных",
            "5. Загрузка в единую клиентскую базу",
          ].map((step) => (
            <div key={step} className="rounded-xl border border-border bg-white p-3 text-sm font-medium">
              {step}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-client-import-preview"
      >
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Preview импортируемой базы</CardTitle>
          <CardDescription>
            Предпросмотр построен на demo-данных и показывает ключевые проверки перед загрузкой.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-import-total-rows">
              <p className="text-xs text-muted-foreground">Всего строк</p>
              <p className="mt-1 text-xl font-semibold">{preview.summary.totalRows}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-import-new-dealers">
              <p className="text-xs text-muted-foreground">Новые дилеры</p>
              <p className="mt-1 text-xl font-semibold">{preview.summary.newDealers}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-import-updates">
              <p className="text-xs text-muted-foreground">Обновления</p>
              <p className="mt-1 text-xl font-semibold">{preview.summary.updates}</p>
            </div>
            <div
              className="rounded-xl border border-border bg-white p-3"
              data-testid="metric-import-duplicates"
            >
              <p className="text-xs text-muted-foreground">Найдено дублей</p>
              <p className="mt-1 text-xl font-semibold">{preview.summary.duplicates}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-import-errors">
              <p className="text-xs text-muted-foreground">Ошибки</p>
              <p className="mt-1 text-xl font-semibold">{preview.summary.errors}</p>
            </div>
            <div
              className="rounded-xl border border-border bg-white p-3"
              data-testid="metric-import-unassigned"
            >
              <p className="text-xs text-muted-foreground">Без ответственного</p>
              <p className="mt-1 text-xl font-semibold">{preview.summary.unassigned}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Активные</p>
              <p className="mt-1 text-xl font-semibold">{preview.summary.active}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Потенциальные</p>
              <p className="mt-1 text-xl font-semibold">{preview.summary.potential}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Прогресс валидации</p>
              <Badge variant="outline">{preview.status === "validated" ? "Проверено" : "Черновик"}</Badge>
            </div>
            <Progress value={validationProgress} className="mt-3 h-2 bg-muted" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="table-client-import-preview">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Preview строк импорта</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дилер</TableHead>
                <TableHead>Статус импорта</TableHead>
                <TableHead>Город</TableHead>
                <TableHead>Статус клиента</TableHead>
                <TableHead>Ответственный</TableHead>
                <TableHead>Причина</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row) => (
                <TableRow key={row.id} data-testid={`row-client-import-preview-${row.id}`}>
                  <TableCell className="font-medium">{row.dealerName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={rowStatusClass(row.importStatus)}>
                      {importRowStatusLabel(row.importStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.city}</TableCell>
                  <TableCell>{clientLifecycleStatusLabel(row.clientStatus)}</TableCell>
                  <TableCell>{row.salesManagerName ?? "Не назначен"}</TableCell>
                  <TableCell>{row.errorReason ?? row.duplicateReason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-client-import-issues">
          <CardHeader>
            <CardTitle className="text-lg uppercase tracking-wide">Ошибки и предупреждения</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {preview.issues.map((issue) => (
              <div key={issue.id} className="rounded-xl border border-border bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{issue.message}</p>
                  <Badge variant="outline">{importIssueSeverityLabel(issue.severity)}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {issue.description} · {issue.rowRef}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-client-import-duplicates">
          <CardHeader>
            <CardTitle className="text-lg uppercase tracking-wide">Найденные дубли</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {preview.duplicates.map((duplicate) => (
              <div key={duplicate.id} className="rounded-xl border border-border bg-white p-3 text-sm">
                <p className="font-medium">{duplicate.dealerName}</p>
                <p className="text-muted-foreground">
                  Совпадение: {duplicate.matchedDealerName} · {duplicate.recommendation}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-client-import-assignment"
      >
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Распределение ответственных</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {preview.assignmentGaps.map((gap) => (
            <div key={gap.id} className="rounded-xl border border-border bg-white p-3 text-sm">
              <p className="text-xs text-muted-foreground">{assignmentGapTypeLabel(gap.type)}</p>
              <p className="mt-1 text-xl font-semibold">{gap.count}</p>
              <p className="mt-1 text-xs text-muted-foreground">{gap.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Действия</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            className="h-11 justify-between rounded-xl"
            data-testid="button-commit-client-import"
            onClick={() => commitMutation.mutate()}
            disabled={commitMutation.isPending}
          >
            Загрузить в CRM
            <Upload className="h-4 w-4" />
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-open-dealers">
            <Link href="/dealers">
              Открыть клиентскую базу
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            className="h-11 justify-between rounded-xl bg-white"
            data-testid="button-add-dealer-manually"
            onClick={() =>
              toast({
                title: "Ручное добавление дилера",
                description: "Форма /dealers/new будет реализована следующим MVP-блоком.",
              })
            }
          >
            Добавить дилера вручную
            <ArrowRightCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-11 justify-between rounded-xl bg-white"
            onClick={() => validateMutation.mutate()}
          >
            Проверить файл
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {commitResult && (
        <Card className="rounded-2xl border-border/80 bg-[#f5f5f5] shadow-sm">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium text-foreground">Результат демо-загрузки</p>
            <p className="text-muted-foreground">{commitResult.message}</p>
            <p className="text-muted-foreground">
              Импортировано: {commitResult.importedCount}, обновлено: {commitResult.updatedCount},
              дублей пропущено: {commitResult.skippedDuplicates}, ошибок: {commitResult.failedRows}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
