import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export function DealerBaseErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center"
      data-testid="dealer-base-error-fallback"
    >
      <p className="text-lg font-semibold text-foreground">Произошла ошибка на странице</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Перезагрузите страницу. Если ошибка повторится — обратитесь в поддержку.
      </p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Попробовать снова
        </Button>
      ) : null}
    </div>
  );
}

export class DealerBaseErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[dealer-base] render error", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return <DealerBaseErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
