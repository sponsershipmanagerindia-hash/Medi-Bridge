/**
 * Authentication Flow Component
 *
 * Provides the UI for user onboarding, sign‑in, sign‑up, password reset, and
 * account recovery. It switches between several screens based on internal
 * state.
 */

import { FormEvent, useState } from 'react';
import { Sparkles, ArrowRight, Mail, Lock, User, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

/**
 * Enumeration of the possible screens in the authentication flow.
 */
 type AuthScreen = 'welcome' | 'signin' | 'signup' | 'forgot' | 'reset';

/**
 * Top‑level component that renders the appropriate authentication screen.
 *
 * @returns JSX element containing the selected auth screen.
 */
 export function AuthFlow() {
  const [screen, setScreen] = useState<AuthScreen>('welcome');

  return (
    <div className="auth-page">
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />
      <div className="auth-bg-orb auth-bg-orb-3" />

      {screen === 'welcome' && <WelcomeScreen onGetStarted={() => setScreen('signup')} onSignIn={() => setScreen('signin')} />}
      {screen === 'signin' && <SignInScreen onBack={() => setScreen('welcome')} onForgotPassword={() => setScreen('forgot')} onSignUp={() => setScreen('signup')} />}
      {screen === 'signup' && <SignUpScreen onBack={() => setScreen('welcome')} onSignIn={() => setScreen('signin')} />}
      {screen === 'forgot' && <ForgotPasswordScreen onBack={() => setScreen('signin')} />}
      {screen === 'reset' && <ResetPasswordScreen onBack={() => setScreen('signin')} />}
    </div>
  );
}

/**
 * Welcome screen shown to first‑time visitors.
 *
 * @param onGetStarted - Callback to navigate to the sign‑up flow.
 * @param onSignIn - Callback to navigate to the sign‑in flow.
 */
 function WelcomeScreen({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  return (
    <div className="auth-card auth-welcome-card">
      <div className="auth-logo"><Sparkles size={28} strokeWidth={2.5} /></div>
      <h1>MediBridge</h1>
      <p className="auth-tagline">Your health, understood.</p>
      <p className="auth-description">
        Turn scattered medical documents, prescriptions, and health questions into clear explanations, organized summaries, and useful next steps — with a pathway to real professional care.
      </p>
      <div className="auth-features">
        <div className="auth-feature"><CheckCircle2 size={16} /> Understand your medical documents</div>
        <div className="auth-feature"><CheckCircle2 size={16} /> Organize your health history</div>
        <div className="auth-feature"><CheckCircle2 size={16} /> Prepare for doctor visits</div>
        <div className="auth-feature"><CheckCircle2 size={16} /> Connect with professional care</div>
      </div>
      <button className="auth-button auth-button-primary" onClick={onGetStarted}>
        Get started <ArrowRight size={18} />
      </button>
      <button className="auth-button auth-button-secondary" onClick={onSignIn}>
        I already have an account
      </button>
      <p className="auth-disclaimer">
        MediBridge provides information support, not medical diagnosis. Always consult a qualified healthcare professional for medical decisions. In an emergency, contact your local emergency services immediately.
      </p>
    </div>
  );
}

/**
 * Sign‑in screen for existing users.
 *
 * @param onBack - Return to the welcome screen.
 * @param onForgotPassword - Navigate to password‑reset request screen.
 * @param onSignUp - Switch to the sign‑up screen.
 */
 function SignInScreen({ onBack, onForgotPassword, onSignUp }: { onBack: () => void; onForgotPassword: () => void; onSignUp: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
    }
  };

  return (
    <div className="auth-card">
      <button className="auth-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
      <h1>Welcome back</h1>
      <p className="auth-subtitle">Sign in to your MediBridge account.</p>
      {error && <div className="auth-error"><AlertCircle size={16} /> {error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-field">
          <span>Email</span>
          <div className="auth-input-wrap"><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></div>
        </label>
        <label className="auth-field">
          <span>Password</span>
          <div className="auth-input-wrap"><Lock size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required autoComplete="current-password" /></div>
        </label>
        <button type="submit" className="auth-button auth-button-primary" disabled={loading}>
          {loading ? <><Loader2 size={18} className="auth-spin" /> Signing in...</> : <>Sign in <ArrowRight size={18} /></>}
        </button>
      </form>
      <button className="auth-link" onClick={onForgotPassword}>Forgot your password?</button>
      <div className="auth-divider" />
      <p className="auth-switch">Don't have an account? <button className="auth-link-inline" onClick={onSignUp}>Create one</button></p>
    </div>
  );
}

/**
 * Sign‑up screen for new users.
 *
 * @param onBack - Return to the welcome screen.
 * @param onSignIn - Switch to the sign‑in screen after successful signup.
 */
 function SignUpScreen({ onBack, onSignIn }: { onBack: () => void; onSignIn: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="auth-card">
        <div className="auth-success-icon"><CheckCircle2 size={48} /></div>
        <h1>Account created</h1>
        <p className="auth-subtitle">Your MediBridge account is ready. You're now signed in.</p>
        <p className="auth-subtitle">Welcome, {name}! You can start using MediBridge right away.</p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <button className="auth-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
      <h1>Create your account</h1>
      <p className="auth-subtitle">Your health information stays private and under your control.</p>
      {error && <div className="auth-error"><AlertCircle size={16} /> {error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-field">
          <span>Your name</span>
          <div className="auth-input-wrap"><User size={17} /><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" required autoComplete="name" /></div>
        </label>
        <label className="auth-field">
          <span>Email</span>
          <div className="auth-input-wrap"><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></div>
        </label>
        <label className="auth-field">
          <span>Password</span>
          <div className="auth-input-wrap"><Lock size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} autoComplete="new-password" /></div>
        </label>
        <button type="submit" className="auth-button auth-button-primary" disabled={loading}>
          {loading ? <><Loader2 size={18} className="auth-spin" /> Creating account...</> : <>Create account <ArrowRight size={18} /></>}
        </button>
      </form>
      <div className="auth-divider" />
      <p className="auth-switch">Already have an account? <button className="auth-link-inline" onClick={onSignIn}>Sign in</button></p>
      <p className="auth-disclaimer">By creating an account, you agree that MediBridge provides information support, not medical diagnosis. Always consult a qualified healthcare professional.</p>
    </div>
  );
}

/**
 * Screen to request a password‑reset email.
 *
 * @param onBack - Return to the sign‑in screen.
 */
 function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="auth-card">
        <div className="auth-success-icon"><CheckCircle2 size={48} /></div>
        <h1>Check your email</h1>
        <p className="auth-subtitle">If an account exists for {email}, you'll receive a password reset link shortly.</p>
        <button className="auth-button auth-button-secondary" onClick={onBack}>Back to sign in</button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <button className="auth-back" onClick={onBack}><ArrowLeft size={16} /> Back to sign in</button>
      <h1>Reset your password</h1>
      <p className="auth-subtitle">Enter your email and we'll send you a link to reset your password.</p>
      {error && <div className="auth-error"><AlertCircle size={16} /> {error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-field">
          <span>Email</span>
          <div className="auth-input-wrap"><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></div>
        </label>
        <button type="submit" className="auth-button auth-button-primary" disabled={loading}>
          {loading ? <><Loader2 size={18} className="auth-spin" /> Sending...</> : <>Send reset link <ArrowRight size={18} /></>}
        </button>
      </form>
    </div>
  );
}

/**
 * Screen to set a new password after following a reset link.
 *
 * @param onBack - Return to the sign‑in screen.
 */
 function ResetPasswordScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="auth-card">
        <div className="auth-success-icon"><CheckCircle2 size={48} /></div>
        <h1>Password updated</h1>
        <p className="auth-subtitle">Your password has been changed successfully.</p>
        <button className="auth-button auth-button-secondary" onClick={onBack}>Back to sign in</button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <button className="auth-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
      <h1>Set a new password</h1>
      <p className="auth-subtitle">Choose a new password for your account{user?.email ? ` (${user.email})` : ''}.</p>
      {error && <div className="auth-error"><AlertCircle size={16} /> {error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-field">
          <span>New password</span>
          <div className="auth-input-wrap"><Lock size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} autoComplete="new-password" /></div>
        </label>
        <button type="submit" className="auth-button auth-button-primary" disabled={loading}>
          {loading ? <><Loader2 size={18} className="auth-spin" /> Updating...</> : <>Update password <ArrowRight size={18} /></>}
        </button>
      </form>
    </div>
  );
}
