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

**Миграции и `npm run db:push` в этом PR не выполняются.** Для Postgres позже используется отдельный конфиг `drizzle.auth.config.ts` (не смешивается с SQLite `./data.db`).

SQLite-таблица `users` в `shared/schema.ts` помечена `@deprecated` — будет удалена в `auth-finalize-cd7c`.

## План этапов (roadmap)

| Этап (рабочее имя PR) | Содержание |
|----------------------|------------|
| `auth-server-scaffolding-cd7c` | Каркас серверной auth, cookie/заголовки, без полного логина |
| `auth-email-password-login-cd7c` | Вход email/password, проверка хеша, выдача сессий |
| `auth-client-switch-cd7c` | **Удаление mock-auth**, переключение клиента на серверные сессии |
| `auth-invitations-cd7c` | Поток приглашений, принятие по токену |
| `auth-rbac-scope-cd7c` | RBAC и `UserScope` на API |
| `auth-users-admin-cd7c` | Полноценный `/users`, редактирование, фильтры |
| `auth-profile-cd7c` | Редактирование `/profile`, валидация по `PROFILE_REQUIREMENTS` |
| `auth-hardening-cd7c` | Rate limit, аудит, политики паролей |
| `auth-finalize-cd7c` | Чистка legacy SQLite `users`, финальная документация |

## Что **не** входит в этот PR

- Email/password login и формы регистрации
- Серверные сессии и cookies сессии
- `GET /api/auth/me` и прочие `/api/auth/*`
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
