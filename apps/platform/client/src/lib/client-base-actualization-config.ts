/**
 * Feature flags для режима актуализации клиентской базы.
 * Отключение архива ТТ у менеджеров — только смена CLIENT_BASE_ACTUALIZATION_ARCHIVE_TRADE_POINT_ENABLED.
 */

export const CLIENT_BASE_ACTUALIZATION_ENABLED = true;

/** Разрешить менеджерам (sales_manager) архивировать/закрывать ТТ в режиме актуализации. РОП / директор — по правам canEdit. */
export const CLIENT_BASE_ACTUALIZATION_ARCHIVE_TRADE_POINT_ENABLED = true;
