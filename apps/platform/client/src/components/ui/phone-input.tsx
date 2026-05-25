import { useEffect, useState, type ComponentProps, type FormEvent, type JSX } from "react";
import { cn } from "@/lib/utils";
import { formatPhoneMask, maskOnInput, normalizeToCanonical } from "@/lib/phone-format";

const PREFIX = "+7 ";

export type PhoneInputProps = Omit<ComponentProps<"input">, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (normalized: string) => void;
  "data-testid"?: string;
};

export function PhoneInput(props: PhoneInputProps): JSX.Element {
  const { value, onChange, className, "data-testid": dataTestId, ...rest } = props;
  const [display, setDisplay] = useState(() => (value ? formatPhoneMask(value) : PREFIX));

  useEffect(() => {
    setDisplay(value ? formatPhoneMask(value) : PREFIX);
  }, [value]);

  const onInput = (e: FormEvent<HTMLInputElement>) => {
    const raw = e.currentTarget.value;
    if (raw.length < PREFIX.length) {
      setDisplay(PREFIX);
      onChange("");
      return;
    }
    setDisplay(maskOnInput(raw));
    const canonical = normalizeToCanonical(raw);
    const digits = canonical.slice(2);
    if (digits.length === 0) {
      onChange("");
    } else {
      onChange(canonical);
    }
  };

  return (
    <input
      type="text"
      inputMode="tel"
      autoComplete="tel"
      placeholder="+7 (___) ___-__-__"
      className={cn(
        "flex h-11 min-h-[44px] w-full rounded-md border border-input bg-card px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      data-testid={dataTestId}
      value={display}
      onInput={onInput}
      {...rest}
    />
  );
}
