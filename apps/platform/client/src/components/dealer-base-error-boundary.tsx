import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  clearSchemaVersionMarkerForHandshake,
  reloadPageWithSchemaVersionBump,
} from "@/lib/schema-version-handshake";

type Props = {
  children: ReactNode;
  renderError?: (error: Error, errorInfo: ErrorInfo | null, onRetry: () => void) => ReactNode;
};

type State = {
  error: Error | null;
  errorInfo: ErrorInfo | null;
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
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            Попробовать снова
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={reloadPageWithSchemaVersionBump}>
          Перезагрузить страницу
        </Button>
      </div>
    </div>
  );
}

export class DealerBaseErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ errorInfo: info });
    console.error("[dealer-base] render error", error, info.componentStack);
    clearSchemaVersionMarkerForHandshake();
  }

  private handleRetry = (): void => {
    this.setState({ error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.renderError) {
        return this.props.renderError(this.state.error, this.state.errorInfo, this.handleRetry);
      }
      return <DealerBaseErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
