# React 19 Component Patterns & Error Boundaries

> Hướng dẫn thiết kế component, cơ chế ErrorBoundary và Slot Pattern.

## 1. Error Boundary & Suspense Wrapper Pattern

Bắt lỗi render runtime và hiển thị UI phục hồi mà không làm sập ứng dụng:

```tsx
import React, { Component, ErrorInfo, ReactNode, Suspense } from "react";

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
```

## 2. Slot Pattern (`asChild`)

Truyền thuộc tính và styles vào phần tử con trực tiếp mà không cần thẻ `div` bọc ngoài:

```tsx
import React from "react";

export function Slot({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }) {
  if (React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      ...(children.props as any),
      className: [className, (children.props as any).className].filter(Boolean).join(" "),
    });
  }
  return null;
}
```
