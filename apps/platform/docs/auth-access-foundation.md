# Auth & user access foundation (PR 01)

Этот документ описывает первый PR блока авторизации: типы, целевую модель, схему Postgres (описание без применения миграций), skeleton UI для `/users` и `/profile`. **Реальные логины, пароли на сервере и защита API в этот PR не входят.**

## Аудит текущей mock-auth (пилот)

| Аспект | Где | Состояние |
|--------|-----|-----------|
| Сессия | `localStorage`, ключ `tandoor-auth-user-v1` (`TANDOOR_AUTH_USER_KEY` в `client/src/lib/mock-auth.ts`) | Клиентская запись userId + username, без серверной сессии |
| Пароли | `client/src/lib/mock-auth.ts`: `SALES_ROLE_PASSWORDS`, `SUPPORT_ROLE_PASSWORD`, сборка `MOCK_AUTH_CREDENTIALS` | Учебные значения (`"1"`, `"22"`, `"333"`, `"123"`), не секрет |
| Guard маршрутов | `client/src/lib/auth-access.ts` → `canAccessPath`, проверка в `App.tsx` перед рендером shell | Только **клиентский** hash-router; обход URL = обход «защиты» |
| API | `server/routes.ts`, `api/*` | Нет проверки сессии/JWT на бизнес-эндпоинтах |

Таблица `users` в `shared/schema.ts` (SQLite) задействована только в примере `server/storage.ts` и **не** описывает пилотных пользователей платформы и mock-auth.

## Предупреждение по безопасности

Пока **нет** серверной аутентификации и авторизации на API, **любой** бизнес-эндпоинт остаётся доступным по прямому запросу. **Mock-auth не является механизмом безопасности** — это пилотный UX-вход. Не использовать для чувствительных данных вне контролируемой демо-среды.

## Целевая модель (типы)

См. `shared/auth.ts`:

- **`UserRole`**: `director` \| `rop` \| `regional_manager` \| `manager` \| `marketer` \| `analyst` \| `admin`
- **`UserStatus`**: `invited` \| `active` \| `disabled`
- **`UserScope`**: `teamIds`, `regionIds`, опционально `cityIds`
- **`AuthUser`**: идентификатор, email, опционально phone, ФИО, роль, статус, scope, флаг смены пароля, временные метки
- **`BUSINESS_ROLES`**: все роли **кроме** `admin` — для UI приглашений, смены роли, фильтров `/users`
- **`INVITABLE_BY`**: кто какие роли может пригласить (см. код; `admin` создаётся только через seed)
- **`PROFILE_REQUIREMENTS`**: обязательные поля профиля по роли (см. комментарии в коде)
- **`ProfileRequirement`**: тип карты обязательных полей (`Record<UserRole, readonly string[]>`)

Маппинг пилотных `SalesRole` → `UserRole` для будущих сидов: `shared/auth-role-mapping.ts` → `salesRoleToUserRole`.

## Таблицы Postgres (этот PR — только описание в коде)

Файл `shared/auth-schema.ts` (Drizzle, `pgTable`), ориентир на Neon:

| Таблица | Назначение |
|---------|------------|
| `users` | Учётные записи платформы: email, телефон, ФИО, роль, статус, хеш пароля, флаги, аудит создания |
| `teams` | Команды продаж, привязка к РОП |
| `user_team_memberships` | Состав команд и роль в команде |
| `regions` | Справочник регионов |
| `user_region_scopes` | Привязка пользователя к регионам |
| `invitations` | Приглашения по email с токеном и сроком |
| `sessions` | Refresh-сессии (после появления серверного логина) |
| `audit_log` | Журнал действий |

**PR 01:** миграции auth в CI не запускались. С PR `auth-server-scaffolding` для Postgres доступен **ручной** скрипт `npm run auth:db-push` (см. раздел «Шаги для применения auth-schema на проде»). Конфиг Drizzle: `drizzle.auth.config.ts` (отдельно от SQLite `./data.db`).

SQLite-таблица `users` в `shared/schema.ts` помечена `@deprecated` — будет удалена в `auth-finalize-cd7c`.

## План этапов (roadmap)

| Этап (рабочее имя PR) | Содержание |
|----------------------|------------|
| `auth-server-scaffolding-cd7c` | Модули `server/auth/*`, сессии в Postgres, bcryptjs, cookie `tandoor_auth_sess`, заглушки `/api/auth/*` (501), `auth:db-push` — см. раздел PR 02 |
| `auth-email-password-login-cd7c` | Вход email/password, проверка хеша, выдача сессий |
| `auth-client-switch-cd7c` | **Удаление mock-auth**, переключение клиента на серверные сессии |
| `auth-invitations-cd7c` | Поток приглашений, принятие по токену |
| `auth-rbac-scope-cd7c` | RBAC и `UserScope` на API |
| `auth-users-admin-cd7c` | Полноценный `/users`, редактирование, фильтры |
| `auth-profile-cd7c` | Редактирование `/profile`, валидация по `PROFILE_REQUIREMENTS` |
| `auth-hardening-cd7c` | Rate limit, аудит, политики паролей |
| `auth-finalize-cd7c` | Чистка legacy SQLite `users`, финальная документация |



## PR 02 — server scaffolding

Второй PR блока auth добавляет **серверный каркас** без реального входа и без переключения клиента с mock-auth.

### Модули `server/auth/`

| Файл | Назначение |
|------|------------|
| `password-hash.ts` | Обёртка **bcryptjs** (чистый JS, без нативных бинарей — удобно для Vercel): `hashPassword`, `verifyPassword`, `isStrongEnough`. |
| `session-service.ts` | CRUD поверх таблицы `sessions` (`shared/auth-schema.ts`): opaque refresh token (256 bit, base64url), в БД — `sha256` в hex, срок жизни 30 суток или `TANDOOR_SESSION_TTL_DAYS`. |
| `cookie.ts` | `AUTH_COOKIE` = `tandoor_auth_sess`; `buildAuthCookie` / `clearAuthCookie`; `parseAuthRefreshToken` для middleware. **Не** трогает `b24_personal_sess`. |
| `require-auth.ts` | Express `requireAuth()`, Vercel `withAuth()` — проверка cookie и сессии; `requireRole` / `requireAnyOf` — **заглушки с TODO** до `auth-rbac-scope-cd7c`. Сверка хеша refresh-токена — **constant-time** (`crypto.timingSafeEqual`) в `getSessionByRefreshToken`. |
| `db.ts` | Ленивый Drizzle-клиент (Neon HTTP) при наличии `DATABASE_URL` / `POSTGRES_URL` / `NEON_DATABASE_URL`. |
| `index.ts` | Реэкспорт публичного API. |

### Cookie `tandoor_auth_sess` (дефолты)

- `HttpOnly`, `SameSite=Lax`, `Path=/`
- `Secure` — в production и при `TANDOOR_AUTH_COOKIE_SECURE=true` (для локального HTTP без TLS)
- `Max-Age` — 30 суток или `TANDOOR_SESSION_TTL_DAYS`
- В значении cookie — **только** opaque refresh token (без email/ФИО в открытом виде)

### Эндпоинты `/api/auth/*` (заглушки 501)

Реализация: `api/auth/[action].ts` (Vercel) и `server/auth-routes.ts` (Express для `npm run dev`). Все ответы **501** с телом `{ success: false, code: "NOT_IMPLEMENTED", message: "Будет включено в PR auth-email-password-login-cd7c" }`:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/auth/me`

Заглушки **не** выставляют cookie, **не** читают `users`, **не** проверяют пароли. Рабочий вход подключится в **`auth-email-password-login-cd7c`**.

### Команда `auth:db-push`

Скрипт `scripts/auth-db-push.mjs` (в шапке — предупреждение «ручной запуск, не из CI») вызывает `drizzle-kit push --config=drizzle.auth.config.ts`, передавая `DATABASE_URL` и при наличии `DATABASE_URL_UNPOOLED`. В CI **не** вызывать.

## Шаги для применения auth-schema на проде

Выполняются **вручную** после согласования (не из CI, не автоматически при деплое):

```bash
cd apps/platform
npm run auth:db-push
```

Требуется переменная окружения **`DATABASE_URL`** (Neon). При необходимости задайте **`DATABASE_URL_UNPOOLED`** — скрипт пробросит её в окружение дочернего процесса.

## PR 02 — что **не** входит

- Реальный email/password login и регистрация пользователей
- Запись в `users` / `sessions` / `audit_log` из эндпоинтов **501**
- Автоматический `auth:db-push` в CI или при deploy
- Защита бизнес-API по сессии
- Приглашения, 2FA
- Удаление mock-auth и переключение `useCurrentUser` на сервер
- RBAC и `UserScope` на маршрутах (только заглушки `requireRole` / `requireAnyOf` с TODO)

## PR 01 — что **не** входило

- Email/password login и формы регистрации
- Серверные сессии и cookies сессии
- Рабочие `/api/auth/*` с настоящей аутентификацией (в PR 02 добавлены только **501-заглушки**)
- Защита бизнес-API по роли
- Приглашения и письма
- 2FA / MFA
- Удаление или ослабление `mock-auth`, `MOCK_AUTH_CREDENTIALS`, `TANDOOR_AUTH_USER_KEY`, `EXPLICIT_USERNAMES`, `SALES_ROLE_PASSWORDS`
- Запуск миграций, `db:push`, `DROP` таблиц/колонок

## Skeleton UI в этом PR

- **`/users`**: только `sales_director` и `team_lead` (`canAccessPath`); пункт в **верхнем** плоском меню директора/РОП сразу после «План-факт и KPI», пометка `(foundation)` в подписи, **без** бейджа «в разработке».
- **`/profile`**: все залогиненные роли; ссылка в **нижней** зоне сайдбара (иконка + tooltip «Мой профиль»), не в основном списке навигации.

## После merge (deploy)

Стандартный flow (например Vercel). Проверить маршруты: `/client-base-activity`, `/dealer-base`, `/trade-points`, `/sales-control/plan-fact`, `/users` (200 для директора/РОП; для других ролей — редирект на домашний из-за **клиентского** guard), `/profile` (200), при необходимости `/api/sales-plan-fact/state`.

Дополнительно после PR 02: `curl -i -X POST https://tandoor-platform.vercel.app/api/auth/login` → **501** и JSON с `code: "NOT_IMPLEMENTED"`. Автоматический `auth:db-push` при деплое **не** выполняется.
