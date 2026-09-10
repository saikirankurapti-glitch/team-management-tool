import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React component error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 glass-panel rounded-2xl border border-rose-500/30 m-6 text-xs space-y-4">
          <div className="flex items-center space-x-2 font-bold text-rose-400 text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>Component Execution Error</span>
          </div>
          <p className="text-slate-300">
            An unexpected UI rendering error occurred in this section. Other application components remain active.
          </p>
          <div className="p-3 bg-slate-950 rounded-xl font-mono text-[11px] text-rose-300">
            {this.state.error?.message || 'Unknown runtime error'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Component</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
