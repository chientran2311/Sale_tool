import React, { Component, type ErrorInfo, type ReactNode, Suspense } from "react";

interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: React.ComponentType<FallbackProps>;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} resetErrorBoundary={this.reset} />;
    }
    return this.props.children;
  }
}

export function AsyncBoundary({
  children,
  loadingFallback,
  errorFallback,
}: {
  children: ReactNode;
  loadingFallback: ReactNode;
  errorFallback: React.ComponentType<FallbackProps>;
}) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={loadingFallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
