import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zfafewsunyasyrdfjtjn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmYWZld3N1bnlhc3lyZGZqdGpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMDU2NTEsImV4cCI6MjEwNDY4MTY1MX0.FC3SuBNMVVtKmEqdjmmGW-aSQPDbIHBcx1aXKQIjm10';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
