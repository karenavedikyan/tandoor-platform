# Telegram recovery bot для администраторов

Аварийный канал восстановления пароля администратора через бота в Telegram. На сайте отдельного интерфейса нет.

## Переменные окружения (Vercel / production)

| Переменная | Назначение |
|------------|------------|
| `TG_RECOVERY_SECRET` | Длинная случайная строка. Должна совпадать с секретом, который проверяет backend (см. ниже про заголовки). |
| `TG_RECOVERY_WHITELIST` | Список разрешённых числовых Telegram user-id через запятую, например `111,222,333`. |
| `TG_BOT_TOKEN` | Токен бота от BotFather, для вызова `sendMessage`. |
| `PUBLIC_APP_URL` | Необязательно. Базовый URL приложения (с протоколом или без), например `https://tandoor-platform.vercel.app`. Если не задан, хост берётся из заголовков запроса (`x-forwarded-host` или `host`). |

## Шаг 1. Создать бота в BotFather

1. В Telegram откройте [@BotFather](https://t.me/BotFather).
2. Создайте бота и сохраните выданный токен в `TG_BOT_TOKEN`.

## Шаг 2. Настроить webhook

Webhook указывает на существующий admin-endpoint (без новых serverless-функций):

`POST https://<ваш-домен>/api/admin/admin-recovery`

Пример установки webhook с секретом (Telegram передаст его в заголовке `X-Telegram-Bot-Api-Secret-Token`):

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://tandoor-platform.vercel.app/api/admin/admin-recovery" \
  -d "secret_token=<TG_RECOVERY_SECRET>"
```

Рекомендуется задать `secret_token` равным значению `TG_RECOVERY_SECRET` в Vercel, чтобы не хранить два разных секрета.

### Авторизация запросов

- Клиентский код может отправлять заголовок `X-Recovery-Secret` (например при ручном smoke-тесте).
- Telegram при `setWebhook` с `secret_token` добавляет заголовок `X-Telegram-Bot-Api-Secret-Token`.
- Сервер принимает оба варианта: сначала проверяется `X-Recovery-Secret`, при отсутствии — `X-Telegram-Bot-Api-Secret-Token`. Значение должно в точности совпадать с `TG_RECOVERY_SECRET` (сравнение устойчивое к timing attacks).

Без корректного секрета ответ: **401** и тело `{ "ok": false }`.

## Шаг 3. Vercel

В настройках проекта добавьте переменные: `TG_RECOVERY_SECRET`, `TG_RECOVERY_WHITELIST`, `TG_BOT_TOKEN`, при необходимости `PUBLIC_APP_URL`. Задеплойте изменения.

## Шаг 4. Миграция и привязка Telegram user-id

1. Выполните admin-action `migrations-run`, чтобы добавить колонку `users.telegram_user_id` (`bigint`, уникальная, nullable).
2. В разделе админки «Пользователи платформы» для каждого пользователя с ролью **admin** укажите его числовой Telegram user-id (поле «Telegram user-id»). Узнать свой id можно у ботов вроде `@userinfobot` или через Bot API после первого сообщения боту.

## Поведение бота

- Команда `/start` — краткая справка на русском.
- Команда `/reset` — если Telegram user-id в whitelist, пользователь привязан к активному admin в БД и не превышен лимит (одна ссылка за 10 минут на один Telegram user-id), бот присылает одноразовую ссылку сброса пароля с TTL **1 час** (hash-маршрут приложения: `/#/reset?token=...`).
- Остальные сообщения — короткий ответ, что доступна только `/reset`.

Аудит: `auth.tg_recovery.requested`, `auth.tg_recovery.issued`, `auth.tg_recovery.rejected`.

## Локальная разработка (Express)

Поведение дублируется в `apps/platform/server/` на маршруте `POST /api/admin/admin-recovery` (см. `server/admin/telegram-recovery.ts` и `server/admin-routes.ts`).

## Ручная проверка (smoke)

1. **Без секрета** — ожидается **401** и `{ "ok": false }`.
2. **С секретом**, тело — JSON Telegram `Update` с `message.text: "/reset"` и `message.from.id` из whitelist, пользователь с этим `telegram_user_id` — активный admin — ожидается **200** `{ "ok": true }` и сообщение в Telegram со ссылкой.
3. Telegram user-id не в whitelist — ответ **200**, в чате текст о запрете доступа.
4. Нет привязки `telegram_user_id` — **200**, текст о том, что аккаунт не привязан.
5. Привязанный пользователь не admin — **200**, текст что канал только для администраторов.
