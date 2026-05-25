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
          "flex h-11 min-h-[44px] w-full rounded-md border border-input bg-background py-2 pl-3 pr-12 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:text-sm",
          className,
        )}
        data-testid={dataTestId}
        {...rest}
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 flex h-11 min-h-11 w-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground motion-reduce:transition-none hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        data-testid={toggleTestId}
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );
}
