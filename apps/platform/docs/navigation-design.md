# Дизайн бокового меню и mobile drawer (все роли)

Единый визуальный язык для **desktop sidebar**, **mobile sheet** и **иконок rail** в `AppShell` (`client/src/components/layout/app-shell.tsx`). Бизнес-структура пунктов задаётся в `getPilotNavigation` (`auth-access.ts`) и **не меняется** этим документом.

## Nav item (плоское и группированное меню)

- Высота строки **44px** (`h-11`), горизонтальные отступы **`px-3`**, скругление **`rounded-lg`**.
- Текст одной строкой с **`truncate`**; счётчики и бейджи **справа**.
- **Активный пункт:** фон `#FFFFFF`, текст `#222631`, полоса слева **`#9ACA3C`** (3px).
- **Неактивный:** текст `#8F96B0`, фон прозрачный.
- **Hover / active press:** лёгкий фон `#EEEFF6`.
- Пункты **«В разработке»** (директор/РОП): muted-бейдж «в разработке» (`#EEEFF6` / `#8F96B0`), пункт **не** выглядит disabled.

В коде общие классы собраны в хелперы: `navRowClass`, `navGroupHeaderButtonClass`, `navCountBadgeClass`, `navWipBadgeClass`, `navSkeletonPulseClass`.

## Группы (директор / РОП)

- Заголовок группы: **uppercase**, компактный блок, **chevron** справа; фон **не** имитирует активный nav item (прозрачный, без зелёной полосы).
- Сводка под заголовком только там, где помогает (например счётчики для «Клиентская база»); для «В разработке» визуальная вторая строка убрана, `data-testid` сводки сохранён через `sr-only` для тестов/скринридеров.

## Mobile drawer: настройки и выход

Внизу sheet — блок **`nav-settings-section`**:

- Имя пользователя и подпись роли (`userSubtitle` из `salesRoleNavSubtitle` в `auth-access.ts`).
- Сворачиваемый заголовок **«Настройки»** (`button-nav-settings-toggle`, по умолчанию **свёрнут**).
- При раскрытии: текущая тема (`nav-theme-current`), кнопки **`button-nav-theme-light`**, **`button-nav-theme-dark`**, **`button-nav-theme-system`**, выход **`button-nav-logout`**. Контейнер опций темы сохраняет **`menu-theme-options`** (совместимость с прежними проверками).

Верхняя шапка приложения по-прежнему использует **`ThemeToggleDesktop`** и **`button-auth-logout`**.

## Desktop sidebar: нижний блок

Компактно: имя, роль, строка «Рабочий кабинет Tandoor». Тема остаётся в **topbar**.

## Иконки rail

Активный раздел: фон `#EEEFF6`, иконка **`#86B832`**; неактивный — `#8F96B0`, hover с лёгким фоном.

## Связанные документы

- Структура меню директора/РОПа: [director-rop-navigation.md](./director-rop-navigation.md).
- Тема интерфейса: [theme-ui.md](./theme-ui.md).
