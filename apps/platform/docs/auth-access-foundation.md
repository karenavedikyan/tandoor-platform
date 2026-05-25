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
| `auth-email-password-login-v2-cd7c` | **PR 03 (v2):** серверный login/logout/me; Vercel `api/auth/[action].ts` **self-contained** (без импортов `server/`/`shared/`), Express — `server/auth/handlers.ts`; `auth:seed-admin` |
| `auth-client-switch-cd7c` | **done — PR 04:** удаление mock-auth, клиент на `/api/auth/*` (TanStack Query `useAuthUser`, `auth-api.ts`, cookie) |
| `auth-invitations-cd7c` | Поток приглашений, принятие по токену |
| `auth-rbac-scope-cd7c` | RBAC и `UserScope` на API |
| `auth-users-admin-cd7c` | Полноценный `/users`, редактирование, фильтры |
| `auth-profile-cd7c` | Редактирование `/profile`, валидация по `PROFILE_REQUIREMENTS` |
| `auth-hardening-cd7c` | Redis / распределённый rate-limit, 2FA (in-memory лимит на login — уже в PR 03) |
| `auth-finalize-cd7c` | Чистка legacy SQLite `users`, финальная документация |


## PR 04 — client switch (удаление mock-auth)

Клиент платформы переведён на **реальные** `GET/POST /api/auth/*` с `credentials: "same-origin"` (HttpOnly cookie `tandoor_auth_sess`). **Пароль и email в localStorage/sessionStorage не сохраняются** (кроме пилотного профиля release-demo в `sessionStorage`, см. ниже).

### Что удалено

- `apps/platform/client/src/lib/mock-auth.ts` и `apps/platform/client/src/hooks/use-mock-auth.ts` (пилотные пароли, `MOCK_AUTH_CREDENTIALS`, `MOCK_AUTH_CHANGED_EVENT`, `loginWithCredentials`, `SALES_ROLE_PASSWORDS`).
- Страница `/login`: список демо-логинов, `LoginPicker`, `MOCK_AUTH_CREDENTIALS`.

### Что осталось из пилота

- **Release-demo bypass** (`lib/release-demo-bypass.ts`): включается через `VITE_RELEASE_DEMO=true`, legacy `VITE_TANDOOR_DEMO_AUTH=1`, query `?demo=1`, либо `localStorage["tandoor-release-demo-bypass"] === "true"`. **Без реальной сессии** доступны только маршруты `/release-one*`. Все остальные разделы требуют успешного `GET /api/auth/me`.
- **Демо-персона** (`release-demo-profile.ts`, `sessionStorage`): при активной серверной сессии роль/персона для пилотных экранов берутся из `UserRole` пользователя; при bypass без логина — из `sessionStorage`.
- **Временный адаптер** `lib/role-mapping.ts`: `UserRole` ↔ `SalesRole` для существующих экранов sales-control. **TODO:** убрать в PR #06 / #07.

### Новые клиентские модули

| Файл | Назначение |
|------|------------|
| `client/src/lib/auth-api.ts` | `login`, `me`, `logout`, `logoutAll`, тип `AuthUserDTO`, `displayUserName` |
| `client/src/hooks/use-auth-user.ts` | TanStack Query `["auth","me"]`, `invalidateAuthUser` |
| `client/src/hooks/use-current-user.ts` | `isAuthenticated` = `active`, `logout` + инвалидация + жёсткий переход на `#/login` |
| `shared/auth.ts` | `UserRole`, `UserStatus` (общие литералы с сервером) |

### Локальный вход в dev

1. `npm run auth:db-push` и `npm run auth:seed-admin` с `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. `npm run dev`, открыть `#/login`, ввести email и пароль администратора.

### Vite proxy

В `vite.config.ts`: `server.proxy["/api"] → http://localhost:5000`, чтобы при отдельном Vite dev (`5173`) запросы `/api/auth/*` шли на Express.

### Вне объёма PR 04 (как и раньше)

- Приглашения (**PR #05**)
- RBAC на бизнес-API (**PR #06**)
- Админка `/users` (**PR #07**)
- Редактирование `/profile`, смена пароля (**PR #08**)
- 2FA, Redis rate-limit (**PR #09**)
- Удаление `SalesRole` и адаптера `role-mapping` (**PR #06 / #07**)

## PR 02 — server scaffolding

Второй PR блока auth добавляет **серверный каркас** без реального входа и без переключения клиента с mock-auth.

### Модули `server/auth/`

| Файл | Назначение |
|------|------------|
| `password-hash.ts` | Обёртка **bcryptjs** (чистый JS, без нативных бинарей — удобно для Vercel): `hashPassword`, `verifyPassword`, `isStrongEnough`. |
| `session-service.ts` | CRUD поверх таблицы `sessions` (`shared/auth-schema.ts`): opaque refresh token (256 bit, base64url), в БД — `sha256` в hex, срок жизни 30 суток или `TANDOOR_SESSION_TTL_DAYS`. |
| `cookie.ts` | `AUTH_COOKIE` = `tandoor_auth_sess`; `buildAuthCookie` / `clearAuthCookie`; `parseAuthRefreshToken` для middleware. **Не** трогает `b24_personal_sess`. |
| `require-auth.ts` | Express `requireAuth()` — cookie + сессия + **снимок пользователя** из `users` одним запросом в `req.auth`; `requireRole` / `requireAnyOf` — **TODO** до `auth-rbac-scope-cd7c`. |
| `handlers.ts` | **PR 03:** логика auth для **Express** (`loginHandler`, `me`, `logout`, `logout-all`). На Vercel см. self-contained `api/auth/[action].ts`. |
| `auth-user-snapshot.ts` | **PR 03:** выборка полей пользователя по `userId`. |
| `request-meta.ts` / `rate-limit.ts` | **PR 03:** IP и in-memory rate-limit для login (Express; на Vercel — дубликат Map внутри `[action].ts`). |
| `db.ts` | Ленивый Drizzle-клиент (Neon HTTP) при наличии `DATABASE_URL` / `POSTGRES_URL` / `NEON_DATABASE_URL`. |
| `index.ts` | Реэкспорт публичного API. |

### Cookie `tandoor_auth_sess` (дефолты)

- `HttpOnly`, `SameSite=Lax`, `Path=/`
- `Secure` — в production и при `TANDOOR_AUTH_COOKIE_SECURE=true` (для локального HTTP без TLS)
- `Max-Age` — 30 суток или `TANDOOR_SESSION_TTL_DAYS`
- В значении cookie — **только** opaque refresh token (без email/ФИО в открытом виде)
- **PR 03:** cookie выставляется на `POST /api/auth/login` и сбрасывается на `POST /api/auth/logout` и `POST /api/auth/logout-all`.

### Эндпоинты `/api/auth/*` (PR 03)

- **Vercel:** `api/auth/[action].ts` — **self-contained** реализация (см. раздел «Почему api/auth/[action].ts self-contained»).
- **Express (`npm run dev`):** `server/auth-routes.ts` → `server/auth/handlers.ts` (Drizzle, общие модули `server/auth/*`).

### Команда `auth:db-push`

Скрипт `scripts/auth-db-push.mjs` (в шапке — предупреждение «ручной запуск, не из CI») вызывает `drizzle-kit push --config=drizzle.auth.config.ts`, передавая `DATABASE_URL` и при наличии `DATABASE_URL_UNPOOLED`. В CI **не** вызывать.

## Шаги для применения auth-schema на проде

Выполняются **вручную** после согласования (не из CI, не автоматически при деплое):

```bash
cd apps/platform
npm run auth:db-push
```

Требуется переменная окружения **`DATABASE_URL`** (Neon). При необходимости задайте **`DATABASE_URL_UNPOOLED`** — скрипт пробросит её в окружение дочернего процесса.

## PR 03 — email/password login (server-side, self-contained Vercel)

Серверный вход по email/password, сессии в Postgres, cookie `tandoor_auth_sess`. Клиент **не** переключается с mock-auth (это PR `auth-client-switch-cd7c`).

### Почему `api/auth/[action].ts` self-contained

Сборщик **@vercel/node** для этого репозитория приводил к **`FUNCTION_INVOCATION_FAILED`** (функция падает до первого JSON), если `api/auth/[action].ts` импортировал **любой** файл из `server/*` или `@shared/*` — см. PR **#224** и revert **#226** (`fbc8a2b`). Локально `npm run check` / `npm run build` проходили, на проде — нет.

Поэтому Vercel-функция **намеренно self-contained**: только `@vercel/node`, `@neondatabase/serverless` (`Pool`), `bcryptjs`, `node:crypto`; SQL через `pool.query` **без Drizzle**; строковые литералы ролей/статусов продублированы в файле.

Та же бизнес-логика для **Express** живёт в `server/auth/handlers.ts` (Drizzle + `server/auth/*`). **При любом изменении** контракта login / logout / me / rate-limit / audit нужно править **оба** места и держать поведение синхронным.

Аналогичный паттерн (self-contained, без импортов проекта): `api/dadata/[action].ts`, `api/uploads/[action].ts`, `api/actualization/state.ts`.

### Эндпоинты и контракт

| Метод и путь | Назначение |
|--------------|------------|
| `POST /api/auth/login` | JSON `{ email, password }`. Валидация email (`trim` + lowercase + простой regex), пароль непустой (без `isStrongEnough` на входе). Rate-limit: **10** неудач / **15 мин** на `(ip, emailLower)` → **429** + `Retry-After`. Успех: **200**, `Set-Cookie`, `{ success, user }` без `password_hash`. |
| `GET /api/auth/me` | Валидная сессия по cookie → **200** + `Cache-Control: no-store`. Иначе **401** `UNAUTHENTICATED`. |
| `POST /api/auth/logout` | Идемпотентный **200**, всегда очистка cookie; revoke сессии если cookie валидна; audit `auth.logout`. |
| `POST /api/auth/logout-all` | Без сессии → **401**; иначе revoke всех сессий пользователя, очистка cookie, audit `auth.logout_all`, `Cache-Control: no-store`, **200**. |

Ошибки: `VALIDATION_ERROR` (400), `INVALID_CREDENTIALS` (401, единое сообщение), `RATE_LIMITED` (429), `UNAUTHENTICATED` (401), `INTERNAL_ERROR` (500).

### Bootstrap первого администратора

```bash
cd apps/platform
ADMIN_EMAIL="founder@tandoor.example" ADMIN_PASSWORD="…" ADMIN_FULL_NAME="…" DATABASE_URL="…" npm run auth:seed-admin
```

Скрипт `scripts/auth-seed-admin.mjs` (tsx → `auth-seed-admin.impl.ts`): `isStrongEnough`, upsert admin, **без** сессий и audit. **Не вызывать из CI.**

### Прод-проверка после merge

```bash
curl -i https://tandoor-platform.vercel.app/api/auth/me
```

Ожидается **401** `UNAUTHENTICATED`, а **не** `500` / `FUNCTION_INVOCATION_FAILED`. Если **500** FUNCTION_* — срочно разбирать бандлер (как #224).

### PR 03 — что **не** входит

- Смена / сброс пароля, 2FA, приглашения
- Удаление mock-auth и переключение клиента (PR #04 `auth-client-switch-cd7c`)
- RBAC на бизнес-API (PR #06)
- Админка `/users` (PR #07), профиль (PR #08)
- Redis rate-limit (PR #09 `auth-hardening-cd7c`)

## PR 02 — что **не** входит

- Публичная регистрация пользователей (реальный login — **PR 03**)
- Запись в `users` / `sessions` / `audit_log` из заглушек **501** (заменено в **PR 03**)
- Автоматический `auth:db-push` в CI или при deploy
- Защита бизнес-API по сессии
- Приглашения, 2FA
- Удаление mock-auth и переключение `useCurrentUser` на сервер
- RBAC и `UserScope` на маршрутах (только заглушки `requireRole` / `requireAnyOf` с TODO)

## PR 01 — что **не** входило

- Email/password login и формы регистрации
- Серверные сессии и cookies сессии
- Рабочие `/api/auth/*` с настоящей аутентификацией (501 в PR 02; **PR 03** включает реальный вход)
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

После PR 03: `curl -i https://tandoor-platform.vercel.app/api/auth/me` → **401** `UNAUTHENTICATED` (ожидаемо без cookie). **`FUNCTION_INVOCATION_FAILED` — не ожидается** (если появился — регресс как #224). Перед смоуком на проде выполните `npm run auth:db-push`; без схемы login может вернуть **500** `INTERNAL_ERROR`. **`auth:seed-admin` не из CI.** Автоматический `auth:db-push` при деплое **не** выполняется.
