import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
            color: 'var(--text-muted)',
            gap: 8,
            padding: 24,
          }}
        >
          <span style={{ fontSize: 32 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Canvas unavailable</span>
          <span style={{ fontSize: 11, textAlign: 'center', maxWidth: 320 }}>
            {this.state.error?.message ?? 'WebGL/WebGPU not available in this environment.'}
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
