import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getBitrix24ChatMessages,
  listBitrix24RecentChats,
  sendBitrix24ChatMessage,
  type Bitrix24ChatMessageDto,
  type Bitrix24RecentChatDto,
} from "@/lib/bitrix24-integration";
import { toast } from "@/hooks/use-toast";

const LAST_DIALOG_STORAGE_KEY = "tandoor-communications-last-dialog-v1";

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

export default function CommunicationsPage() {
  const [chats, setChats] = useState<Bitrix24RecentChatDto[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);

  const [selectedDialogId, setSelectedDialogId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Bitrix24ChatMessageDto[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [compose, setCompose] = useState("");
  const [sendBusy, setSendBusy] = useState(false);

  const selectedChat = useMemo(
    () => (selectedDialogId ? chats.find((c) => c.dialogId === selectedDialogId) ?? null : null),
    [chats, selectedDialogId],
  );

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    setChatsError(null);
    const res = await listBitrix24RecentChats();
    setChatsLoading(false);
    if (!res.ok) {
      setChats([]);
      setChatsError(res.message);
      return;
    }
    setChats(res.chats);
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(LAST_DIALOG_STORAGE_KEY)?.trim() : "";
    setSelectedDialogId((prev) => {
      if (prev && res.chats.some((c) => c.dialogId === prev)) return prev;
      if (stored && res.chats.some((c) => c.dialogId === stored)) return stored;
      return null;
    });
  }, []);

  const loadMessages = useCallback(async (dialogId: string) => {
    setMessagesLoading(true);
    setMessagesError(null);
    const res = await getBitrix24ChatMessages(dialogId, 30);
    setMessagesLoading(false);
    if (!res.ok) {
      setMessages([]);
      setMessagesError(res.message);
      return;
    }
    setMessages(res.messages);
  }, []);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!selectedDialogId) {
      setMessages([]);
      setMessagesError(null);
      return;
    }
    void loadMessages(selectedDialogId);
  }, [selectedDialogId, loadMessages]);

  const onSelectChat = useCallback((dialogId: string) => {
    setSelectedDialogId(dialogId);
    try {
      window.localStorage.setItem(LAST_DIALOG_STORAGE_KEY, dialogId);
    } catch {
      /* ignore */
    }
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
    const res = await sendBitrix24ChatMessage(selectedDialogId, text);
    setSendBusy(false);
    if (!res.ok) {
      toast({ title: res.message, variant: "destructive" });
      return;
    }
    setCompose("");
    await loadMessages(selectedDialogId);
    toast({ title: "Сообщение отправлено" });
  }, [compose, selectedDialogId, loadMessages]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6" data-testid="page-communications">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Коммуникации</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Чаты и сообщения Bitrix24 внутри ЛК Тандор. Данные приходят напрямую из портала Bitrix24 через серверную
          интеграцию (без отдельной базы сообщений в браузере).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
        <Card className="min-w-0 border-border/80 shadow-sm" data-testid="section-communications-chat-list">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Чаты Bitrix24</CardTitle>
                <CardDescription className="text-xs">Последние диалоги (im.recent.get)</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={chatsLoading}
                onClick={() => void loadChats()}
                data-testid="button-communications-refresh-chats"
              >
                Обновить
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {chatsLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
            {chatsError ? (
              <p className="text-sm text-destructive" role="alert">
                {chatsError}
              </p>
            ) : null}
            {!chatsLoading && !chatsError && chats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет чатов для отображения. Нажмите «Обновить».</p>
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
                        active
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/70 bg-card hover:bg-muted/60",
                      )}
                      data-testid={`row-communications-chat-${slug}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className="min-w-0 flex-1 truncate font-medium text-foreground"
                          data-testid={`text-communications-chat-title-${slug}`}
                        >
                          {c.title}
                        </span>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          {typeof c.counter === "number" && c.counter > 0 ? (
                            <Badge
                              variant="secondary"
                              className="h-6 min-w-6 rounded-md px-1.5 text-xs tabular-nums"
                              data-testid={`badge-communications-chat-counter-${slug}`}
                            >
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

        <Card className="min-w-0 border-border/80 shadow-sm" data-testid="section-communications-chat-messages">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base">
                  {selectedChat ? selectedChat.title : "Выберите чат"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedDialogId ? (
                    <>
                      Сообщения из Bitrix24 (im.dialog.messages.get), диалог{" "}
                      <span className="font-mono text-[11px]">{selectedDialogId}</span>
                    </>
                  ) : (
                    "Сначала выберите чат слева"
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
                data-testid="button-communications-refresh-messages"
              >
                Обновить сообщения
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {!selectedDialogId ? (
              <p className="text-sm text-muted-foreground">Выберите чат в списке слева.</p>
            ) : null}
            {messagesLoading ? <p className="text-sm text-muted-foreground">Загрузка сообщений…</p> : null}
            {messagesError ? (
              <p className="text-sm text-destructive" role="alert">
                {messagesError}
              </p>
            ) : null}
            {selectedDialogId && !messagesLoading && !messagesError && messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">В этом чате пока нет сообщений в выборке.</p>
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
                placeholder="Текст сообщения для Bitrix24…"
                rows={3}
                disabled={!selectedDialogId || sendBusy}
                className="min-h-[88px] resize-y text-sm"
                data-testid="textarea-communications-message"
              />
              <Button
                type="button"
                disabled={!selectedDialogId || sendBusy || !compose.trim().length}
                onClick={() => void onSend()}
                data-testid="button-communications-send-message"
              >
                Отправить
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
