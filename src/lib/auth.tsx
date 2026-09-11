// Import React utilities and types needed for authentication context
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
// Import Supabase session and user types
import { Session, User } from '@supabase/supabase-js';
// Import configured Supabase client
import { supabase } from '@/lib/supabase';

// Define shape of the authentication context
type AuthContextType = {
  // Current Supabase session (null if not signed in)
  session: Session | null;
  // Current authenticated user (null if not signed in)
  user: User | null;
  // Loading flag while checking auth state
  loading: boolean;
  // Display name derived from profile or email
  displayName: string;
  // Function to manually set display name
  setDisplayName: (name: string) => void;
  // Sign‑out function returning a promise
  signOut: () => Promise<void>;
};

// Create a React context for auth (undefined initially for runtime safety)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps the app and supplies auth state
export function AuthProvider({ children }: { children: ReactNode }) {
  // Store Supabase session object
  const [session, setSession] = useState<Session | null>(null);
  // Store current user object
  const [user, setUser] = useState<User | null>(null);
  // Track whether auth info is still loading
  const [loading, setLoading] = useState(true);
  // Human‑readable display name for UI
  const [displayName, setDisplayNameState] = useState('');

  // On mount, fetch initial session and set up auth state listener
  useEffect(() => {
    // Get current session from Supabase
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth state changes (login, logout, etc.)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    // Clean up subscription on unmount
    return () => listener.subscription.unsubscribe();
  }, []);

  // When the user object changes, load/display the user's name
  useEffect(() => {
    if (user) {
      // Query the 'profiles' table for a display_name field
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.display_name) {
            // Use the stored display name if it exists
            setDisplayNameState(data.display_name);
          } else if (user.email) {
            // Fallback to the part of the email before '@'
            setDisplayNameState(user.email.split('@')[0]);
          }
        });
    } else {
      // No user – clear any displayed name
      setDisplayNameState('');
    }
  }, [user]);

  // Helper to update the display name programmatically
  const setDisplayName = useCallback((name: string) => {
    setDisplayNameState(name);
  }, []);

  // Sign‑out implementation that clears local auth state
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setDisplayNameState('');
  }, []);

  // Provide context value to children components
  return (
    <AuthContext.Provider value={{ session, user, loading, displayName, setDisplayName, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook for consuming the AuthContext in functional components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
