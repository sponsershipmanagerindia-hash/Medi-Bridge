// React utilities and types
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
// Supabase user and session types
import { Session, User } from '@supabase/supabase-js';

// Default user representing the current logged-in profile
const DEFAULT_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  app_metadata: {},
  user_metadata: { full_name: 'Alex Morgan' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'alex.morgan@medibridge.health',
  phone: '',
  role: 'authenticated',
  updated_at: new Date().toISOString()
} as unknown as User;

// Shape of the auth context
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  displayName: string;
  setDisplayName: (name: string) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider with authentication bypassed
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<User | null>(DEFAULT_USER);
  const [loading] = useState(false);
  const [displayName, setDisplayNameState] = useState('Alex Morgan');

  const setDisplayName = useCallback((name: string) => {
    setDisplayNameState(name);
  }, []);

  const signOut = useCallback(async () => {
    // Auth system bypassed; no session to clear
  }, []);

  return (
    <AuthContext.Provider value={{ session: null, user, loading, displayName, setDisplayName, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook for consuming the AuthContext
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
