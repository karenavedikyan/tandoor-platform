# Авторизация и доступ (Tandoor Platform)

Краткий обзор auth-модуля: пароли, сессии, RBAC, админские операции и аварийные сценарии.

## Архитектура

- **Пароли**: `bcryptjs` (cost 12 в большинстве путей), хранение только хэша в `users.password_hash`.
- **Сессии**: таблица `sessions`, refresh-токен в **HttpOnly** cookie `tandoor_auth_sess` (см. `server/auth/cookie.ts` и Vercel `api/auth/[action].ts`). Хэш токена в БД — **SHA-256** (строка hex), сравнение через `timingSafeEqual`.
- **Срок жизни сессии**: по умолчанию 24 часа (см. `sessionTtlSeconds` / `SESSION_TTL_HOURS` в коде).
- **Аудит**: таблица `audit_log` (`actor_user_id` может быть `NULL` для системных событий), `metadata` — JSON.

## RBAC

Матрица прав в `shared/auth-rbac.ts` (источник истины для клиента и сервера). На Vercel в `api/admin/[action].ts` и `api/auth/[action].ts` есть **инлайн-копия** `PERMISSIONS_BY_ROLE` с пометкой `SYNC: shared/auth-rbac.ts` — при изменении матрицы обновляйте оба места.

Роли: `director`, `rop`, `regional_manager`, `manager`, `marketer`, `analyst`, `admin`. Права включают, например: `users.list`, `users.update_role`, `invitations.create`, `audit.read`, `sessions.revoke_self` и др.

## Сценарии

| Сценарий | Где реализовано |
|----------|-----------------|
| Вход по email/паролю | `POST /api/auth/login` |
| Выход / выход везде | `POST /api/auth/logout`, `POST /api/auth/logout-all` |
| Текущий пользователь | `GET /api/auth/me` |
| Смена пароля (себе) | `POST /api/admin/profile-change-password` |
| Приглашение / принятие | `POST /api/invitations/create`, `POST /api/invitations/accept`, … |
| Ссылка сброса пароля (админ/директор/РОП по правилам) | `POST /api/admin/password-reset-link-create`, активация `POST /api/auth/password-reset-link-redeem` |
| Аварийный сброс пароля admin через Telegram | `POST /api/admin/admin-recovery` (см. `docs/tg-recovery.md`) |
| Очистка просроченных сессий | `POST /api/admin/sessions-cleanup-expired` (только admin) + разовый шаг в `migrations-run` |

## Ограничение частоты логина

Таблица `auth_login_failures` (создаётся в `POST /api/admin/migrations-run`):

- При **неуспешном** логине увеличивается счётчик по `email_lower`, после **5** неудач подряд выставляется блокировка на **15 минут** (ответ **429** `RATE_LIMITED` с `Retry-After`).
- При **успешном** входе строка для email удаляется.
- В аудит пишется `auth.login.failed` с `metadata: { ip, failCount }`.

## CSRF (Origin / Referer)

Для **POST** в `api/admin/[action].ts`, `api/auth/[action].ts` и `api/invitations/[action].ts` проверяется заголовок `Origin` или `Referer` на список разрешённых origin (production: `https://tandoor-platform.vercel.app`, dev: `http://localhost:5173`, `http://localhost:3000`). При несовпадении — **403** `CSRF_REJECTED`.

Исключение: **`admin-recovery`** (webhook Telegram) — проверка не выполняется.

В Express те же правила в `server/*-routes.ts` через `server/security/csrf-origin.ts`.

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` / `POSTGRES_URL` / `NEON_DATABASE_URL` | Подключение к Postgres (Neon) |
| `PUBLIC_APP_URL` / `PUBLIC_BASE_URL` | Ссылки в письмах/приглашениях (см. код) |
| `TG_BOT_TOKEN`, `TG_RECOVERY_SECRET`, `TG_RECOVERY_WHITELIST` | Telegram recovery (см. `docs/tg-recovery.md`) |
| `TANDOOR_AUTH_COOKIE_SECURE` | Принудительно `Secure` для cookie сессии |

Отдельного `JWT_SECRET` для access-token в текущей схеме нет: используется refresh-сессия в HttpOnly cookie.

## Bootstrap нового окружения

1. Задать `DATABASE_URL` (или аналог) в Vercel / `.env` для dev.
2. Выполнить **`POST /api/admin/migrations-run`** под активным **admin** (после ручного создания первого администратора, см. ниже).
3. Создать первого администратора вручную (один раз), например SQL (пароль замените на свой bcrypt-хэш, сгенерированный локально):

```sql
INSERT INTO users (id, email, full_name, role, status, password_hash, must_change_password, phone, created_by)
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  'Platform Admin',
  'admin',
  'active',
  '$2a$12$REPLACE_WITH_BCRYPT_HASH',
  false,
  NULL,
  NULL
);
```

4. Войти под этим администратором, при необходимости включить `TANDOOR_AUTH_COOKIE_SECURE=true` на проде.
5. Для Telegram recovery: см. `docs/tg-recovery.md`, привязка `telegram_user_id` через админку пользователей.

## Smoke

- `npm run test:auth-access` — быстрый матричный тест правил reset-link на клиенте.
- `npm run test:auth-e2e` — end-to-end против `BASE_URL` (нужны `ADMIN_EMAIL`, `ADMIN_PASSWORD`).

## Аудит: примеры ключевых `action`

После ручного smoke в `audit_list` должны появляться строки (поля зависят от сценария):

1. `auth.reset_link.created` — `entity_type=user`, `entity_id=<targetUserId>`, в `metadata` есть `linkId`, `expiresAt`.
2. `auth.reset_link.used` — `entity_type=user`, `entity_id=<targetUserId>`, `metadata.linkId`, `ip`.
3. `auth.tg_recovery.issued` — `entity_type=user`, `entity_id=<userId>`, `metadata` с `tgUserId`, `linkId`, `expiresAt`.
4. `auth.login.failed` — `entity_type=email`, `entity_id=<email_lower>`, `metadata` с `ip`, `failCount`.

При ошибках вставки в лог пишется `console.warn('[audit-fail]', action, message)` — в продакшене после исправления схемы таких строк быть не должно.
