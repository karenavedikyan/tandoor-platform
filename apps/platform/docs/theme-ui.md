# Тема интерфейса (светлая / тёмная / системная)

## Логика (аналогично подходу RemCard / next-themes)

1. **Класс на корне:** на элемент `html` вешается класс `dark` при тёмном отображении. В Tailwind включён `darkMode: ["class"]` (`tailwind.config.ts`).
2. **Переменные:** палитра задаётся в `client/src/index.css` для `:root` (светлая) и `.dark` (тёмная). Компоненты shadcn используют `hsl(var(--background))`, `bg-card`, `text-muted-foreground` и т.д.
3. **Без мигания (FOUC):** в `client/index.html` выполняется **inline-скрипт** до загрузки React: читается `localStorage`, выставляется `class` на `html` и `data-tandoor-theme`.
4. **React-слой:** `ThemeProvider` (`client/src/context/theme-provider.tsx`) синхронизирует выбор с `document.documentElement`, слушает `prefers-color-scheme` при режиме **system** и событие `storage` для других вкладок.
5. **Переключатель:** `ThemeToggleDesktop` в `client/src/components/theme-toggle.tsx` (desktop topbar). В **мобильном drawer** тема и выход вынесены в компактный блок «Настройки» в `client/src/components/layout/app-shell.tsx` (`MobileDrawerFooter`, см. `navigation-design.md`). Компонент `ThemeToggleMobileBlock` оставлен в коде для совместимости, но в основном shell больше не используется.

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
- **Мобильный drawer (актуально):** `nav-settings-section`, `button-nav-settings-toggle`, `nav-theme-current`, `button-nav-theme-light`, `button-nav-theme-dark`, `button-nav-theme-system`, `button-nav-logout`; внутри раскрытого блока темы контейнер сохраняет `menu-theme-options` для совместимости.
- **Desktop dropdown темы:** `menu-theme-options` — контейнер опций в dropdown; `option-theme-light`, `option-theme-dark`, `option-theme-system`.
- `icon-theme-light`, `icon-theme-dark`, `icon-theme-system` — на соответствующих контролах.
- `text-current-theme` — устаревшая подпись в `ThemeToggleMobileBlock` (если блок где-то ещё подключён).

## Чистая актуализация (карточки клиента / ТТ)

Экраны `dealer-manual-actualization-page.tsx` и `trade-point-manual-actualization-view.tsx`, блок синхронизации `client-base-actualization-sync-status.tsx`, галерея `entity-actualization-photo-gallery.tsx` используют только семантические классы (`bg-card`, `border-border`, `text-primary`, `bg-primary`, `text-muted-foreground` и т.д.), без tailwind-палитр emerald/amber/slate и без «светлых» hex-фонов, чтобы в **dark** не выбиваться из карточки.

## Как проверить

1. `cd apps/platform && npm run check && npm run build`.
2. В шапке (desktop): иконка темы → три варианта; hard refresh — тема не «прыгает».
3. Мобильная ширина: меню → **Настройки** → выбор темы или выход (см. `navigation-design.md`).
4. Режим **system**: сменить ОС light/dark — UI обновляется.
5. Проверить клиентскую базу, витрину, карточки, модалки, toast, сайдбар в обеих темах.
