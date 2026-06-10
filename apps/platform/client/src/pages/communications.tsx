import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useLocation } from "wouter";
import { Info } from "lucide-react";
import { BackNav } from "@/components/navigation/back-nav";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  disconnectBitrix24OAuth,
  getBitrix24OAuthStatus,
  getBitrix24PersonalMessages,
  listBitrix24PersonalChats,
  sendBitrix24PersonalMessage,
  startBitrix24OAuth,
  type Bitrix24ChatMessageDto,
  type Bitrix24OAuthStatusDto,
  type Bitrix24RecentChatDto,
} from "@/lib/bitrix24-integration";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

const LAST_DIALOG_SESSION_KEY = "tandoor-communications-last-dialog-v1";

function CommunicationsPageShell({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6" data-testid="page-communications">
      <BackNav breadcrumbs={breadcrumbsFor("/communications")} fallbackHref="/main" />
      {children}
    </div>
  );
}

type UiMode = "loading" | "error" | "not_configured" | "not_connected" | "connected";

function testIdSlug(id: string | number): string {
  const s = String(id);
  const slug = s.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+/g, "_");
  return slug.length > 80 ? slug.slice(0, 80) : slug;
}

function formatRuDateTime(raw: string | undefined): string {
  if (!raw || !raw.trim()) return "";
  const d = Date.parse(raw);
  if (!Number.isFinite(d)) return raw.trim();
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(d));
  } catch {
    return raw.trim();
  }
}

/** Понятный текст для query после OAuth callback (без секретов). */
function describeBitrixOAuthReturnError(appCode: string, bitrixCode: string): string {
  const bx = bitrixCode.trim();
  const c = appCode.trim();
  switch (c) {
    case "BITRIX24_OAUTH_STATE_MISMATCH":
      return "Сессия подключения устарела или открыт не тот браузер. Нажмите «Подключить Bitrix24» в личном кабинете ещё раз.";
    case "BITRIX24_OAUTH_TOKEN_ERROR":
      return bx
        ? `Bitrix24 не принял обмен кода авторизации (${bx}). Проверьте redirect URI и настройки локального приложения, затем подключите снова.`
        : "Bitrix24 не принял обмен кода авторизации. Проверьте настройки OAuth-приложения и подключите снова.";
    case "BITRIX24_OAUTH_COOKIE_ERROR":
      return "На сервере не удалось сохранить сессию (cookie). Проверьте BITRIX24_OAUTH_COOKIE_SECRET и лимиты размера cookie.";
    case "BITRIX24_OAUTH_NETWORK":
      return "Нет связи с сервером авторизации Bitrix24. Повторите позже.";
    case "BITRIX24_OAUTH_MISSING_CODE":
      return "Bitrix24 не вернул код авторизации. Попробуйте подключить снова.";
    case "BITRIX24_OAUTH_AUTHORIZATION_DENIED":
      return "Вход в Bitrix24 был отклонён. Подключите снова и подтвердите доступ.";
    case "BITRIX24_OAUTH_NOT_CONFIGURED":
      return "OAuth Bitrix24 не настроен на сервере.";
    case "BITRIX24_OAUTH_CALLBACK_FAILED":
      return "Неизвестная ошибка сервера при подключении Bitrix24. Смотрите логи функции oauth/callback (строка oauth.callback:unexpected).";
    default:
      return c ? `${c}${bx ? ` (${bx})` : ""}` : "Не удалось подключить Bitrix24. Попробуйте ещё раз.";
  }
}

export default function CommunicationsPage() {
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  const [uiMode, setUiMode] = useState<UiMode>("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const [oauthSnapshot, setOauthSnapshot] = useState<Bitrix24OAuthStatusDto | null>(null);

  const [chats, setChats] = useState<Bitrix24RecentChatDto[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);

  const [selectedDialogId, setSelectedDialogId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Bitrix24ChatMessageDto[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [compose, setCompose] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);

  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const didAutoOpenMobileThreadRef = useRef(false);

  const selectedChat = useMemo(
    () => (selectedDialogId ? chats.find((c) => c.dialogId === selectedDialogId) ?? null : null),
    [chats, selectedDialogId],
  );

  const loadOAuth = useCallback(async () => {
    setUiMode("loading");
    setPageError(null);
    const res = await getBitrix24OAuthStatus();
    if (!res.ok) {
      setOauthSnapshot(null);
      setPageError(res.message);
      setUiMode("error");
      return;
    }
    setOauthSnapshot(res.data);
    if (!res.data.configured) {
      setUiMode("not_configured");
      return;
    }
    if (!res.data.connected) {
      setUiMode("not_connected");
      return;
    }
    setUiMode("connected");
  }, []);

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    setChatsError(null);
    const res = await listBitrix24PersonalChats();
    setChatsLoading(false);
    if (!res.ok) {
      setChats([]);
      setChatsError(res.message);
      if (res.code === "BITRIX24_OAUTH_NOT_CONNECTED" || res.code === "BITRIX24_OAUTH_EXPIRED") {
        setUiMode("not_connected");
        setOauthSnapshot((prev) => (prev ? { ...prev, connected: false } : prev));
      }
      return;
    }
    setChats(res.chats);
    const stored =
      typeof window !== "undefined" ? window.sessionStorage.getItem(LAST_DIALOG_SESSION_KEY)?.trim() : "";
    setSelectedDialogId((prev) => {
      if (prev && res.chats.some((c) => c.dialogId === prev)) return prev;
      if (stored && res.chats.some((c) => c.dialogId === stored)) return stored;
      return null;
    });
  }, []);

  const loadMessages = useCallback(async (dialogId: string) => {
    setMessagesLoading(true);
    setMessagesError(null);
    const res = await getBitrix24PersonalMessages(dialogId, 30);
    setMessagesLoading(false);
    if (!res.ok) {
      setMessages([]);
      setMessagesError(res.message);
      if (res.code === "BITRIX24_OAUTH_NOT_CONNECTED" || res.code === "BITRIX24_OAUTH_EXPIRED") {
        setUiMode("not_connected");
        setOauthSnapshot((prev) => (prev ? { ...prev, connected: false } : prev));
      }
      return;
    }
    setMessages(res.messages);
  }, []);

  const didProcessOAuthReturnRef = useRef(false);

  useEffect(() => {
    void loadOAuth();
  }, [loadOAuth]);

  useEffect(() => {
    if (typeof window === "undefined" || didProcessOAuthReturnRef.current) return;

    // Callback использует route-safe формат `/?bitrix24=...&...#/communications`,
    // поэтому параметры лежат в `window.location.search`. На случай, если кто-то
    // ещё в пути с устаревшим форматом `/#/communications?...`, читаем и query из hash.
    const searchParams = new URLSearchParams(window.location.search);
    let source: "search" | "hash" | null = searchParams.get("bitrix24") ? "search" : null;
    let sp = searchParams;
    if (!source) {
      const h = window.location.hash;
      const q = h.indexOf("?");
      if (q >= 0) {
        const hp = new URLSearchParams(h.slice(q + 1));
        if (hp.get("bitrix24")) {
          sp = hp;
          source = "hash";
        }
      }
    }
    if (!source) return;

    const flag = sp.get("bitrix24");
    if (flag !== "connected" && flag !== "error") return;
    didProcessOAuthReturnRef.current = true;

    if (flag === "connected") {
      toast({ title: "Bitrix24 успешно подключён" });
    } else {
      const code = sp.get("code") || "";
      const bitrixCode = sp.get("bitrixCode") || "";
      const description = describeBitrixOAuthReturnError(code, bitrixCode);
      toast({
        title: "Не удалось подключить Bitrix24",
        description,
        variant: "destructive",
      });
    }

    // Чистим URL: убираем search-параметры/устаревшие hash-параметры, оставляя только `#/communications`.
    try {
      window.history.replaceState(null, "", `${window.location.pathname}#/communications`);
    } catch {
      /* ignore — навигация ниже всё равно приведёт на нужный маршрут */
    }
    navigate("/communications");
    void loadOAuth();
  }, [navigate, loadOAuth]);

  useEffect(() => {
    if (uiMode !== "connected") return;
    void loadChats();
  }, [uiMode, loadChats]);

  useEffect(() => {
    if (!selectedDialogId) {
      setMessages([]);
      setMessagesError(null);
      return;
    }
    void loadMessages(selectedDialogId);
  }, [selectedDialogId, loadMessages]);

  useEffect(() => {
    if (!isMobile) {
      setMobileThreadOpen(false);
      return;
    }
    if (didAutoOpenMobileThreadRef.current) return;
    if (chatsLoading) return;
    if (!selectedDialogId || !chats.some((c) => c.dialogId === selectedDialogId)) return;
    didAutoOpenMobileThreadRef.current = true;
    setMobileThreadOpen(true);
  }, [isMobile, selectedDialogId, chats, chatsLoading]);

  const onSelectChat = useCallback(
    (dialogId: string) => {
      setSelectedDialogId(dialogId);
      try {
        window.sessionStorage.setItem(LAST_DIALOG_SESSION_KEY, dialogId);
      } catch {
        /* ignore */
      }
      if (isMobile) setMobileThreadOpen(true);
    },
    [isMobile],
  );

  const onBackToChats = useCallback(() => {
    setMobileThreadOpen(false);
  }, []);

  const onConnect = useCallback(async () => {
    setConnectBusy(true);
    const res = await startBitrix24OAuth();
    setConnectBusy(false);
    if (!res.ok) {
      toast({ title: res.message, variant: "destructive" });
      return;
    }
    window.location.assign(res.redirectUrl);
  }, []);

  const onReconnect = useCallback(() => void onConnect(), [onConnect]);

  const onDisconnect = useCallback(async () => {
    const res = await disconnectBitrix24OAuth();
    if (!res.ok) {
      toast({ title: res.message, variant: "destructive" });
      return;
    }
    toast({ title: "Bitrix24 отключён в этом браузере" });
    setOauthSnapshot((prev) => (prev ? { ...prev, connected: false, user: undefined } : prev));
    setUiMode("not_connected");
    setChats([]);
    setSelectedDialogId(null);
    setMessages([]);
  }, []);

  const onSend = useCallback(async () => {
    if (!selectedDialogId) return;
    const text = compose.trim();
    if (!text.length) {
      toast({ title: "Введите текст сообщения", variant: "destructive" });
      return;
    }
    if (text.length > 2000) {
      toast({ title: "Сообщение слишком длинное (максимум 2000 символов)", variant: "destructive" });
      return;
    }
    setSendBusy(true);
    const res = await sendBitrix24PersonalMessage(selectedDialogId, text);
    setSendBusy(false);
    if (!res.ok) {
      toast({ title: res.message, variant: "destructive" });
      if (res.code === "BITRIX24_OAUTH_NOT_CONNECTED" || res.code === "BITRIX24_OAUTH_EXPIRED") {
        setUiMode("not_connected");
        setOauthSnapshot((prev) => (prev ? { ...prev, connected: false } : prev));
      }
      return;
    }
    setCompose("");
    await loadMessages(selectedDialogId);
    toast({ title: "Сообщение отправлено" });
  }, [compose, selectedDialogId, loadMessages]);

  const hideChatListOnMobile = isMobile && mobileThreadOpen;
  const hideMessagesOnMobile = isMobile && !mobileThreadOpen;
  const emptyMessagesHint = isMobile ? "Выберите чат в списке." : "Выберите чат в списке слева.";

  if (uiMode === "loading") {
    return (
      <CommunicationsPageShell>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Коммуникации</h1>
          <p className="mt-1 text-sm text-muted-foreground">Загрузка…</p>
        </div>
      </CommunicationsPageShell>
    );
  }

  if (uiMode === "error") {
    return (
      <CommunicationsPageShell>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Коммуникации</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bitrix24</p>
        </div>
        <Alert variant="destructive">
          <Info className="h-4 w-4" aria-hidden />
          <AlertDescription data-testid="text-communications-error">{pageError ?? "Произошла ошибка."}</AlertDescription>
        </Alert>
      </CommunicationsPageShell>
    );
  }

  if (uiMode === "not_configured") {
    return (
      <CommunicationsPageShell>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Коммуникации</h1>
          <p className="mt-1 text-sm text-muted-foreground">Личные чаты и сообщения Bitrix24.</p>
        </div>
        <Alert>
          <Info className="h-4 w-4" aria-hidden />
          <AlertDescription data-testid="text-communications-error">
            OAuth Bitrix24 не настроен на сервере. Администратору нужно задать переменные окружения BITRIX24_OAUTH_CLIENT_ID,
            BITRIX24_OAUTH_CLIENT_SECRET и BITRIX24_PORTAL_DOMAIN.
          </AlertDescription>
        </Alert>
      </CommunicationsPageShell>
    );
  }

  if (uiMode === "not_connected") {
    return (
      <CommunicationsPageShell>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Коммуникации</h1>
          <p className="mt-1 text-sm text-muted-foreground">Личные чаты только после персонального подключения Bitrix24.</p>
        </div>

        <Card data-testid="section-communications-connect" className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Подключите Bitrix24</CardTitle>
            <CardDescription>
              Чтобы видеть личные чаты и сообщения, нужно подключить ваш личный аккаунт Bitrix24. Общий webhook для этого не
              используется.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthSnapshot?.serverHint ? (
              <Alert variant="destructive">
                <Info className="h-4 w-4" aria-hidden />
                <AlertDescription>{oauthSnapshot.serverHint}</AlertDescription>
              </Alert>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Если сессия истекла или вы сменили пароль Bitrix24, подключите аккаунт заново.
            </p>
            <Button
              type="button"
              onClick={() => void onConnect()}
              disabled={connectBusy}
              data-testid="button-communications-connect-bitrix24"
            >
              Подключить Bitrix24
            </Button>
            <p className="text-sm text-muted-foreground" data-testid="text-communications-connect-status">
              OAuth Bitrix24 будет доступен после настройки client_id/client_secret.
            </p>
          </CardContent>
        </Card>
      </CommunicationsPageShell>
    );
  }

  // --- connected ---
  return (
    <CommunicationsPageShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Коммуникации</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ваши диалоги Bitrix24 (персональный доступ). Данные не запрашиваются через общий webhook.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <p className="text-sm text-muted-foreground" data-testid="text-communications-oauth-connected-user">
          {oauthSnapshot?.user?.name || oauthSnapshot?.user?.bitrixUserId
            ? `Подключено: ${[oauthSnapshot?.user?.name, oauthSnapshot?.user?.bitrixUserId ? `ID ${oauthSnapshot.user.bitrixUserId}` : ""].filter(Boolean).join(" · ")}`
            : "Bitrix24 подключён"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={connectBusy}
          onClick={() => void onReconnect()}
          data-testid="button-communications-reconnect-bitrix24"
        >
          Подключить заново
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onDisconnect()}
          data-testid="button-communications-disconnect-bitrix24"
        >
          Отключить Bitrix24
        </Button>
      </div>

      {(chatsError && uiMode === "connected") ? (
        <Alert variant="destructive">
          <Info className="h-4 w-4" aria-hidden />
          <AlertDescription data-testid="text-communications-error">{chatsError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
        <Card
          className={cn("min-w-0 border-border/80 shadow-sm", hideChatListOnMobile && "hidden md:block")}
          data-testid="section-communications-dialogs"
        >
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Диалоги</CardTitle>
                <CardDescription className="text-xs">Последние диалоги из Bitrix24</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={chatsLoading}
                onClick={() => void loadChats()}
              >
                Обновить
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {chatsLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
            {!chatsLoading && !chatsError && chats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет диалогов для отображения.</p>
            ) : null}
            <ul className="max-h-[min(70vh,520px)] space-y-1 overflow-y-auto overflow-x-hidden pr-1">
              {chats.map((c) => {
                const slug = testIdSlug(c.dialogId);
                const active = c.dialogId === selectedDialogId;
                const isTask = c.entityType === "TASKS_TASK" && Boolean(c.entityId?.trim());
                return (
                  <li key={c.dialogId}>
                    <button
                      type="button"
                      onClick={() => onSelectChat(c.dialogId)}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        active ? "border-primary/60 bg-primary/10" : "border-border/70 bg-card hover:bg-muted/60",
                      )}
                      data-testid={`card-communications-dialog-${slug}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{c.title}</span>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          {typeof c.counter === "number" && c.counter > 0 ? (
                            <Badge variant="secondary" className="h-6 min-w-6 rounded-md px-1.5 text-xs tabular-nums">
                              {c.counter}
                            </Badge>
                          ) : null}
                          {isTask ? (
                            <Badge variant="outline" className="h-6 text-[10px] font-normal">
                              Задача
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {c.lastMessageText ? (
                        <p className="line-clamp-2 break-words text-xs text-muted-foreground">{c.lastMessageText}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                        {c.lastMessageDate ? <span>{formatRuDateTime(c.lastMessageDate)}</span> : null}
                        {isTask && c.entityId ? (
                          <span className="truncate text-foreground/80">Задача Bitrix24: {c.entityId}</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card
          className={cn("min-w-0 border-border/80 shadow-sm", hideMessagesOnMobile && "hidden md:block")}
          data-testid="section-communications-messages"
        >
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start gap-2">
              {isMobile && mobileThreadOpen && selectedDialogId ? (
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onBackToChats}>
                  Назад к чатам
                </Button>
              ) : null}
              <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">{selectedChat ? selectedChat.title : "Выберите диалог"}</CardTitle>
                  <CardDescription className="text-xs">
                    {selectedDialogId ? (
                      <>
                        Сообщения, диалог <span className="font-mono text-[11px]">{selectedDialogId}</span>
                      </>
                    ) : (
                      emptyMessagesHint
                    )}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={!selectedDialogId || messagesLoading}
                  onClick={() => selectedDialogId && void loadMessages(selectedDialogId)}
                >
                  Обновить сообщения
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {!selectedDialogId ? (
              <p className="text-sm text-muted-foreground">{emptyMessagesHint}</p>
            ) : null}
            {messagesLoading ? <p className="text-sm text-muted-foreground">Загрузка сообщений…</p> : null}
            {messagesError ? (
              <p className="text-sm text-destructive" role="alert" data-testid="text-communications-error">
                {messagesError}
              </p>
            ) : null}
            {selectedDialogId && !messagesLoading && !messagesError && messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">В этом диалоге пока нет сообщений в выборке.</p>
            ) : null}

            <ul className="max-h-[min(50vh,360px)] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
              {messages.map((m) => {
                const mid = testIdSlug(m.id);
                return (
                  <li
                    key={String(m.id)}
                    className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                    data-testid={`row-communications-message-${mid}`}
                  >
                    <p className="whitespace-pre-wrap break-words text-foreground">{m.text}</p>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                      {m.date ? <span>{formatRuDateTime(m.date)}</span> : null}
                      {m.authorId != null ? <span className="font-mono">authorId: {m.authorId}</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-2 border-t border-border/60 pt-3">
              <Textarea
                value={compose}
                onChange={(e) => setCompose(e.target.value)}
                placeholder="Текст сообщения…"
                rows={3}
                disabled={!selectedDialogId || sendBusy}
                className="min-h-[88px] resize-y text-sm"
                data-testid="input-communications-message"
              />
              <Button
                type="button"
                disabled={!selectedDialogId || sendBusy || !compose.trim().length}
                onClick={() => void onSend()}
                data-testid="button-communications-send"
              >
                Отправить
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </CommunicationsPageShell>
  );
}
