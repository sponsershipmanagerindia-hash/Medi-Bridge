import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthFlow } from '@/components/AuthFlow';
import './index.css';

function Root() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="auth-page"><div className="auth-card"><div className="auth-loading-spinner" /></div></div>;
  }
  if (!user) return <AuthFlow />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>
);
