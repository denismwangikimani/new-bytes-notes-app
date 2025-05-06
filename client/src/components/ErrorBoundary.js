import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Editor error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#ef4444' }}>
          <h3>Something went wrong with the editor.</h3>
          <p>Try refreshing the page or contact support if the issue persists.</p>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{ 
              padding: '8px 16px', 
              background: '#4f46e5', 
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              marginTop: '10px',
              cursor: 'pointer'
            }}
          >
            Try to recover
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;