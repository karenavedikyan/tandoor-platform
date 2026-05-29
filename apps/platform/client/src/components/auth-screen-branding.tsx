import logoOfficial from "@/assets/brand/tandoor-logo-official.svg";

export function AuthScreenBranding() {
  return (
    <div className="mb-8 flex flex-col items-center motion-reduce:transition-none">
      <img
        src={logoOfficial}
        alt="Tandoor"
        className="h-12 w-auto max-w-[220px] motion-reduce:transition-none"
        width={220}
        height={48}
      />
    </div>
  );
}
