import { useState, type ComponentProps, type JSX } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  "data-testid"?: string;
  toggleTestId?: string;
};

export function PasswordInput(props: PasswordInputProps): JSX.Element {
  const { className, toggleTestId, "data-testid": dataTestId, ...rest } = props;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={cn(
          "flex h-11 min-h-[44px] w-full rounded-md border border-input bg-card py-2 pl-3 pr-11 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        data-testid={dataTestId}
        {...rest}
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        data-testid={toggleTestId}
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
