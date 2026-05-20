# POC: Тандор внутри Bitrix24

## Что проверяет POC

- Можно ли открывать ЛК Тандор **в iframe или слайдере Bitrix24** как отдельную оболочку входа, **без переноса** всего приложения внутрь Bitrix24.
- Удобство **облегчённого chrome** (`?embedded=bitrix24`): без боковой навигации и тяжёлой шапки.
- **Реальное создание тестовой задачи** в Bitrix24 через сервер Тандор: вызывается только метод REST **`tasks.task.add`** (входящий webhook URL хранится в `process.env.BITRIX24_WEBHOOK_URL` на сервере, не в клиенте).
- **MVP «задачи из ЛК»:** менеджер с правами записи по клиенту может создать задачу в Bitrix24 из **карточки дилера** или **карточки торговой точки** (`POST /api/bitrix24/tasks/create`). В теле можно передать **`responsibleId`** (положительное целое) — тогда в Bitrix24 в **`RESPONSIBLE_ID`** и **`CREATED_BY`** подставляется он; иначе — прежняя логика (env / URL webhook). Связь «что создано» хранится **только в браузере** (`localStorage`), без обратной синхронизации статусов из Bitrix24 и без входящих webhook от Bitrix24.
- **MVP «список из Bitrix24»:** по кнопке «Загрузить из Bitrix24» вызывается **`POST /api/bitrix24/tasks/list`** (метод Bitrix24 **`tasks.task.list`** по тому же webhook). В теле запроса можно передать **`responsibleId`** (положительное целое) — тогда фильтр **`RESPONSIBLE_ID`** в Bitrix24 берётся из него; иначе — как раньше из **`BITRIX24_TASK_RESPONSIBLE_ID`** или **`userId`** из URL webhook. Результат кэшируется в **`localStorage`** (`tandoor-bitrix24-imported-tasks-v1`). Это **ручной** импорт, без realtime и без сопоставления задач с дилером/ТТ по сложным правилам (автолинковка по описанию не делается).
- **MVP «пользователи Bitrix24» (диагностика):** на странице **`#/bitrix24`** блок **«Пользователи Bitrix24»** вызывает **`POST /api/bitrix24/users/list`** (метод **`user.get`**). Нужен только для **сопоставления** `userId` Тандор ↔ `bitrixUserId` в Bitrix24; не хранит маппинг на сервере и не подменяет авторизацию.
- **MVP «диагностика чатов» (im.*):** на **`#/bitrix24`** блок **«Диагностика чатов Bitrix24»** вызывает **`POST /api/bitrix24/chat/diagnostics`**. По умолчанию (без **`BITRIX24_COMMUNICATIONS_UNSAFE_SHARED_WEBHOOK_ENABLED=true`**) маршрут отвечает **403** `BITRIX24_COMMUNICATIONS_DISABLED`, как и **`recent`/`messages`/`send`**. С включённым флагом — набор проб REST через **общий webhook** (**`im.recent.get`**, при `dialogId` — **`im.dialog.messages.get`**, при `dialogId`+`message` — **`im.message.add`**, при `testNotify: true` — **`im.notify.personal.add`**); в JSON — массив **`diagnostics`**. **Раздел «Коммуникации»** webhook для чатов **не** использует — только персональный OAuth.
- **MVP «раздел Коммуникации»:** пункт **«Коммуникации»** (`#/communications`) доступен **всем основным ролям** демо-ЛК. Личные чаты идут через **персональный OAuth Bitrix24**: access/refresh token хранятся **только** в **HttpOnly AES-GCM cookie** на сервере (секрет **`BITRIX24_OAUTH_COOKIE_SECRET`**), не в `localStorage`. После успешного callback пользователь перенаправляется на **`#/communications?bitrix24=connected`**. Персональные REST-вызовы: **`im.recent.get`**, **`im.dialog.messages.get`**, **`im.message.add`**. Устаревшие **`POST /api/bitrix24/chat/recent`**, **`/messages`**, **`/send`**, **`/diagnostics`** (общий webhook) по-прежнему **403** `BITRIX24_COMMUNICATIONS_DISABLED` без аварийного флага.

## Переменные окружения (только сервер)

| Переменная | Обязательность | Назначение |
|------------|----------------|------------|
| `BITRIX24_WEBHOOK_URL` | **Обязательна** для серверных операций с **задачами**, списком **пользователей** и **диагностикой чатов** Bitrix24 (POC и MVP) | Полный базовый URL входящего webhook (как в Bitrix24, сегмент **`/rest/<userId>/<token>/`**). Из **`userId`** в URL автоматически выставляются **ответственный** и **постановщик** задачи (`RESPONSIBLE_ID` / `CREATED_BY`), если в теле **`POST /api/bitrix24/tasks/create`** или **`POST /api/bitrix24/tasks/list`** **не** передан валидный **`responsibleId`** и не задан override **`BITRIX24_TASK_RESPONSIBLE_ID`**. Для **`tasks.task.list`** без **`responsibleId`** в теле фильтр **RESPONSIBLE_ID** берётся из того же правила. Для **`user.get`** webhook должен иметь **право на пользователей**. **Личные чаты в разделе «Коммуникации» через этот webhook не отдаются** (см. персональный OAuth ниже). Для **`im.*`** в **диагностике** — отдельные права в настройках webhook. |
| `BITRIX24_TASK_RESPONSIBLE_ID` | **Опционально** (override) | Числовой ID пользователя Bitrix24 — если задан и это положительное целое число, используется **вместо** userId из webhook для `RESPONSIBLE_ID` и `CREATED_BY` **и** для фильтра списка задач, **если** в теле запроса **не** передан валидный **`responsibleId`**. |
| `BITRIX24_COMMUNICATIONS_UNSAFE_SHARED_WEBHOOK_ENABLED` | **Опционально, по умолчанию выключено** | **Устаревший / аварийный** путь для **`POST /api/bitrix24/chat/recent`**, **`/messages`**, **`/send`**, **`/diagnostics`** (общий webhook + `im.*`). По умолчанию эти endpoint’ы возвращают **HTTP 403** `BITRIX24_COMMUNICATIONS_DISABLED`. **Не использовать** для продакшена личных чатов ЛК. Раздел **`#/communications`** использует **персональные** endpoint’ы (`*-personal`, OAuth), а не эти маршруты. |
| `BITRIX24_OAUTH_CLIENT_ID` | **Для персональных чатов (OAuth)** | Client ID локального приложения Bitrix24. Без него, `BITRIX24_OAUTH_CLIENT_SECRET` и `BITRIX24_PORTAL_DOMAIN` раздел «Коммуникации» показывает «OAuth не настроен». |
| `BITRIX24_OAUTH_CLIENT_SECRET` | **Для персональных чатов (OAuth)** | Секрет приложения; только на сервере. |
| `BITRIX24_PORTAL_DOMAIN` | **Для персональных чатов (OAuth)** | Домен портала, например `https://example.bitrix24.ru` (допускается без схемы — сервер добавит `https://`). |
| `BITRIX24_OAUTH_REDIRECT_URI` | **Опционально** | Redirect URI, зарегистрированный в приложении Bitrix24 (часто `https://<хост>/api/bitrix24/oauth/callback`). |
| `BITRIX24_OAUTH_SCOPE` | **Опционально** | Scope для authorize (по умолчанию на сервере: **`im,user`**). |
| `BITRIX24_OAUTH_COOKIE_SECRET` | **Обязательна для сохранения сессии** | Строка для **scrypt**→AES-256-GCM шифрования cookie `b24_personal_sess` (access/refresh token). Без неё OAuth настроен, но **`connected`** остаётся ложным: в **`GET /api/bitrix24/oauth/status`** приходит подсказка в **`message`**. |
| `BITRIX24_LK_PUBLIC_ORIGIN` | **Опционально** | Базовый URL ЛК для редиректа после OAuth (например `https://tandoor-platform.vercel.app`). По умолчанию — тот же хост, что и для **`BITRIX24_OAUTH_REDIRECT_URI`**. |
| `BITRIX24_OAUTH_TOKEN_URL` | **Опционально** | Endpoint обмена `code`/`refresh_token`. По умолчанию **`https://oauth.bitrix.info/oauth/token`** (облако Bitrix24). On-prem — укажите URL вида `https://<портал>/oauth/token/`. |
| `BITRIX24_OAUTH_TOKEN_HTTP_METHOD` | **Опционально** | Если **`post`** — обмен токена через **POST** `application/x-www-form-urlencoded`. По умолчанию — **GET** с query string, как в [официальной документации Bitrix24](https://apidocs.bitrix24.com/settings/oauth/index.html) (без `redirect_uri` в первом запросе). |
| `BITRIX24_OAUTH_TOKEN_INCLUDE_REDIRECT_URI` | **Опционально** | Если **`true`** — в запрос к token endpoint сразу добавляется **`redirect_uri`** (иначе сначала запрос без него, при ошибке — повтор с `redirect_uri`). |

**Важно:** webhook URL, токен и секрет **нельзя** класть в клиентский бандл или в git. На Vercel задайте значения в **Environment Variables** для production / preview. Сервер **не** возвращает и **не** логирует полный webhook URL.

## Как открыть страницу

1. Войти в демо-ЛК Тандор (как обычно).
2. Перейти по hash-маршруту приложения:
   - **`#/bitrix24`** — основной POC;
   - **`#/embedded/bitrix24`** — тот же сценарий с альтернативным путём.

Чтобы включить **встроенный режим** (компактная оболочка):

- Добавьте **`?embedded=bitrix24`** к URL **до** фрагмента с hash, **или** к query внутри hash (оба варианта поддерживаются в POC).

Примеры:

- `https://<host>/?embedded=bitrix24#/bitrix24`
- `https://<host>/#/bitrix24?embedded=bitrix24`

## Какой URL использовать в Bitrix24

В настройках приложения / веб-виджета / `placement` укажите URL вида:

```text
https://<ваш-хост-платформы>/?embedded=bitrix24#/bitrix24
```

Для ссылки «открыть полный ЛК» из Bitrix можно собрать URL через `buildBitrix24OpenTandoorUrl("/dealer-base")` в коде (см. `apps/platform/client/src/lib/bitrix24-integration.ts`).

## Персональные задачи Bitrix24

- В демо-ЛК список и создание задач ориентируются на **персональный** **`bitrixUserId`** текущего пользователя: в **`POST /api/bitrix24/tasks/list`** и **`POST /api/bitrix24/tasks/create`** в теле JSON передаётся опциональное поле **`responsibleId`** (строка или число, **положительное целое**). Если оно валидно, в вызовах Bitrix24 **`tasks.task.list`** / **`tasks.task.add`** используется этот ID для **`RESPONSIBLE_ID`** (и при создании — для **`CREATED_BY`**). Если **`responsibleId`** не передан или равен `null`, сохраняется прежняя цепочка: **`BITRIX24_TASK_RESPONSIBLE_ID`** либо **`userId`** из сегмента **`/rest/<userId>/`** в **`BITRIX24_WEBHOOK_URL`**. Некорректное значение даёт **400** с кодом валидации и **безопасным** текстом на русском (без **`error_description`** из Bitrix24 в ответе для UI).
- **Маппинг** пользователя ЛК → **`bitrixUserId`** в этом PR **статический**, файл **`apps/platform/client/src/lib/bitrix24-user-mapping.ts`**. Его проще заменить на данные из **профиля / backend** без смены остального UI. На production **нельзя** считать переданный с клиента **`responsibleId`** доказательством прав: нужна серверная авторизация и хранение связки на backend; текущий режим — **MVP для демо**.
- **Общий webhook** остаётся **техническим REST-каналом** (одна служебная учётная запись Bitrix24), а персонализация задач достигается явным **`responsibleId`** в методах задач.
- **Чаты** (**`im.*`**) к персональным задачам не относятся: для личных чатов сотрудников нужна **персональная** авторизация Bitrix24 (OAuth и т.п.); общий webhook для отображения личной переписки в ЛК **не** используется (см. также раздел «Раздел «Коммуникации»»).

## Backend: создание тестовой задачи

- **Маршрут:** `POST /api/bitrix24/tasks/test`
- **Метод Bitrix24:** один HTTP POST к `{BITRIX24_WEBHOOK_URL}`**`tasks.task.add`** с телом `{ "fields": { "TITLE": "...", "DESCRIPTION": "...", "RESPONSIBLE_ID", "CREATED_BY", ... } }`.
- **Ответственный:** по умолчанию **userId** из сегмента `/rest/<userId>/` в `BITRIX24_WEBHOOK_URL`; при заданном **`BITRIX24_TASK_RESPONSIBLE_ID`** он подменяет это значение.
- **Чат, уведомления, CRM** в этом POC **не** вызываются (даже если у webhook шире права).
- При ошибке REST Bitrix24 ответ содержит **`code: "BITRIX24_API_ERROR"`**, поле **`bitrixCode`** (код ошибки из Bitrix **без** `error_description`), фиксированное **`message`**; URL webhook и секрет **не** возвращаются.

Если `BITRIX24_WEBHOOK_URL` не задан, API отвечает **503** с понятным JSON (без утечки секретов).

## Backend: создание задачи из карточки дилера / ТТ (MVP)

- **Маршрут:** `POST /api/bitrix24/tasks/create`
- **Тело JSON:** `title` (обязательно, 3–180 символов), `description` (строка, до 4000 символов), `dealerId`, `dealerName` (обязательны), опционально `tradePointId`, `tradePointName`, `returnUrl`, **`responsibleId`** (положительное целое, строка или число).
- **Поле `DESCRIPTION` в Bitrix24** собирается на сервере из: текста `description`; строки «Клиент: …»; при наличии имени точки — «Торговая точка: …»; при наличии `returnUrl` — «Ссылка в ЛК: …».
- **`TITLE`** в Bitrix24 = `title` из запроса.
- **`RESPONSIBLE_ID` / `CREATED_BY`:** при валидном **`responsibleId`** в теле — оба поля равны ему; иначе — как у `/api/bitrix24/tasks/test` (override `BITRIX24_TASK_RESPONSIBLE_ID` или userId из webhook).
- **Успех (200):** `{ "success": true, "taskId": "<строка>", "message": "Задача создана в Bitrix24" }`.
- **Ошибки:** **503** `BITRIX24_NOT_CONFIGURED`; **400** `BITRIX24_WEBHOOK_URL_INVALID` или `BITRIX24_CREATE_VALIDATION_ERROR`; **502** `BITRIX24_API_ERROR` (+ `bitrixCode`), `BITRIX24_BAD_RESPONSE`, `BITRIX24_NETWORK`, `BITRIX24_UNEXPECTED_RESULT`; **500** `INTERNAL_ERROR`.

Vercel-обработчики Bitrix24 для чатов и OAuth сведены в **два** catch-all-файла (`api/bitrix24/chat/[action].ts`, `api/bitrix24/oauth/[action].ts`), которые **импортируют** общую логику из `server/*` (Express использует те же `*-execute.ts` и модули сессии). Отдельные `api/bitrix24/chat/*.ts` и `api/bitrix24/oauth/*.ts` **не** добавляются — лимит serverless-функций. Задачи и пользователи остаются в `api/bitrix24/tasks/*.ts` и `api/bitrix24/users/list.ts`.

## Backend: список задач из Bitrix24 (MVP)

- **Маршрут:** `POST /api/bitrix24/tasks/list`
- **Тело JSON (опционально):** `limit` (по умолчанию 20, 1–50), `onlyOpen` (по умолчанию `true`; при `true` в фильтр Bitrix добавляется **`!REAL_STATUS`: 5**, чтобы исключить завершённые задачи), **`responsibleId`** (положительное целое, строка или число; при передаче в **`tasks.task.list`** в **`filter.RESPONSIBLE_ID`** подставляется этот ID; если не передан — используется **`BITRIX24_TASK_RESPONSIBLE_ID`** или userId из webhook, как раньше).
- **Bitrix24:** `tasks.task.list` с `filter.RESPONSIBLE_ID`, `select` по полям ID, TITLE, DESCRIPTION, STATUS, RESPONSIBLE_ID, CREATED_BY, CREATED_DATE, DEADLINE, CHANGED_DATE, сортировка **`CHANGED_DATE` desc**, пагинация **`start`: 0** (до 50 записей за ответ Bitrix; итог дополнительно обрезается до `limit` на сервере).
- **Успех (200):** `{ "success": true, "tasks": [ { "bitrixTaskId", "title", "description", "status", ... } ] }`.
- **Ошибки:** **503** `BITRIX24_NOT_CONFIGURED`; **400** `BITRIX24_WEBHOOK_URL_INVALID` или `BITRIX24_LIST_VALIDATION_ERROR`; **502** `BITRIX24_API_ERROR` (+ `bitrixCode`), `BITRIX24_BAD_RESPONSE`, `BITRIX24_NETWORK`; **500** `INTERNAL_ERROR`; **405** `METHOD_NOT_ALLOWED`.

## Backend: список пользователей Bitrix24 (MVP, диагностика)

- **Назначение:** быстро увидеть **числовые ID сотрудников** в Bitrix24 для ручного маппинга с пользователями Тандор. Это **диагностический** endpoint, не замена каталога пользователей продукта.
- **Маршрут:** `POST /api/bitrix24/users/list`
- **Тело JSON (опционально):** `search` (строка; подстрока по имени, фамилии, полному имени или email — фильтрация на сервере после **`user.get`**), `limit` (по умолчанию **50**, диапазон **1–100**; при необходимости делается несколько запросов **`user.get`** с шагом **`start`** по 50 записей).
- **Bitrix24:** **`user.get`** (`POST` к `{BITRIX24_WEBHOOK_URL}`**`user.get`**), поля **`select`:** ID, NAME, LAST_NAME, EMAIL, WORK_POSITION, ACTIVE; **`filter`** пустой (весь доступный webhook’у список постранично).
- **Успех (200):** `{ "success": true, "users": [ { "bitrixUserId", "name", "lastName", "fullName", "email", "workPosition", "active" } ] }`.
- **Ошибки:** **405** `METHOD_NOT_ALLOWED`; **503** `BITRIX24_NOT_CONFIGURED`; **400** `BITRIX24_WEBHOOK_URL_INVALID` или `BITRIX24_USERS_VALIDATION_ERROR`; **502** `BITRIX24_API_ERROR` (+ `bitrixCode`, без `error_description` из Bitrix), `BITRIX24_BAD_RESPONSE`, `BITRIX24_NETWORK`; **500** `INTERNAL_ERROR`.
- **Права webhook:** кроме задач, для этого MVP входящий webhook должен включать доступ к **пользователям** и методу **`user.get`** (в интерфейсе создания webhook Bitrix24 отметьте соответствующие права).

Клиентский вызов: **`listBitrix24Users`** в `apps/platform/client/src/lib/bitrix24-integration.ts`. UI: страница **`#/bitrix24`**, блок **«Пользователи Bitrix24»** и таблица **«Связка пользователей ЛК и Bitrix24»** (статический маппинг + ФИО из списка Bitrix при загрузке).

## Backend: диагностика чатов Bitrix24 (MVP, im.*)

- **По умолчанию:** **403** `BITRIX24_COMMUNICATIONS_DISABLED` (общий webhook для `im.*` в ЛК отключён). Ниже — поведение **только** если задан **`BITRIX24_COMMUNICATIONS_UNSAFE_SHARED_WEBHOOK_ENABLED=true`** и настроен webhook.
- **Назначение:** понять, какие методы REST **мессенджера / чатов** (`im.*`) доступны **текущему входящему webhook**, без построения полноценного чата в ЛК. Ответ **не** означает готовность production-интеграции.
- **Маршрут:** `POST /api/bitrix24/chat/diagnostics` (на Vercel тот же handler, что и остальные chat-маршруты: `api/bitrix24/chat/[action].ts`, сегмент пути = `action`).
- **Тело JSON (опционально):** `dialogId` (строка), `message` (строка), `testNotify` (boolean, по умолчанию `false`). **`BITRIX24_TASK_RESPONSIBLE_ID` не используется.**
- **Порядок проверок на сервере:**
  1. **`im.recent.get`** — всегда; тело `{}`; цель — список последних диалогов (если есть права).
  2. **`im.dialog.messages.get`** — только если задан **`dialogId`**; тело `{ DIALOG_ID, LIMIT: 10 }`.
  3. **`im.message.add`** — только если заданы **`dialogId`** и **`message`**; тело `{ DIALOG_ID, MESSAGE }` (длина сообщения ограничена на сервере).
  4. **`im.notify.personal.add`** — только если **`testNotify: true`**; **`USER_ID`** берётся из сегмента **`/rest/<userId>/`** в `BITRIX24_WEBHOOK_URL`; текст фиксированный: «Тестовое уведомление из ЛК Тандор». Если userId извлечь нельзя, в **`diagnostics`** попадает запись об ошибке без вызова Bitrix.
- **Успех (200):** `{ "success": true, "diagnostics": [ { "method", "success", "bitrixCode"?, "message", "sample"? } ] }`. Ошибка одного метода Bitrix **не** переводит HTTP в 502: у соответствующего элемента **`success: false`** и **`bitrixCode`** из Bitrix (без `error_description`). В ответ попадают только **укороченные** `sample` (списки — до 3 элементов, сообщения — до 5, строки до 500 символов).
- **Ошибки уровня endpoint:** **405** `METHOD_NOT_ALLOWED`; **503** `BITRIX24_NOT_CONFIGURED`; **400** `BITRIX24_WEBHOOK_URL_INVALID` (некорректный базовый URL) или **`BITRIX24_CHAT_DIAGNOSTICS_VALIDATION`** (неверные типы полей тела); **500** `INTERNAL_ERROR`.
- **Права webhook (ориентир):** в Bitrix24 при создании/редактировании входящего webhook нужно явно включать доступ к **чату / мессенджеру** и к методам вроде **`im.recent.get`**, **`im.dialog.messages.get`**, **`im.message.add`**, **`im.notify.personal.add`** — точный набор зависит от редакции портала; при `insufficient_scope` или `ERROR_METHOD_NOT_FOUND` смотрите **`bitrixCode`** в элементе **`diagnostics`**.

Клиентский вызов: **`runBitrix24ChatDiagnostics`** в `bitrix24-integration.ts`. UI: **`#/bitrix24`**, блок **«Диагностика чатов Bitrix24»**.

## Раздел «Коммуникации» и персональный OAuth Bitrix24

### Почему общий webhook нельзя использовать для личных чатов ЛК

Входящий **`BITRIX24_WEBHOOK_URL`** выполняется от **одного** пользователя портала (того, чей `userId` в пути `/rest/<userId>/…`). Методы **`im.recent.get`**, **`im.dialog.messages.get`**, **`im.message.add`** в этом контексте отражают **его** личные и рабочие диалоги. Любой, кто может вызвать ваш backend без привязки к конкретному сотруднику ЛК, потенциально получает доступ к этим данным. Поэтому **раздел «Коммуникации» в ЛК не использует общий webhook** для списка чатов и переписки.

**Устаревшие endpoint’ы (deprecated для продукта «Коммуникации»):** **`POST /api/bitrix24/chat/recent`**, **`POST /api/bitrix24/chat/messages`**, **`POST /api/bitrix24/chat/send`**, **`POST /api/bitrix24/chat/diagnostics`** — по-прежнему отключены по умолчанию (**403** `BITRIX24_COMMUNICATIONS_DISABLED`), пока **`BITRIX24_COMMUNICATIONS_UNSAFE_SHARED_WEBHOOK_ENABLED`** не равна **`"true"`**. Включение допустимо только для ручной диагностики администратором, не для показа чатов сотрудникам в ЛК.

### Доступ в ЛК

Пункт **«Коммуникации»** и маршрут **`#/communications`** доступны **всем основным ролям** (менеджер, РОП, директор продаж, маркетолог, аналитик): раздел виден всем, а **данные** появляются после персонального OAuth и **`connected: true`** в **`GET /api/bitrix24/oauth/status`** (валидная HttpOnly-cookie сессии). См. `canAccessCommunications` в `apps/platform/client/src/lib/auth-access.ts`.

### OAuth-приложение в Bitrix24 (локальное)

1. В портале Bitrix24: **Разработчикам** → **Другое** → **Локальное приложение** (или актуальный путь в вашей редакции).
2. Укажите **Redirect URI** ровно тот, что в env **`BITRIX24_OAUTH_REDIRECT_URI`**, либо значение по умолчанию на сервере: **`https://tandoor-platform.vercel.app/api/bitrix24/oauth/callback`** (для preview/staging — свой хост и тот же путь **`/api/bitrix24/oauth/callback`**).
3. **Права (scope)** для списка диалогов, сообщений и отправки: в authorize передаётся **`BITRIX24_OAUTH_SCOPE`** или по умолчанию **`im,user`** (`im` — методы мессенджера; **`user`** — для **`user.current`** при первом сохранении сессии и отображения ФИО в статусе).
4. Скопируйте **client_id** и **client_secret** в переменные **`BITRIX24_OAUTH_CLIENT_ID`** и **`BITRIX24_OAUTH_CLIENT_SECRET`**. **`BITRIX24_PORTAL_DOMAIN`** — базовый URL портала, например `https://ваш-портал.bitrix24.ru`.

> **Реализация на Vercel.** Чтобы не упираться в лимит **12 serverless functions** на Hobby-плане, чат- и OAuth-эндпоинты объединены в **dynamic catch-all**: **`apps/platform/api/bitrix24/chat/[action].ts`** обслуживает `recent`, `messages`, `send`, `diagnostics`, `recent-personal`, `messages-personal`, `send-personal`; **`apps/platform/api/bitrix24/oauth/[action].ts`** — `status`, `start`, `callback`. Публичные URL и поведение **не** изменились.

### Endpoint’ы OAuth и персональных чатов (рабочий MVP)

| Метод и путь | Назначение |
|--------------|------------|
| `GET /api/bitrix24/oauth/status` | **`configured`**: заданы client id/secret и portal domain. **`connected`**: расшифрована cookie **`b24_personal_sess`** и токен ещё пригоден (или удалось обновить по refresh). Поле **`user`**: `bitrixUserId`, `name` (из сессии или **`user.current`**). Без **`BITRIX24_OAUTH_COOKIE_SECRET`** сессию сохранить нельзя — в ответе подсказка в **`message`** / **`serverHint`**, **`connected`** остаётся ложным. |
| `GET /api/bitrix24/oauth/start` | **503** `BITRIX24_OAUTH_NOT_CONFIGURED`, если не хватает OAuth env. Иначе **200**, **`redirectUrl`** на **`{PORTAL}/oauth/authorize/`**; HttpOnly **`b24_oauth_state`** (Path=`/api/bitrix24/oauth`, SameSite=Lax). |
| `GET /api/bitrix24/oauth/callback` | Обмен **`code`** на токены, проверка **`state`**, cookie **`b24_personal_sess`**. Успех: **302** на **`/?bitrix24=connected#/communications`**. Ошибки: **302** на **`/?bitrix24=error&code=…&bitrixCode=…#/communications`** с точным кодом (`BITRIX24_OAUTH_TOKEN_ERROR`, `BITRIX24_OAUTH_STATE_MISMATCH`, …). **`BITRIX24_OAUTH_CALLBACK_FAILED`** — только при неизвестном исключении; в логах Vercel ищите **`[bitrix24] oauth.callback:`** (шаги `callback:start`, `token-request:failed` с `method`/`httpStatus`/`includeRedirectUri`, без code/token/secret). |
| `POST /api/bitrix24/oauth/disconnect` | Сбрасывает cookie сессии и state в этом браузере (**200**). |
| `POST /api/bitrix24/chat/recent-personal` | **`im.recent.get`** с **`?auth=`** персонального access_token из cookie. При истечении access — refresh, обновление cookie, повтор. **401**: **`BITRIX24_OAUTH_NOT_CONNECTED`** / **`BITRIX24_OAUTH_EXPIRED`**. |
| `POST /api/bitrix24/chat/messages-personal` | Тело `{ dialogId, limit? }` → **`im.dialog.messages.get`**. Та же схема refresh и ошибок. |
| `POST /api/bitrix24/chat/send-personal` | Тело `{ dialogId, message }` → **`im.message.add`**. Та же схема. |

Токены **не** отдаются в JSON и **не** кладутся в `localStorage` / `sessionStorage`; только HttpOnly cookie на сервере (AES-GCM, ключ из **`BITRIX24_OAUTH_COOKIE_SECRET`** через scrypt). Последний выбранный диалог в UI может кэшироваться в **`sessionStorage`** (`tandoor-communications-last-dialog-v1`) — без токенов.

### Клиентские функции

В `apps/platform/client/src/lib/bitrix24-integration.ts`: **`getBitrix24OAuthStatus`**, **`startBitrix24OAuth`**, **`disconnectBitrix24OAuth`**, **`listBitrix24PersonalChats`**, **`getBitrix24PersonalMessages`**, **`sendBitrix24PersonalMessage`**. Старые вызовы общего webhook (**`listBitrix24RecentChats`** и т.д.) на **`#/communications`** **не** используются.

### Статус MVP

- UI: **не настроен** / **подключите** / **подключено** (список диалогов, сообщения, отправка); при **401** — «Подключите Bitrix24 заново».
- Общий webhook для личных чатов в «Коммуникациях» **не** используется; устаревшие маршруты **`recent`/`messages`/`send`/`diagnostics`** — **403** по умолчанию.

### Устаревшие endpoint’ы (общий webhook, im.*)

| Endpoint Тандор | Метод REST Bitrix24 | Статус |
|-----------------|---------------------|--------|
| `POST /api/bitrix24/chat/recent` | **`im.recent.get`** | Deprecated для ЛК; по умолчанию **403** `BITRIX24_COMMUNICATIONS_DISABLED` |
| `POST /api/bitrix24/chat/messages` | **`im.dialog.messages.get`** | То же |
| `POST /api/bitrix24/chat/send` | **`im.message.add`** | То же |
| `POST /api/bitrix24/chat/diagnostics` | несколько **`im.*`** | То же (**403** по умолчанию) |

### Как проверить (ручной сценарий)

1. В Vercel задайте **`BITRIX24_OAUTH_*`**, **`BITRIX24_PORTAL_DOMAIN`**, **`BITRIX24_OAUTH_COOKIE_SECRET`** (достаточно длинная случайная строка).
2. Без полного набора OAuth env: **`#/communications`** — «OAuth Bitrix24 не настроен на сервере».
3. С полным набором: «Подключить Bitrix24» → **`/api/bitrix24/oauth/start`** → редирект на портал → после входа callback → **`#/communications?bitrix24=connected`**, **`connected: true`**, список диалогов (**`im.recent.get`**).
4. Открыть диалог — сообщения (**`im.dialog.messages.get`**); при реализованной отправке — **`im.message.add`**.
5. **`POST /api/bitrix24/oauth/disconnect`** или кнопка в UI — сброс cookie; снова нужен OAuth.
6. **`curl -i -X POST .../api/bitrix24/chat/recent`** без unsafe — **403** `BITRIX24_COMMUNICATIONS_DISABLED`.
7. **`curl -i -X POST .../api/bitrix24/chat/recent-personal`** **без** cookie сессии — **401** `BITRIX24_OAUTH_NOT_CONNECTED`.

### Задел под задачи и клиентов

Если в элементе списка чатов приходит **`entityType: "TASKS_TASK"`** и **`entityId`**, в UI показываются бейдж **«Задача»** и строка **«Задача Bitrix24: {entityId}»**. Полноценная привязка чата к карточке клиента в этом PR **не** делается.

## ЛК: где создавать задачу и где видна связь

- **Карточка дилера** (`#/dealers/...`): блок «Задачи Bitrix24» после секции «Следующий шаг»; кнопки «Создать…» и «Загрузить из Bitrix24» (и чекбокс «Только открытые») — при **`canEditClientNextStep`** и при **настроенной связке** пользователя ЛК с Bitrix24 (иначе показывается предупреждение, кнопки скрыты). Список импортированных задач виден всем, кто видит карточку, если в браузере уже есть данные импорта. Задачи с тем же `bitrixTaskId`, что в списке «Поставленные из ЛК», в блоке импорта не дублируются.
- **Карточка торговой точки** (`#/dealers/.../trade-points/...`): такой же блок после витринной матрицы точки; импорт и создание — по тем же правилам, что и на карточке дилера (в т.ч. связка с Bitrix24).
- **Хранение связи (созданные из ЛК):** ключ `localStorage` **`tandoor-bitrix24-task-links-v1`**, структура `linksByDealer` и `linksByTradePoint` (ключ точки: `` `${dealerId}|${tradePointId}` ``). Событие обновления списка: **`tandoor-bitrix24-task-links-changed`**. Код: `apps/platform/client/src/lib/bitrix24-task-links.ts`.
- **Хранение импорта из Bitrix24:** ключ **`tandoor-bitrix24-imported-tasks-v1`**, событие **`tandoor-bitrix24-imported-tasks-changed`**. Код: `apps/platform/client/src/lib/bitrix24-imported-tasks.ts`. Клиентский вызов списка: **`listBitrix24Tasks`** в `bitrix24-integration.ts`.

Это **MVP:** статусы задач в Bitrix24 в ЛК не подтягиваются, входящие события Bitrix24 не обрабатываются.

### Production на Vercel

Статический вывод (`outputDirectory: dist/public`) **не** запускает собранный Express (`dist/index.cjs`). Раньше в `vercel.json` был rewrite **`/(.*) → /index.html`**, из‑за чего запросы к **`/api/...`** отдавали SPA (`index.html`), в том числе **405** на POST.

Сейчас:

- **`buildCommand`:** `npm run build` — собираются и клиент (`vite`), и серверный бандл для Node.
- **Rewrite на все пути удалён** — приложение на **hash-router** (`#/…`), для основного сценария отдельный SPA-fallback не нужен.
- **Serverless Functions** Vercel для Bitrix24:
  - **Задачи и пользователи** (как раньше, по одному файлу на маршрут): `api/bitrix24/tasks/test.ts`, `create.ts`, `list.ts`, `api/bitrix24/users/list.ts` — логика в **`server/*-execute.ts`**, импорт из `server/` допустим и используется.
  - **Чаты и OAuth** — два catch-all, чтобы не превышать лимит числа функций: **`api/bitrix24/chat/[action].ts`** и **`api/bitrix24/oauth/[action].ts`**. Они делегируют в **`server/bitrix24-vercel-chat-entry.ts`** / **`server/bitrix24-vercel-oauth-entry.ts`**, которые по сегменту пути (параметр **`action`**) вызывают те же **`run*`**-модули, что и Express в **`server/bitrix24-routes.ts`**. Примеры URL: **`/api/bitrix24/chat/recent-personal`**, **`/api/bitrix24/oauth/callback`**.
- Ответы API — JSON с **`Content-Type: application/json; charset=utf-8`**, кроме **302** редиректа после успешного OAuth callback.
- В **`package.json`** задано **`"engines": { "node": "20.x" }`**, чтобы на Vercel использовался **Node 20**.

Локально Express: **`server/bitrix24-routes.ts`**; общая логика OAuth/чатов — **`server/bitrix24-oauth-*.ts`**, **`server/bitrix24-chat-*-personal-execute.ts`**, **`server/bitrix24-oauth-session-service.ts`**, **`server/bitrix24-oauth-crypto-cookie.ts`**, **`server/bitrix24-oauth-token-http.ts`**.

Проверка с production (ожидается JSON, не HTML):

```bash
curl -i -X POST "https://tandoor-platform.vercel.app/api/bitrix24/tasks/test" \
  -H "content-type: application/json" \
  --data "{}"
```

При отсутствии `BITRIX24_WEBHOOK_URL` в env ответ должен быть **503** с телом вида `{"success":false,"code":"BITRIX24_NOT_CONFIGURED",...}`. Некорректный базовый URL (например, с `profile.json` или без `/rest/`) — **400** и код `BITRIX24_WEBHOOK_URL_INVALID`.

## Как проверить создание задачи

1. Убедитесь, что на окружении задан `BITRIX24_WEBHOOK_URL` (и при необходимости `BITRIX24_TASK_RESPONSIBLE_ID`).
2. Откройте `#/bitrix24`, нажмите **«Создать тестовую задачу в Bitrix24»**.
3. При успехе отобразится текст **«Тестовая задача создана в Bitrix24»** и **ID задачи**, если Bitrix24 вернул его в ответе.
4. Проверьте список задач в Bitrix24 у ответственного / в общем разделе задач портала.

### MVP из карточки клиента / точки

1. Войдите ролью с правом записи по клиенту (менеджер «своего» клиента, РОП команды или директор продаж).
2. Откройте карточку дилера или торговой точки, найдите блок **«Задачи Bitrix24»**, нажмите **«Создать задачу в Bitrix24»**, заполните заголовок и при необходимости описание.
3. После успеха задача появится в списке в ЛК (данные в `localStorage` этого браузера) и в Bitrix24 на портале.
4. Нажмите **«Загрузить из Bitrix24»** (при необходимости снимите «Только открытые»). После успеха задачи появятся во втором блоке «Задачи из Bitrix24»; список общий для браузера (не привязан к конкретному дилеру на сервере). Задачи с тем же ID, что уже в «Поставленные из ЛК», во втором блоке скрываются.

## Права API на следующем шаге (ориентир)

Сейчас используются **`tasks.task.add`**, **`tasks.task.list`**, диагностический **`user.get`** (через webhook). Методы **`im.recent.get`**, **`im.dialog.messages.get`**, **`im.message.add`** в **разделе «Коммуникации»** вызываются **только с персональным OAuth access_token** (не через общий webhook). Диагностический **`im.notify.personal.add`** — только если включён unsafe-флаг и вызывается **`POST /api/bitrix24/chat/diagnostics`**. Дальше по продукту могут понадобиться отдельные scope под CRM и т.д.

## Рекомендации по безопасности после теста

1. **Удалить** временный входящий webhook, созданный для эксперимента.
2. Создать **новый** webhook с **минимально необходимыми** правами (например, только задачи, если Bitrix24 позволяет сузить scope).
3. По возможности выносить интеграцию на **серверный backend** с собственной авторизацией пользователя Тандор, а не полагаться только на длинный URL webhook.

## Ограничения POC

- Параметры `DOMAIN` и др. из Bitrix читаются из URL **если** портал их добавит; иначе контекст пустой.
- Навигация на другие разделы ЛК сохраняет `embedded=bitrix24` только если ссылки собраны с этим query (на странице POC ссылки уже с маркером).
- Некоторые кнопки ведут в разделы с **RBAC по роли** (например, «Задачи» или «KPI» могут быть недоступны роли «маркетолог» — сработает стандартный редирект на домашний маршрут).
