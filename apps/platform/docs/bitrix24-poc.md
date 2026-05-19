# POC: Тандор внутри Bitrix24

## Что проверяет POC

- Можно ли открывать ЛК Тандор **в iframe или слайдере Bitrix24** как отдельную оболочку входа, **без переноса** всего приложения внутрь Bitrix24.
- Удобство **облегчённого chrome** (`?embedded=bitrix24`): без боковой навигации и тяжёлой шапки.
- **Реальное создание тестовой задачи** в Bitrix24 через сервер Тандор: вызывается только метод REST **`tasks.task.add`** (входящий webhook URL хранится в `process.env.BITRIX24_WEBHOOK_URL` на сервере, не в клиенте).
- **MVP «задачи из ЛК»:** менеджер с правами записи по клиенту может создать задачу в Bitrix24 из **карточки дилера** или **карточки торговой точки** (`POST /api/bitrix24/tasks/create`). Связь «что создано» хранится **только в браузере** (`localStorage`), без обратной синхронизации статусов из Bitrix24 и без входящих webhook от Bitrix24.

## Переменные окружения (только сервер)

| Переменная | Обязательность | Назначение |
|------------|----------------|------------|
| `BITRIX24_WEBHOOK_URL` | **Обязательна** для серверного создания задач (POC и MVP) | Полный базовый URL входящего webhook (как в Bitrix24, сегмент **`/rest/<userId>/<token>/`**). Из **`userId`** в URL автоматически выставляются **ответственный** и **постановщик** задачи (`RESPONSIBLE_ID` / `CREATED_BY`), если не задан override ниже. |
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

Каждая Vercel-функция (`api/bitrix24/tasks/test.ts`, `api/bitrix24/tasks/create.ts`) **самодостаточна**: вся логика валидации и вызова Bitrix24 продублирована внутри файла. В директории `api/` намеренно нет ни одного не-handler .ts-файла — на этом проекте любые межфайловые импорты внутри `api/` (включая `api/_lib/*` с префиксом подчёркивания) приводили к `FUNCTION_INVOCATION_FAILED` в Vercel runtime. Express-маршруты в `server/bitrix24-tasks-*-execute.ts` тоже самодостаточны и не зависят от `api/`. Дублирование намеренное — это цена надёжной работы serverless-функций в текущей конфигурации Vercel.

## ЛК: где создавать задачу и где видна связь

- **Карточка дилера** (`#/dealers/...`): блок «Задачи Bitrix24» после секции «Следующий шаг»; кнопка открывает диалог с заголовком и описанием. Права на кнопку совпадают с **`canEditClientNextStep`** (менеджер своего клиента, РОП команды, директор продаж; маркетолог и аналитик — без создания).
- **Карточка торговой точки** (`#/dealers/.../trade-points/...`): такой же блок после витринной матрицы точки.
- **Хранение связи:** ключ `localStorage` **`tandoor-bitrix24-task-links-v1`**, структура `linksByDealer` и `linksByTradePoint` (ключ точки: `` `${dealerId}|${tradePointId}` ``). Событие обновления списка: **`tandoor-bitrix24-task-links-changed`**. Код: `apps/platform/client/src/lib/bitrix24-task-links.ts`.

Это **MVP:** статусы задач в Bitrix24 в ЛК не подтягиваются, входящие события Bitrix24 не обрабатываются.

### Production на Vercel

Статический вывод (`outputDirectory: dist/public`) **не** запускает собранный Express (`dist/index.cjs`). Раньше в `vercel.json` был rewrite **`/(.*) → /index.html`**, из‑за чего запросы к **`/api/...`** отдавали SPA (`index.html`), в том числе **405** на POST.

Сейчас:

- **`buildCommand`:** `npm run build` — собираются и клиент (`vite`), и серверный бандл для Node.
- **Rewrite на все пути удалён** — приложение на **hash-router** (`#/…`), для основного сценария отдельный SPA-fallback не нужен.
- **`POST /api/bitrix24/tasks/test`** и **`POST /api/bitrix24/tasks/create`** обрабатываются **Serverless Functions** Vercel: `api/bitrix24/tasks/test.ts` и `api/bitrix24/tasks/create.ts`. Оба файла **полностью самодостаточны** — вообще никаких импортов из `server/*`, `client/*`, `api/_lib/*` или path-алиасов `@/`. В `api/` нет ни одного вспомогательного модуля. Ответ всегда JSON и `Content-Type: application/json`. Так гарантировано не повторится `FUNCTION_INVOCATION_FAILED`, наблюдавшийся после PR #106 и PR #107, когда handler'ы импортировали соседние ts-файлы внутри `api/`.
- В **`package.json`** задано **`"engines": { "node": "20.x" }`**, чтобы на Vercel использовался **Node 20** вместо «плавающего» runtime по умолчанию.

Локально по-прежнему работает Express: `server/bitrix24-routes.ts` регистрирует оба маршрута; вся логика лежит в `server/bitrix24-tasks-test-execute.ts` и `server/bitrix24-tasks-create-execute.ts` (самодостаточные модули, без импортов из `api/`).

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

## Права API на следующем шаге (ориентир)

Сейчас используется только **`tasks.task.add`**. Дальше по продукту могут понадобиться отдельные scope под CRM, пользователей и т.д. — подключать по мере сценариев, не расширяя webhook «на всякий случай».

## Рекомендации по безопасности после теста

1. **Удалить** временный входящий webhook, созданный для эксперимента.
2. Создать **новый** webhook с **минимально необходимыми** правами (например, только задачи, если Bitrix24 позволяет сузить scope).
3. По возможности выносить интеграцию на **серверный backend** с собственной авторизацией пользователя Тандор, а не полагаться только на длинный URL webhook.

## Ограничения POC

- Параметры `DOMAIN` и др. из Bitrix читаются из URL **если** портал их добавит; иначе контекст пустой.
- Навигация на другие разделы ЛК сохраняет `embedded=bitrix24` только если ссылки собраны с этим query (на странице POC ссылки уже с маркером).
- Некоторые кнопки ведут в разделы с **RBAC по роли** (например, «Задачи» или «KPI» могут быть недоступны роли «маркетолог» — сработает стандартный редирект на домашний маршрут).
