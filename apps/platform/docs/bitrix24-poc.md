# POC: Тандор внутри Bitrix24

## Что проверяет POC

- Можно ли открывать ЛК Тандор **в iframe или слайдере Bitrix24** как отдельную оболочку входа, **без переноса** всего приложения внутрь Bitrix24.
- Удобство **облегчённого chrome** (`?embedded=bitrix24`): без боковой навигации и тяжёлой шапки.
- **Реальное создание тестовой задачи** в Bitrix24 через сервер Тандор: вызывается только метод REST **`tasks.task.add`** (входящий webhook URL хранится в `process.env.BITRIX24_WEBHOOK_URL` на сервере, не в клиенте).
- **MVP «задачи из ЛК»:** менеджер с правами записи по клиенту может создать задачу в Bitrix24 из **карточки дилера** или **карточки торговой точки** (`POST /api/bitrix24/tasks/create`). Связь «что создано» хранится **только в браузере** (`localStorage`), без обратной синхронизации статусов из Bitrix24 и без входящих webhook от Bitrix24.
- **MVP «список из Bitrix24»:** по кнопке «Загрузить из Bitrix24» вызывается **`POST /api/bitrix24/tasks/list`** (метод Bitrix24 **`tasks.task.list`** по тому же webhook). Результат кэшируется в **`localStorage`** (`tandoor-bitrix24-imported-tasks-v1`). Это **ручной** импорт, без realtime и без сопоставления задач с дилером/ТТ по сложным правилам (автолинковка по описанию не делается).
- **MVP «пользователи Bitrix24» (диагностика):** на странице **`#/bitrix24`** блок **«Пользователи Bitrix24»** вызывает **`POST /api/bitrix24/users/list`** (метод **`user.get`**). Нужен только для **сопоставления** `userId` Тандор ↔ `bitrixUserId` в Bitrix24; не хранит маппинг на сервере и не подменяет авторизацию.
- **MVP «диагностика чатов» (im.*):** на **`#/bitrix24`** блок **«Диагностика чатов Bitrix24»** вызывает **`POST /api/bitrix24/chat/diagnostics`**. Это **не** встроенный чат ЛК, а набор безопасных проб REST (**`im.recent.get`**, при наличии `dialogId` — **`im.dialog.messages.get`**, при `dialogId`+`message` — **`im.message.add`**, при `testNotify: true` — **`im.notify.personal.add`**) для проверки прав webhook. Ошибки по отдельным методам не роняют ответ: в JSON приходит массив **`diagnostics`** с результатом по каждому вызову.
- **MVP «раздел Коммуникации»:** пункт **«Коммуникации»** (`#/communications`) и чтение/отправка через Bitrix24 — **временно только для роли «директор продаж»** (`sales_director` в демо-ЛК): общий webhook отдаёт **личные чаты пользователя Bitrix24, которому принадлежит webhook**, поэтому доступ для остальных ролей закрыт (см. раздел «Ограничение доступа к Коммуникациям»). Боевые API: **`POST /api/bitrix24/chat/recent`**, **`POST /api/bitrix24/chat/messages`**, **`POST /api/bitrix24/chat/send`**. Диагностический **`/api/bitrix24/chat/diagnostics`** для UI раздела не используется.

## Переменные окружения (только сервер)

| Переменная | Обязательность | Назначение |
|------------|----------------|------------|
| `BITRIX24_WEBHOOK_URL` | **Обязательна** для серверных операций с задачами, списком пользователей, **разделом «Коммуникации»** и **диагностикой чатов** Bitrix24 (POC и MVP) | Полный базовый URL входящего webhook (как в Bitrix24, сегмент **`/rest/<userId>/<token>/`**). Из **`userId`** в URL автоматически выставляются **ответственный** и **постановщик** задачи (`RESPONSIBLE_ID` / `CREATED_BY`), если не задан override ниже. Для **`tasks.task.list`** фильтр **RESPONSIBLE_ID** берётся из того же правила (override или userId из URL). Для **`user.get`** webhook должен иметь **право на пользователей**. Для **`im.*`** и уведомлений — отдельные права чата/мессенджера в настройках webhook (см. разделы «Диагностика чатов» и «Раздел Коммуникации»). |
| `BITRIX24_TASK_RESPONSIBLE_ID` | **Опционально** (override) | Числовой ID пользователя Bitrix24 — если задан и это положительное целое число, используется **вместо** userId из webhook для `RESPONSIBLE_ID` и `CREATED_BY`. |

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

## Backend: создание тестовой задачи

- **Маршрут:** `POST /api/bitrix24/tasks/test`
- **Метод Bitrix24:** один HTTP POST к `{BITRIX24_WEBHOOK_URL}`**`tasks.task.add`** с телом `{ "fields": { "TITLE": "...", "DESCRIPTION": "...", "RESPONSIBLE_ID", "CREATED_BY", ... } }`.
- **Ответственный:** по умолчанию **userId** из сегмента `/rest/<userId>/` в `BITRIX24_WEBHOOK_URL`; при заданном **`BITRIX24_TASK_RESPONSIBLE_ID`** он подменяет это значение.
- **Чат, уведомления, CRM** в этом POC **не** вызываются (даже если у webhook шире права).
- При ошибке REST Bitrix24 ответ содержит **`code: "BITRIX24_API_ERROR"`**, поле **`bitrixCode`** (код ошибки из Bitrix **без** `error_description`), фиксированное **`message`**; URL webhook и секрет **не** возвращаются.

Если `BITRIX24_WEBHOOK_URL` не задан, API отвечает **503** с понятным JSON (без утечки секретов).

## Backend: создание задачи из карточки дилера / ТТ (MVP)

- **Маршрут:** `POST /api/bitrix24/tasks/create`
- **Тело JSON:** `title` (обязательно, 3–180 символов), `description` (строка, до 4000 символов), `dealerId`, `dealerName` (обязательны), опционально `tradePointId`, `tradePointName`, `returnUrl`.
- **Поле `DESCRIPTION` в Bitrix24** собирается на сервере из: текста `description`; строки «Клиент: …»; при наличии имени точки — «Торговая точка: …»; при наличии `returnUrl` — «Ссылка в ЛК: …».
- **`TITLE`** в Bitrix24 = `title` из запроса.
- **`RESPONSIBLE_ID` / `CREATED_BY`:** та же логика, что у `/api/bitrix24/tasks/test` (override `BITRIX24_TASK_RESPONSIBLE_ID` или userId из webhook).
- **Успех (200):** `{ "success": true, "taskId": "<строка>", "message": "Задача создана в Bitrix24" }`.
- **Ошибки:** **503** `BITRIX24_NOT_CONFIGURED`; **400** `BITRIX24_WEBHOOK_URL_INVALID` или `BITRIX24_CREATE_VALIDATION_ERROR`; **502** `BITRIX24_API_ERROR` (+ `bitrixCode`), `BITRIX24_BAD_RESPONSE`, `BITRIX24_NETWORK`, `BITRIX24_UNEXPECTED_RESULT`; **500** `INTERNAL_ERROR`.

Каждая Vercel-функция (`api/bitrix24/tasks/test.ts`, `api/bitrix24/tasks/create.ts`, `api/bitrix24/tasks/list.ts`, `api/bitrix24/users/list.ts`, `api/bitrix24/chat/diagnostics.ts`, `api/bitrix24/chat/recent.ts`, `api/bitrix24/chat/messages.ts`, `api/bitrix24/chat/send.ts`) **самодостаточна**: вся логика валидации и вызова Bitrix24 продублирована внутри файла. В директории `api/` намеренно нет ни одного не-handler .ts-файла — на этом проекте любые межфайловые импорты внутри `api/` (включая `api/_lib/*` с префиксом подчёркивания) приводили к `FUNCTION_INVOCATION_FAILED` в Vercel runtime. Express-маршруты в `server/bitrix24-*-execute.ts` тоже самодостаточны и не зависят от `api/`. Дублирование намеренное — это цена надёжной работы serverless-функций в текущей конфигурации Vercel.

## Backend: список задач из Bitrix24 (MVP)

- **Маршрут:** `POST /api/bitrix24/tasks/list`
- **Тело JSON (опционально):** `limit` (по умолчанию 20, 1–50), `onlyOpen` (по умолчанию `true`; при `true` в фильтр Bitrix добавляется **`!REAL_STATUS`: 5**, чтобы исключить завершённые задачи).
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

Клиентский вызов: **`listBitrix24Users`** в `apps/platform/client/src/lib/bitrix24-integration.ts`. UI: страница **`#/bitrix24`**, блок **«Пользователи Bitrix24»**.

## Backend: диагностика чатов Bitrix24 (MVP, im.*)

- **Назначение:** понять, какие методы REST **мессенджера / чатов** (`im.*`) доступны **текущему входящему webhook**, без построения полноценного чата в ЛК. Ответ **не** означает готовность production-интеграции.
- **Маршрут:** `POST /api/bitrix24/chat/diagnostics`
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

## Раздел «Коммуникации» (MVP, im.*)

**Назначение:** показать последние чаты Bitrix24, прочитать сообщения выбранного диалога и отправить сообщение **от имени пользователя, привязанного к входящему webhook** (как в POC: сообщения уходят от userId из сегмента `/rest/<userId>/` в URL). Отдельной базы сообщений в ЛК нет; обновление списка и переписки в MVP **только вручную** (кнопки «Обновить»), без polling.

### Ограничение доступа к Коммуникациям

Входящий **общий** webhook Bitrix24 выполняется от **одного** пользователя портала (того, чей `userId` в пути webhook). Метод **`im.recent.get`** и связанные вызовы возвращают **его** диалоги и сообщения — в том числе личные чаты. Показ такого потока **всем сотрудникам** ЛК недопустим.

**Hotfix:** раздел **`#/communications`** и пункт меню **«Коммуникации»** доступны **только роли «директор продаж»** (`sales_director` в демо-auth), как наиболее широкой управленческой роли без отдельного `admin` в коде. Остальные роли не видят пункт меню; прямой переход на маршрут блокируется **`canAccessPath`** (редирект на домашний маршрут роли). **API** (`/api/bitrix24/chat/*`) не отключались — ими может пользоваться тот же сервер/админ для проверки.

**Целевая production-логика (не в этом PR):** каждый сотрудник должен подключать Bitrix24 **персонально** (OAuth или отдельный токен/приложение на пользователя), чтобы `im.*` отражали **его** контекст. Общий webhook при этом остаётся допустимым для **системных** сценариев (например, создание задач от имени интеграции), но **не** для отображения личной переписки в ЛК.

### Методы Bitrix24

| Endpoint Тандор | Метод REST Bitrix24 | Назначение |
|-----------------|---------------------|------------|
| `POST /api/bitrix24/chat/recent` | **`im.recent.get`** | Последние чаты, нормализованный массив **`chats`** |
| `POST /api/bitrix24/chat/messages` | **`im.dialog.messages.get`** | Сообщения диалога (`dialogId`, опционально `limit` 1–50, по умолчанию 30). Текст сообщений на сервере приводится к **plain text** (снятие BBCode) для безопасного отображения в UI без `dangerouslySetInnerHTML`. |
| `POST /api/bitrix24/chat/send` | **`im.message.add`** | Отправка сообщения в диалог (`dialogId`, `message` после trim, 1–2000 символов). |

### Права webhook (ориентир)

В настройках входящего webhook Bitrix24 должны быть разрешены **мессенджер / чат** и методы **`im.recent.get`**, **`im.dialog.messages.get`**, **`im.message.add`**. Точный набор зависит от редакции портала. При ошибке с кодом вроде **`insufficient_scope`** в ЛК показывается понятное сообщение на русском (без `error_description` из Bitrix в ответе API для UI).

### Ошибки (единый стиль с задачами)

Для перечисленных endpoint’ов: **405** `METHOD_NOT_ALLOWED`; **503** `BITRIX24_NOT_CONFIGURED`; **400** `BITRIX24_WEBHOOK_URL_INVALID` или код валидации тела (`BITRIX24_CHAT_MESSAGES_VALIDATION`, `BITRIX24_CHAT_SEND_VALIDATION`); **502** `BITRIX24_API_ERROR` (опционально **`bitrixCode`**, без URL и без секрета в логах — в лог пишется только **`bitrixCode`**); **500** `INTERNAL_ERROR`. Webhook, токен и полный URL **не** возвращаются в JSON и **не** логируются.

### Клиент

Функции в `apps/platform/client/src/lib/bitrix24-integration.ts`: **`listBitrix24RecentChats`**, **`getBitrix24ChatMessages`**, **`sendBitrix24ChatMessage`** (экспортируемые типы **`Bitrix24RecentChatDto`**, **`Bitrix24ChatMessageDto`**). Страница: `apps/platform/client/src/pages/communications.tsx`, маршрут **`#/communications`**. Пункт меню **«Коммуникации»** и доступ к маршруту — **только для `sales_director`** (см. `canAccessCommunications` / `canAccessPath` в `apps/platform/client/src/lib/auth-access.ts`). На странице выводится предупреждение о временном режиме и общем webhook; на мобильной ширине список чатов и переписка переключаются по шагам с кнопкой **«Назад к чатам»**. В `localStorage` может храниться только **последний выбранный `dialogId`** (`tandoor-communications-last-dialog-v1`).

### Как проверить

1. Задайте на сервере **`BITRIX24_WEBHOOK_URL`** с правами на **`im.*`** (см. выше).
2. Войдите в ЛК **ролью директора продаж** (в демо-auth — `sales_director`) и откройте **`#/communications`**.
3. Нажмите **«Обновить»** в блоке чатов — должен появиться список диалогов из Bitrix24.
4. Выберите чат — загрузятся сообщения; при необходимости нажмите **«Обновить сообщения»**.
5. Введите текст и нажмите **«Отправить»** — сообщение уходит в Bitrix24, поле ввода очищается, список сообщений обновляется, показывается уведомление «Сообщение отправлено».

### Задел под задачи и клиентов

Если в элементе списка чатов приходит **`entityType: "TASKS_TASK"`** и **`entityId`**, в UI показываются бейдж **«Задача»** и строка **«Задача Bitrix24: {entityId}»**. Полноценная привязка чата к карточке клиента в этом PR **не** делается.

## ЛК: где создавать задачу и где видна связь

- **Карточка дилера** (`#/dealers/...`): блок «Задачи Bitrix24» после секции «Следующий шаг»; кнопки «Создать…» и «Загрузить из Bitrix24» (и чекбокс «Только открытые») — при **`canEditClientNextStep`**. Список импортированных задач виден всем, кто видит карточку, если в браузере уже есть данные импорта. Задачи с тем же `bitrixTaskId`, что в списке «Поставленные из ЛК», в блоке импорта не дублируются.
- **Карточка торговой точки** (`#/dealers/.../trade-points/...`): такой же блок после витринной матрицы точки; импорт и создание — по тем же правилам, что и на карточке дилера.
- **Хранение связи (созданные из ЛК):** ключ `localStorage` **`tandoor-bitrix24-task-links-v1`**, структура `linksByDealer` и `linksByTradePoint` (ключ точки: `` `${dealerId}|${tradePointId}` ``). Событие обновления списка: **`tandoor-bitrix24-task-links-changed`**. Код: `apps/platform/client/src/lib/bitrix24-task-links.ts`.
- **Хранение импорта из Bitrix24:** ключ **`tandoor-bitrix24-imported-tasks-v1`**, событие **`tandoor-bitrix24-imported-tasks-changed`**. Код: `apps/platform/client/src/lib/bitrix24-imported-tasks.ts`. Клиентский вызов списка: **`listBitrix24Tasks`** в `bitrix24-integration.ts`.

Это **MVP:** статусы задач в Bitrix24 в ЛК не подтягиваются, входящие события Bitrix24 не обрабатываются.

### Production на Vercel

Статический вывод (`outputDirectory: dist/public`) **не** запускает собранный Express (`dist/index.cjs`). Раньше в `vercel.json` был rewrite **`/(.*) → /index.html`**, из‑за чего запросы к **`/api/...`** отдавали SPA (`index.html`), в том числе **405** на POST.

Сейчас:

- **`buildCommand`:** `npm run build` — собираются и клиент (`vite`), и серверный бандл для Node.
- **Rewrite на все пути удалён** — приложение на **hash-router** (`#/…`), для основного сценария отдельный SPA-fallback не нужен.
- **`POST /api/bitrix24/tasks/test`**, **`POST /api/bitrix24/tasks/create`**, **`POST /api/bitrix24/tasks/list`**, **`POST /api/bitrix24/users/list`**, **`POST /api/bitrix24/chat/diagnostics`**, **`POST /api/bitrix24/chat/recent`**, **`POST /api/bitrix24/chat/messages`**, **`POST /api/bitrix24/chat/send`** обрабатываются **Serverless Functions** Vercel: `api/bitrix24/tasks/test.ts`, `create.ts`, `list.ts`, `api/bitrix24/users/list.ts`, `api/bitrix24/chat/diagnostics.ts`, `api/bitrix24/chat/recent.ts`, `messages.ts`, `send.ts`. Каждый файл **полностью самодостаточен** — вообще никаких импортов из `server/*`, `client/*`, `api/_lib/*` или path-алиасов `@/`. В `api/` нет ни одного вспомогательного модуля. Ответ всегда JSON и `Content-Type: application/json; charset=utf-8`. Так гарантировано не повторится `FUNCTION_INVOCATION_FAILED`, наблюдавшийся после PR #106 и PR #107, когда handler'ы импортировали соседние ts-файлы внутри `api/`.
- В **`package.json`** задано **`"engines": { "node": "20.x" }`**, чтобы на Vercel использовался **Node 20** вместо «плавающего» runtime по умолчанию.

Локально по-прежнему работает Express: `server/bitrix24-routes.ts` регистрирует маршруты; логика в `server/bitrix24-tasks-test-execute.ts`, `server/bitrix24-tasks-create-execute.ts`, `server/bitrix24-tasks-list-execute.ts`, `server/bitrix24-users-list-execute.ts`, `server/bitrix24-chat-diagnostics-execute.ts`, `server/bitrix24-chat-recent-execute.ts`, `server/bitrix24-chat-messages-execute.ts` и `server/bitrix24-chat-send-execute.ts` (самодостаточные модули, без импортов из `api/`).

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

Сейчас используются **`tasks.task.add`**, **`tasks.task.list`**, диагностический **`user.get`**, а также **`im.recent.get`**, **`im.dialog.messages.get`**, **`im.message.add`** через **раздел «Коммуникации»** и диагностический **`im.notify.personal.add`** (только через **`POST /api/bitrix24/chat/diagnostics`**). Дальше по продукту могут понадобиться отдельные scope под CRM и т.д. — подключать по мере сценариев, не расширяя webhook «на всякий случай».

## Рекомендации по безопасности после теста

1. **Удалить** временный входящий webhook, созданный для эксперимента.
2. Создать **новый** webhook с **минимально необходимыми** правами (например, только задачи, если Bitrix24 позволяет сузить scope).
3. По возможности выносить интеграцию на **серверный backend** с собственной авторизацией пользователя Тандор, а не полагаться только на длинный URL webhook.

## Ограничения POC

- Параметры `DOMAIN` и др. из Bitrix читаются из URL **если** портал их добавит; иначе контекст пустой.
- Навигация на другие разделы ЛК сохраняет `embedded=bitrix24` только если ссылки собраны с этим query (на странице POC ссылки уже с маркером).
- Некоторые кнопки ведут в разделы с **RBAC по роли** (например, «Задачи» или «KPI» могут быть недоступны роли «маркетолог» — сработает стандартный редирект на домашний маршрут).
