/**
 * Feature flags для режима актуализации клиентской базы.
 * Отключение архива ТТ у менеджеров — только смена CLIENT_BASE_ACTUALIZATION_ARCHIVE_TRADE_POINT_ENABLED.
 */

export const CLIENT_BASE_ACTUALIZATION_ENABLED = true;

/** Разрешить менеджерам (sales_manager) архивировать/закрывать ТТ в режиме актуализации. РОП / директор — по правам canEdit. */
export const CLIENT_BASE_ACTUALIZATION_ARCHIVE_TRADE_POINT_ENABLED = true;

/**
 * «Чистая» карточка актуализации: для всех клиентов (release и manual) — анкета без демо-блоков;
 * на странице ТТ — анкета витрины без матрицы/синтетических задач, пока не заполнены данные.
 */
export const CLIENT_BASE_ACTUALIZATION_CLEAN_MODE = true;
