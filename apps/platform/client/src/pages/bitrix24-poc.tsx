import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { ExternalLink, ListChecks, Map, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getCatalogDealerRows } from "@/lib/dealer-base-source";
import { buildHashPath } from "@/lib/hash-route-utils";
import {
  buildBitrix24OpenTandoorUrl,
  createBitrix24TaskDraft,
  getBitrix24ContextFromUrl,
  listBitrix24Users,
  type Bitrix24ChatDiagnosticRowDto,
  type Bitrix24ListedUserDto,
  runBitrix24ChatDiagnostics,
  useBitrix24EmbeddedFlag,
} from "@/lib/bitrix24-integration";
import { getBitrix24UserIdForSalesUserId } from "@/lib/bitrix24-user-mapping";
import { releaseDemoRoleLabel } from "@/lib/release-demo-profile";
import { SALES_USERS } from "@/lib/sales-control-data";

function withEmbedded(path: string): string {
  return buildHashPath(path, { embedded: "bitrix24" });
}

function bitrixChatMethodSlug(method: string): string {
  return method.replace(/\./g, "-");
}

export default function Bitrix24PocPage() {
  const embedded = useBitrix24EmbeddedFlag();
  const ctx = getBitrix24ContextFromUrl();
  const [taskHint, setTaskHint] = useState<string | null>(null);
  const [taskBusy, setTaskBusy] = useState(false);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRows, setUsersRows] = useState<Bitrix24ListedUserDto[]>([]);
  const [usersBusy, setUsersBusy] = useState(false);
  const [usersHint, setUsersHint] = useState<string | null>(null);
  const [chatDialogId, setChatDialogId] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatTestNotify, setChatTestNotify] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatHint, setChatHint] = useState<string | null>(null);
  const [chatDiagnostics, setChatDiagnostics] = useState<Bitrix24ChatDiagnosticRowDto[]>([]);

  const sampleDealerId = getCatalogDealerRows()[0]?.id ?? "001";

  const onCreateTestTask = useCallback(async () => {
    setTaskBusy(true);
    setTaskHint(null);
    try {
      const res = await createBitrix24TaskDraft({
        title: "Тестовая задача из Тандор (POC Bitrix24)",
        description: "Черновик без отправки в Bitrix24.",
      });
      if (res.ok) {
        const lines = [res.message];
        if (res.taskId != null && String(res.taskId).length > 0) {
          lines.push(`ID задачи в Bitrix24: ${res.taskId}`);
        }
        setTaskHint(lines.join("\n"));
      } else {
        setTaskHint(res.message);
      }
    } finally {
      setTaskBusy(false);
    }
  }, []);

  const onLoadBitrix24Users = useCallback(async () => {
    setUsersBusy(true);
    setUsersHint(null);
    try {
      const res = await listBitrix24Users({
        search: usersSearch.trim() || undefined,
        limit: 50,
      });
      if (res.ok) {
        setUsersRows(res.users);
        setUsersHint(res.users.length ? null : "Список пуст. Измените поиск или проверьте права user.get.");
      } else {
        setUsersRows([]);
        setUsersHint(res.message);
      }
    } finally {
      setUsersBusy(false);
    }
  }, [usersSearch]);

  const onRunChatDiagnostics = useCallback(async () => {
    setChatBusy(true);
    setChatHint(null);
    setChatDiagnostics([]);
    try {
      const res = await runBitrix24ChatDiagnostics({
        dialogId: chatDialogId.trim() || undefined,
        message: chatMessage.trim() || undefined,
        testNotify: chatTestNotify,
      });
      if (res.ok) {
        setChatDiagnostics(res.diagnostics);
        setChatHint(null);
      } else {
        setChatHint(res.message);
      }
    } finally {
      setChatBusy(false);
    }
  }, [chatDialogId, chatMessage, chatTestNotify]);

  const openFullAppUrl = useMemo(() => buildBitrix24OpenTandoorUrl("/dealer-base"), []);

  const lkBitrixMappingRows = useMemo(() => {
    return SALES_USERS.map((u) => {
      const bitrixUserId = getBitrix24UserIdForSalesUserId(u.id);
      const bx = bitrixUserId ? usersRows.find((r) => r.bitrixUserId === bitrixUserId) : undefined;
      const bitrixFio =
        (bx?.fullName && bx.fullName.trim()) ||
        [bx?.name, bx?.lastName].filter(Boolean).join(" ").trim() ||
        null;
      const mapped = bitrixUserId != null;
      return { user: u, bitrixUserId, bitrixFio, mapped };
    });
  }, [usersRows]);

  return (
    <div
      className={cn("mx-auto w-full max-w-2xl space-y-5", embedded && "max-w-full sm:max-w-2xl")}
      data-testid="page-bitrix24-poc"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Тандор в Bitrix24</p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Рабочее место Тандор</h1>
        <p className="text-sm text-muted-foreground">POC интеграции Bitrix24</p>
        {ctx.portalDomain ? (
          <p className="text-xs text-muted-foreground">
            Обнаружен параметр портала в URL: <span className="font-mono text-foreground">{ctx.portalDomain}</span>
          </p>
        ) : null}
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-base">Быстрые переходы</CardTitle>
          <CardDescription className="text-xs">Разделы демо-ЛК (сохраняется режим встраивания при наличии маркера в URL).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild variant="default" className="min-h-10 w-full justify-start gap-2 sm:w-auto sm:min-w-[12rem]">
            <Link href={withEmbedded("/dealer-base")}>
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              Открыть клиентскую базу
            </Link>
          </Button>
          <Button asChild variant="secondary" className="min-h-10 w-full justify-start gap-2 sm:w-auto sm:min-w-[12rem]">
            <Link href={withEmbedded("/tasks")}>
              <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
              Открыть задачи
            </Link>
          </Button>
          <Button asChild variant="secondary" className="min-h-10 w-full justify-start gap-2 sm:w-auto sm:min-w-[12rem]">
            <Link href={withEmbedded("/dealer-base")}>
              <Map className="h-4 w-4 shrink-0" aria-hidden />
              Открыть маршруты
            </Link>
          </Button>
          <Button asChild variant="secondary" className="min-h-10 w-full justify-start gap-2 sm:w-auto sm:min-w-[12rem]">
            <Link href={withEmbedded("/analytics")}>
              <Target className="h-4 w-4 shrink-0" aria-hidden />
              Открыть KPI
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed border-amber-300/80 bg-amber-50/40 shadow-sm dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Тестовый клиент</CardTitle>
          <CardDescription className="text-xs">Переход в карточку первого клиента из демо-базы.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="min-h-10 w-full font-semibold sm:w-auto">
            <Link href={withEmbedded(`/dealers/${sampleDealerId}`)}>Открыть тестового клиента</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base">Создание задачи в Bitrix24</CardTitle>
          <CardDescription className="text-xs">
            Запрос уходит на сервер Тандор; webhook хранится только в переменных окружения (например, на Vercel).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-10 w-full font-semibold sm:w-auto"
            disabled={taskBusy}
            data-testid="button-bitrix24-create-task"
            onClick={() => void onCreateTestTask()}
          >
            {taskBusy ? "Создание…" : "Создать тестовую задачу в Bitrix24"}
          </Button>
          {taskHint ? (
            <p
              className="whitespace-pre-line rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground"
              role="status"
            >
              {taskHint}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Ссылка для вставки в Bitrix24 (полный URL с маркером встраивания):{" "}
            <a
              className="inline-flex items-center gap-1 break-all font-mono text-[11px] text-primary underline-offset-2 hover:underline"
              href={openFullAppUrl}
              target="_blank"
              rel="noreferrer"
            >
              {openFullAppUrl}
              <ExternalLink className="inline h-3 w-3 shrink-0" aria-hidden />
            </a>
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm" data-testid="section-bitrix24-users">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base">Пользователи Bitrix24</CardTitle>
          <CardDescription className="text-xs">
            Диагностика: список userId сотрудников для сопоставления с пользователями Тандор. Запрос выполняется на сервере (webhook не показывается).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="bitrix24-users-search">
                Поиск по имени, фамилии или email
              </label>
              <Input
                id="bitrix24-users-search"
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
                placeholder="Например, Иван или @company.ru"
                className="min-h-10"
                data-testid="input-bitrix24-users-search"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-10 w-full shrink-0 font-semibold sm:w-auto"
              disabled={usersBusy}
              data-testid="button-bitrix24-users-load"
              onClick={() => void onLoadBitrix24Users()}
            >
              {usersBusy ? "Загрузка…" : "Загрузить пользователей"}
            </Button>
          </div>
          {usersHint ? (
            <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground" role="status">
              {usersHint}
            </p>
          ) : null}
          {usersRows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Имя</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {usersRows.map((u) => (
                    <tr
                      key={u.bitrixUserId}
                      className="border-b border-border/60 last:border-0"
                      data-testid={`row-bitrix24-user-${u.bitrixUserId}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs" data-testid={`text-bitrix24-user-id-${u.bitrixUserId}`}>
                        {u.bitrixUserId}
                      </td>
                      <td className="px-3 py-2" data-testid={`text-bitrix24-user-name-${u.bitrixUserId}`}>
                        {u.fullName || `${u.name} ${u.lastName}`.trim() || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground" data-testid={`text-bitrix24-user-email-${u.bitrixUserId}`}>
                        {u.email ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm" data-testid="section-bitrix24-user-mapping">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base">Связка пользователей ЛК и Bitrix24</CardTitle>
          <CardDescription className="text-xs">
            Статический маппинг в клиенте (MVP). Колонка «ФИО Bitrix24» заполняется, если выше загружен список
            пользователей портала и ID совпадает с маппингом.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Пользователь ЛК</th>
                  <th className="px-3 py-2 font-medium">Роль</th>
                  <th className="px-3 py-2 font-medium">bitrixUserId</th>
                  <th className="px-3 py-2 font-medium">ФИО Bitrix24</th>
                  <th className="px-3 py-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {lkBitrixMappingRows.map((row) => (
                  <tr
                    key={row.user.id}
                    className="border-b border-border/60 last:border-0"
                    data-testid={`row-bitrix24-user-mapping-${row.user.id}`}
                  >
                    <td className="px-3 py-2">{row.user.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{releaseDemoRoleLabel(row.user.role)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.bitrixUserId ?? "—"}</td>
                    <td className="px-3 py-2">{row.bitrixFio ?? "—"}</td>
                    <td className="px-3 py-2">{row.mapped ? "найден" : "не найден"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm" data-testid="section-bitrix24-chat-diagnostics">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base">Диагностика чатов Bitrix24</CardTitle>
          <CardDescription className="text-xs">
            Проверка REST im.* через сервер (webhook не отображается). Не production-чат: только снимок доступности методов для текущего webhook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bitrix24-chat-dialog-id" className="text-xs font-medium text-muted-foreground">
              DIALOG_ID (опционально)
            </Label>
            <Input
              id="bitrix24-chat-dialog-id"
              value={chatDialogId}
              onChange={(e) => setChatDialogId(e.target.value)}
              placeholder="Например chat123 или user2"
              className="min-h-10 font-mono text-sm"
              data-testid="input-bitrix24-chat-dialog-id"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bitrix24-chat-message" className="text-xs font-medium text-muted-foreground">
              Текст сообщения (опционально; вместе с DIALOG_ID вызывает im.message.add)
            </Label>
            <Textarea
              id="bitrix24-chat-message"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Короткий тестовый текст"
              className="min-h-[88px] text-sm"
              data-testid="textarea-bitrix24-chat-message"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="bitrix24-chat-test-notify"
              checked={chatTestNotify}
              onCheckedChange={(v) => setChatTestNotify(v === true)}
              data-testid="checkbox-bitrix24-chat-test-notify"
            />
            <Label htmlFor="bitrix24-chat-test-notify" className="cursor-pointer text-sm font-normal">
              Отправить тестовое уведомление себе (im.notify.personal.add)
            </Label>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="min-h-10 w-full font-semibold sm:w-auto"
            disabled={chatBusy}
            data-testid="button-bitrix24-chat-diagnostics-run"
            onClick={() => void onRunChatDiagnostics()}
          >
            {chatBusy ? "Проверка…" : "Проверить чаты Bitrix24"}
          </Button>
          {chatHint ? (
            <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground" role="status">
              {chatHint}
            </p>
          ) : null}
          {chatDiagnostics.length > 0 ? (
            <div className="space-y-3">
              {chatDiagnostics.map((row) => {
                const slug = bitrixChatMethodSlug(row.method);
                return (
                  <div
                    key={row.method}
                    className="rounded-lg border border-border/70 bg-muted/20 p-3"
                    data-testid={`row-bitrix24-chat-diagnostic-${slug}`}
                  >
                    <p className="text-sm font-semibold text-foreground">{row.method}</p>
                    <p
                      className="mt-1 text-xs text-muted-foreground"
                      data-testid={`text-bitrix24-chat-diagnostic-status-${slug}`}
                    >
                      {row.success ? "Успех" : "Ошибка"}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground" data-testid={`text-bitrix24-chat-diagnostic-code-${slug}`}>
                      {row.bitrixCode ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-foreground">{row.message}</p>
                    {row.sample !== undefined ? (
                      <pre className="mt-2 max-h-48 overflow-auto rounded border border-border/60 bg-card p-2 text-[11px] leading-snug">
                        {JSON.stringify(row.sample, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
