# Витрина дилеров: плотности и фото (клиентская база)

Реализация в `apps/platform/client/src/pages/dealer-base.tsx`, `components/dealer-base-dealer-showcase-grid.tsx`, `components/showcase-cover-photo-slot.tsx`, `lib/dealer-contact-links.ts`.

## Режимы плотности

Внутри основного режима «Витрина дилеров» доступны:

| Режим | Описание |
|-------|----------|
| **Крупно** | Одна колонка крупных карточек с обложкой 84×84 px (до 96 на `sm`), контактами и блоком ТТ как филиалов. |
| **Сетка** | 2 колонки на телефоне, 3 на `lg`, 4 на `xl`; компактные карточки с превью 56–64 px. |
| **Список** | Плотные строки без горизонтального скролла: слева фото 48 px, по центру название/город/статусы, справа бейдж «N ТТ» и иконки связи (tel / WhatsApp / email на широком экране). Строка ведёт на карточку клиента. |
| **Таблица** | Сортировка и широкая таблица для руководителя; на узком экране автоматически подменяется на **Список**. |

Переключатель — компактные иконки справа от поиска (`section-dealer-showcase-mode-toolbar` + `section-dealer-showcase-density-icons`). Активная кнопка: `bg-primary` и `text-primary-foreground` (токены темы).

## localStorage

- Ключ: `tandoor-dealer-showcase-density-v1`.
- Значения: `large` \| `grid` \| `list` \| `table`.
- Сохранённое **`compact`** автоматически переписывается в **`grid`** при загрузке страницы (переименование режима «Компактно» → «Сетка»).
- Легаси `tandoor-dealer-base-view-mode-v1` по-прежнему мигрирует в новый ключ при первом визите.

## Фото и галерея

- Обложка клиента и ТТ берётся из merge (`coverPhotoUrl` / `coverPhotoThumbnailUrl`); для клиента дополнительно показывается legacy `logoUrl`, если нет обложки.
- **Нет фото:** placeholder с иконкой камеры; при правах редактирования в актуализации вся зона кликабельна и открывает диалог с `EntityActualizationPhotoGallery` (без перехода в полную карточку только ради загрузки).
- **Есть фото:** поверх — кнопка с карандашом (`h-9 w-9`), открывает ту же галерею; загрузка и «Сделать главным» — существующая логика PR фото.
- Права: `canEditDealerDuringActualization` / `canEditTradePointDuringActualization` и включённый контекст актуализации (`actx.enabled`).

### data-testid (фото)

| Элемент | Шаблон |
|---------|--------|
| Изображение обложки клиента | `image-dealer-cover-photo-{dealerId}` |
| Placeholder клиента | `placeholder-dealer-cover-photo-{dealerId}` |
| Добавить фото клиента | `button-dealer-cover-photo-add-{dealerId}` |
| Редактировать фото клиента | `button-dealer-cover-photo-edit-{dealerId}` |
| Аналогично для ТТ | `image-trade-point-cover-photo-{tradePointId}`, `placeholder-…`, `button-…-add-…`, `button-…-edit-…` |

## Детальные карточки

- **Клиент:** `dealer-card-foundation.tsx` — hero-блок с `ShowcaseCoverPhotoSlot` (`size="hero"`).
- **ТТ:** `trade-point-detail.tsx` — hero над блоком «Общее».

## Проверки UX

1. **Тема:** light / dark / system — карточки, placeholder, кнопки плотности, hover/focus.
2. **Mobile:** переключатель иконок, сетка 2 колонки, список без горизонтального скролла, зоны фото ≥ 36 px.
3. **Десктоп:** сетка 3–4 колонки, крупный режим в одну колонку.
4. **Права:** без актуализации или без права редактирования — нет карандаша и клика по placeholder.
