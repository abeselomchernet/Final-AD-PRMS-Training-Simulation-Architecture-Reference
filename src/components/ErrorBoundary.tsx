import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected workspace error.',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AD-PRMS Workspace ErrorBoundary caught error:', error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center bg-[#F4F6F9] dark:bg-[#0B131F] p-6"
        >
          <div className="max-w-md w-full rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-[#111C2C] p-6 shadow-sm space-y-3">
            <h1 className="text-base font-semibold text-rose-800 dark:text-rose-200">
              AD-PRMS Workspace Recovery
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-3 py-1.5 rounded-md bg-[#0F233A] text-white text-xs font-medium hover:bg-[#173557] cursor-pointer"
            >
              Reload Workspace View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
