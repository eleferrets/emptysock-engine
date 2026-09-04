import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PanelErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[PanelErrorBoundary] caught:", error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            background: "var(--es-bg-panel)",
            padding: "16px 20px",
            gap: 10,
            overflow: "auto",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--es-text)",
            }}
          >
            ☠ This panel broke.
          </span>
          {this.state.error !== null && (
            <pre
              style={{
                fontSize: 11,
                fontFamily: "var(--es-font-mono, monospace)",
                color: "var(--es-red, var(--es-text-muted))",
                background: "var(--es-surface-2)",
                border: "1px solid var(--es-border)",
                borderRadius: 4,
                padding: "8px 10px",
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxWidth: "100%",
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <span
            style={{
              fontSize: 11,
              color: "var(--es-text-muted)",
              fontStyle: "italic",
            }}
          >
            Details above.
          </span>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 4,
              fontSize: 11,
              padding: "4px 10px",
              background: "var(--es-surface-2)",
              color: "var(--es-text)",
              border: "1px solid var(--es-border)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
