# Тема интерфейса (светлая / тёмная / системная)

## Логика (аналогично подходу RemCard / next-themes)

1. **Класс на корне:** на элемент `html` вешается класс `dark` при тёмном отображении. В Tailwind включён `darkMode: ["class"]` (`tailwind.config.ts`).
2. **Переменные:** палитра задаётся в `client/src/index.css` для `:root` (светлая) и `.dark` (тёмная). Компоненты shadcn используют `hsl(var(--background))`, `bg-card`, `text-muted-foreground` и т.д.
3. **Без мигания (FOUC):** в `client/index.html` выполняется **inline-скрипт** до загрузки React: читается `localStorage`, выставляется `class` на `html` и `data-tandoor-theme`.
4. **React-слой:** `ThemeProvider` (`client/src/context/theme-provider.tsx`) синхронизирует выбор с `document.documentElement`, слушает `prefers-color-scheme` при режиме **system** и событие `storage` для других вкладок.
5. **Переключатель:** `ThemeToggleDesktop` и `ThemeToggleMobileBlock` в `client/src/components/theme-toggle.tsx`; в шапке и в мобильном drawer — `client/src/components/layout/app-shell.tsx`.

## localStorage

| Ключ | Значения | По умолчанию |
|------|-----------|----------------|
| `tandoor-theme-v1` | `light` \| `dark` \| `system` | `system` (если ключа нет или значение некорректно) |

При `system` эффективная тема следует за `prefers-color-scheme: dark`.

## Фирменные цвета Tandoor (не палитра RemCard)

**Светлая:** фон `#EEEFF6`, поверхности `#FFFFFF` / `#E3E6F3`, текст `#222631`, приглушённый `#8F96B0`, акцент `#9ACA3C`, hover `#86B832`.

**Тёмная:** фон ~`#050604`, карточки ~`#0E120A`, вторая поверхность ~`#171D12`, текст `#FFFFFF`, приглушённый ~62% белого, те же primary/primary-hover. Границы — приглушённые зелёно-серые, без «чужих» tailwind-палитр в токенах темы.

**Destructive:** в токенах задан нейтральный контрастный вариант (без красного «алерта»), чтобы действия удаления/архива оставались читаемыми в фирменной стилистике.

## data-testid

- `button-theme-toggle` — кнопка в desktop topbar (и embedded Bitrix header).
- `menu-theme-options` — контейнер опций (dropdown / блок в drawer).
- `option-theme-light`, `option-theme-dark`, `option-theme-system`.
- `icon-theme-light`, `icon-theme-dark`, `icon-theme-system` — на соответствующих контролах.
- `text-current-theme` — подпись текущего режима в мобильном блоке.

## Как проверить

1. `cd apps/platform && npm run check && npm run build`.
2. В шапке (desktop): иконка темы → три варианта; hard refresh — тема не «прыгает».
3. Мобильная ширина: меню → блок «Тема интерфейса».
4. Режим **system**: сменить ОС light/dark — UI обновляется.
5. Проверить клиентскую базу, витрину, карточки, модалки, toast, сайдбар в обеих темах.
