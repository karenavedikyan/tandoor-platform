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
| `auth-email-password-login-cd7c` | **Готово (PR 03):** серверный login/logout/me, cookie `tandoor_auth_sess`, audit, in-memory rate-limit на login, `auth:seed-admin` — см. раздел PR 03 |
| `auth-client-switch-cd7c` | **Удаление mock-auth**, переключение клиента на серверные сессии |
| `auth-invitations-cd7c` | Поток приглашений, принятие по токену |
| `auth-rbac-scope-cd7c` | RBAC и `UserScope` на API |
| `auth-users-admin-cd7c` | Полноценный `/users`, редактирование, фильтры |
| `auth-profile-cd7c` | Редактирование `/profile`, валидация по `PROFILE_REQUIREMENTS` |
| `auth-hardening-cd7c` | Redis / распределённый rate-limit, 2FA, усиление brute-force (лёгкий in-memory лимит на login — уже в PR 03) |
| `auth-finalize-cd7c` | Чистка legacy SQLite `users`, финальная документация |



## PR 02 — server scaffolding

Второй PR блока auth добавляет **серверный каркас** без реального входа и без переключения клиента с mock-auth.

### Модули `server/auth/`

| Файл | Назначение |
|------|------------|
| `password-hash.ts` | Обёртка **bcryptjs** (чистый JS, без нативных бинарей — удобно для Vercel): `hashPassword`, `verifyPassword`, `isStrongEnough`. |
| `session-service.ts` | CRUD поверх таблицы `sessions` (`shared/auth-schema.ts`): opaque refresh token (256 bit, base64url), в БД — `sha256` в hex, срок жизни 30 суток или `TANDOOR_SESSION_TTL_DAYS`. |
| `cookie.ts` | `AUTH_COOKIE` = `tandoor_auth_sess`; `buildAuthCookie` / `clearAuthCookie`; `parseAuthRefreshToken` для middleware. **Не** трогает `b24_personal_sess`. |
| `require-auth.ts` | Express `requireAuth()`, Vercel `withAuth()` — проверка cookie и сессии, **одним запросом** снимок пользователя из `users` в `req.auth` (PR 03); `requireRole` / `requireAnyOf` — **заглушки с TODO** до `auth-rbac-scope-cd7c`. Сверка хеша refresh-токена — **constant-time** (`crypto.timingSafeEqual`) в `getSessionByRefreshToken`. |
| `handlers.ts` | **PR 03:** общая логика `login` / `logout` / `logout-all` / `me` для Vercel и Express. |
| `auth-user-snapshot.ts` | **PR 03:** выборка полей пользователя (без `passwordHash`) по `userId`. |
| `request-meta.ts` | **PR 03:** `getClientIp` (прокси-заголовки). |
| `rate-limit.ts` | **PR 03:** in-memory лимит неудачных попыток login (см. PR 03). |
| `db.ts` | Ленивый Drizzle-клиент (Neon HTTP) при наличии `DATABASE_URL` / `POSTGRES_URL` / `NEON_DATABASE_URL`. |
| `index.ts` | Реэкспорт публичного API. |

### Cookie `tandoor_auth_sess` (дефолты)

- `HttpOnly`, `SameSite=Lax`, `Path=/`
- `Secure` — в production и при `TANDOOR_AUTH_COOKIE_SECURE=true` (для локального HTTP без TLS)
- `Max-Age` — 30 суток или `TANDOOR_SESSION_TTL_DAYS`
- В значении cookie — **только** opaque refresh token (без email/ФИО в открытом виде)

- **PR 03:** cookie **реально** выставляется ответом `POST /api/auth/login` (`Set-Cookie: tandoor_auth_sess=…`) и сбрасывается на `POST /api/auth/logout` и `POST /api/auth/logout-all` (`Max-Age=0`).

### Эндпоинты `/api/auth/*` (реализация — PR 03)

Маршруты: `api/auth/[action].ts` (Vercel) и `server/auth-routes.ts` (Express). Общая логика — `server/auth/handlers.ts`.

Подробный контракт запросов/ответов, rate-limit и audit — в разделе **«PR 03 — email/password login (server-side)»** ниже.

### Команда `auth:db-push`

Скрипт `scripts/auth-db-push.mjs` (в шапке — предупреждение «ручной запуск, не из CI») вызывает `drizzle-kit push --config=drizzle.auth.config.ts`, передавая `DATABASE_URL` и при наличии `DATABASE_URL_UNPOOLED`. В CI **не** вызывать.

## Шаги для применения auth-schema на проде

Выполняются **вручную** после согласования (не из CI, не автоматически при деплое):

```bash
cd apps/platform
npm run auth:db-push
```

Требуется переменная окружения **`DATABASE_URL`** (Neon). При необходимости задайте **`DATABASE_URL_UNPOOLED`** — скрипт пробросит её в окружение дочернего процесса.

## PR 03 — email/password login (server-side)

Третий PR блока auth: **реальный** серверный вход по email/password и сессии в Postgres. Клиентский пилотный `login.tsx` / `mock-auth` **не** переключаются на этот flow (это PR `auth-client-switch-cd7c`).

### Эндпоинты и контракт

| Метод и путь (Express / Vercel `?action=`) | Назначение |
|--------------------------------------------|------------|
| `POST /api/auth/login` | Тело JSON: `{ "email": string, "password": string }`. Email нормализуется `trim().toLowerCase()`, простая проверка формата; пароль — непустая строка (политика `isStrongEnough` **не** применяется при входе). Успех: **200** `Set-Cookie: tandoor_auth_sess`, тело `{ success: true, user: { id, email, fullName, role, status, mustChangePassword, lastLoginAt } }` (без `passwordHash`). |
| `GET /api/auth/me` | Cookie `tandoor_auth_sess` обязательна; **401** `UNAUTHENTICATED` без сессии. Успех: **200** `{ success: true, user: … }`, заголовок **`Cache-Control: no-store`**. |
| `POST /api/auth/logout` | Идемпотентный **200** `{ success: true }`: при валидной сессии — `revokeSession`, всегда `Set-Cookie` с очисткой cookie. Запись `audit_log` `auth.logout` (ошибки audit не ломают ответ). **Без** требования предварительного `requireAuth` (нет **401**, если cookie уже нет). |
| `POST /api/auth/logout-all` | Требуется сессия; **401** `UNAUTHENTICATED` иначе. `revokeAllSessionsForUser`, очистка cookie, **200** `{ success: true }`, **`Cache-Control: no-store`**, audit `auth.logout_all`. |

Коды ошибок (JSON): `VALIDATION_ERROR` (400), `INVALID_CREDENTIALS` (401, единое сообщение «Неверный email или пароль.» — без утечки существования email), `RATE_LIMITED` (429 + заголовок `Retry-After`), `UNAUTHENTICATED` (401), `INTERNAL_ERROR` (500, без stack trace).

### Поиск пользователя по email

В таблице `users` email хранится **в нижнем регистре**; логин сравнивает через `eq(authUsers.email, normalizedEmail)` (см. комментарий в `server/auth/handlers.ts`).

### Rate limit (login)

- Только **`POST /api/auth/login`**, хранилище **in-memory** (`Map`), **10** неудачных попыток за **15 минут** на пару **`(clientIp, emailLower)`**. Счётчик увеличивается только если валидация тела прошла, но вход отклонён (нет пользователя / неверный пароль / статус не `active` / нет `password_hash`). После **успешного** входа счётчик для этой пары сбрасывается.
- При превышении: **429**, тело `{ success: false, code: "RATE_LIMITED", message: "Слишком много попыток входа. Повторите позже." }`, заголовок **`Retry-After`** (секунды).
- Ограничения: не переживает рестарт процесса; на serverless — в пределах одного контейнера. Расширение через Redis — TODO PR `auth-hardening-cd7c`.

### Audit (`audit_log`)

При успешном login (best-effort, не валит ответ): `action: "auth.login"`, `entityType: "session"`, `entityId: sessionId`, `metadata: { ip, userAgent }`.  
При logout: `auth.logout`, `entityId` — id сессии или строка `"unknown"`.  
При logout-all: `auth.logout_all`, `entityType: "user"`, `entityId` — id пользователя.

### Bootstrap первого администратора

Ручной одноразовый (или повторный) bootstrap, **не из CI**:

```bash
cd apps/platform
ADMIN_EMAIL="founder@tandoor.example" ADMIN_PASSWORD="…" ADMIN_FULL_NAME="…" DATABASE_URL="…" npm run auth:seed-admin
```

- **Обязательно:** `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`. **`ADMIN_FULL_NAME`** по умолчанию `Администратор`.
- Пароль проверяется **`isStrongEnough`** (как при будущей смене пароля).
- Email сохраняется в **lowercase**; если пользователь уже есть — обновляются `password_hash`, `role=admin`, `status=active`, `must_change_password=false`; иначе — `INSERT` с `created_by=null`. Сессии и `audit_log` скрипт **не** создаёт.

Реализация: `scripts/auth-seed-admin.mjs` (запускает `auth-seed-admin.impl.ts` через tsx).

### Безопасность PR 03

- Сообщения ошибок логина **не** раскрывают наличие email в системе.
- `password_hash` **никогда** не отдаётся в JSON.
- Refresh-токен — opaque **base64url** 256 bit; в БД — **sha256** hex; сравнение через `crypto.timingSafeEqual`.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, **`Secure`** в production (как в `cookie.ts`).
- В `console.error` не пишутся пароли, хеши и refresh-токены.

### PR 03 — что **не** входит

- Смена пароля и сброс по email
- 2FA
- Приглашения (`auth-invitations-cd7c`)
- Удаление `mock-auth` и переключение клиента на серверный flow (`auth-client-switch-cd7c`, PR #04)
- Защита бизнес-API ролями (`auth-rbac-scope-cd7c`, PR #06)
- Админка `/users` (`auth-users-admin-cd7c`, PR #07)
- Профиль и смена пароля из `/profile` (`auth-profile-cd7c`, PR #08)
- Персистентный / Redis rate-limit и brute-force поверх инфраструктуры (`auth-hardening-cd7c`, PR #09)

## PR 02 — что **не** входит

- Регистрация пользователей через публичный API (реальный login — **PR 03**)
- Запись в `users` / `sessions` / `audit_log` из эндпоинтов **501**
- Автоматический `auth:db-push` в CI или при deploy
- Защита бизнес-API по сессии
- Приглашения, 2FA
- Удаление mock-auth и переключение `useCurrentUser` на сервер
- RBAC и `UserScope` на маршрутах (только заглушки `requireRole` / `requireAnyOf` с TODO)

## PR 01 — что **не** входило

- Email/password login и формы регистрации
- Серверные сессии и cookies сессии
- Рабочие `/api/auth/*` с настоящей аутентификацией (501-заглушки PR 02 заменены **реализацией в PR 03**)
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

После PR 03: без применённой схемы (`auth:db-push`) и без пользователя в `users` логин вернёт **500** (нет БД) или **401** `INVALID_CREDENTIALS` (нет записи) — это ожидаемо. Перед прод-смоуком выполните `npm run auth:db-push` и при необходимости `npm run auth:seed-admin`. **`auth:seed-admin` не вызывать из CI.** Автоматический `auth:db-push` при деплое **не** выполняется.
