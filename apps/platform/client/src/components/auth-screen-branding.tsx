import logoOfficial from "@/assets/brand/tandoor-logo-official.svg";

export type AuthScreenBrandingProps = {
  /** На /login слоган обязателен, на остальных auth-страницах можно скрыть. */
  showSlogan?: boolean;
};

export function AuthScreenBranding({ showSlogan = true }: AuthScreenBrandingProps) {
  return (
    <div className="mb-8 flex flex-col items-center motion-reduce:transition-none">
      <img
        src={logoOfficial}
        alt="Tandoor"
        className="h-12 w-auto max-w-[220px] motion-reduce:transition-none"
        width={220}
        height={48}
      />
      {showSlogan ? (
        <p className="mt-2 text-center text-xs uppercase tracking-wide text-muted-foreground motion-reduce:transition-none">
          СРАВНИВАЯ, ВЫБИРАЮТ НАС
        </p>
      ) : null}
    </div>
  );
}
