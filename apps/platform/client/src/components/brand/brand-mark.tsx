/**
 * Фирменная отметка в шапке. Оригинальный файл логотипа в репозитории не найден —
 * используется аккуратный текстовый wordmark и место под будущий `<img>`.
 */
export function BrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3" data-testid="brand-mark">
      {/* Место под логотип: при появлении assets заменить на <img src={...} alt="Tandoor" className="h-8 w-auto" /> */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#7DC400]/35 bg-[#7DC400]/12 text-sm font-bold tracking-tight text-[#3d5f00]"
        aria-hidden
        data-testid="brand-logo-placeholder"
      >
        T
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-base font-semibold tracking-tight text-[#1a1a1a]">Tandoor</div>
        <div className="truncate text-xs font-medium text-neutral-500">Platform</div>
      </div>
    </div>
  );
}
