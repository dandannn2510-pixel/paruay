import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { StoreProvider } from './context/StoreContext'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Uncaught Error Boundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.href = '/';
  };

  handleResetAndReload = () => {
    try {
      localStorage.removeItem('paruay_pos_cart');
    } catch (_) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          background: '#f5f5f7',
          color: '#111827',
          fontFamily: "'Prompt', sans-serif"
        }}>
          <img src="/logo.png" alt="พารวย" style={{ width: '80px', height: '80px', marginBottom: '1rem', borderRadius: '50%' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#dc2626' }}>
            เกิดข้อผิดพลาดชั่วคราว
          </h2>
          <p style={{ color: '#4b5563', maxWidth: '420px', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            ระบบได้บันทึกความปลอดภัยของข้อมูลไว้แล้ว สามารถกดปุ่มด้านล่างเพื่อกลับสู่หน้าขายได้ทันที
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleReload}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🔄 รีเฟรชกลับหน้าขาย
            </button>
            <button
              onClick={this.handleResetAndReload}
              style={{
                background: '#ffffff',
                color: '#4b5563',
                border: '1px solid #d1d5db',
                borderRadius: '12px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              ล้างบิลที่ค้างอยู่แล้วเริ่มใหม่
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
)

