import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unexpected rendering failure.' };
  }

  componentDidCatch(error, info) {
    console.error('[FoodLoop ErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: '32px', textAlign: 'center', margin: '16px 0' }}>
          <AlertTriangle size={24} strokeWidth={1.65} style={{ color: 'var(--color-danger)', margin: '0 auto 12px' }} />
          <h3 style={{ marginBottom: '8px' }}>Unable to display this section</h3>
          <p style={{ fontSize: '14px', marginBottom: '20px' }}>{this.state.message}</p>
          <button type="button" className="btn btn-primary" onClick={this.handleReset}>
            <RefreshCw size={15} strokeWidth={1.65} />
            <span>Retry section</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
