import { Component, type ErrorInfo, type ReactNode } from "react";
import { DealerBaseErrorFallback } from "@/components/dealer-base-error-boundary";
import { isDiag441Enabled } from "@/lib/diag-441-enabled";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
  componentStack: string | null;
};

function Diag441ErrorPanel({
  error,
  componentStack,
  onRetry,
}: {
  error: Error;
  componentStack: string | null;
  onRetry: () => void;
}): ReactNode {
  const copyText = [
    "=== 441 ERROR ===",
    error.message,
    "",
    "=== stack ===",
    error.stack ?? "(no stack)",
    "",
    "=== componentStack ===",
    componentStack ?? "(no component stack)",
  ].join("\n");

  const handleCopy = (): void => {
    void navigator.clipboard?.writeText(copyText);
  };

  return (
    <div
      className="fixed inset-0 z-[2147483646] overflow-auto bg-zinc-950 p-3 text-zinc-100"
      data-testid="diag-441-error-boundary"
    >
      <h1 className="mb-2 text-base font-bold text-red-400">Ошибка рендера distribution</h1>
      <p className="mb-3 break-all font-mono text-xs text-red-300">{error.message}</p>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">stack</p>
      <pre className="mb-3 max-h-[35vh] overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-zinc-300">
        {error.stack ?? "(no stack)"}
      </pre>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">componentStack</p>
      <pre className="mb-3 max-h-[25vh] overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-zinc-300">
        {componentStack ?? "(no component stack)"}
      </pre>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100"
          onClick={handleCopy}
        >
          Копировать
        </button>
        <button
          type="button"
          className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100"
          onClick={onRetry}
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}

export class Diag441ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      "[diag-441b] distribution render error: " +
        (error?.message ?? "") +
        "\n=== stack ===\n" +
        (error?.stack ?? "(no stack)") +
        "\n=== componentStack ===\n" +
        (info.componentStack ?? "(no component stack)"),
    );
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private handleRetry = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    if (isDiag441Enabled()) {
      return <Diag441ErrorPanel error={error} componentStack={componentStack} onRetry={this.handleRetry} />;
    }

    return <DealerBaseErrorFallback onRetry={this.handleRetry} />;
  }
}
