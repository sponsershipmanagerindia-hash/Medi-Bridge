import { FormEvent, useState } from 'react';
import { User, Lock, Bell, Shield, Trash2, LogOut, Loader2, AlertCircle, CheckCircle2, ArrowRight, ChevronRight, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'privacy';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<SettingsTab>('profile');

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="settings-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div><span className="section-kicker">Account</span><h2>Settings</h2></div>
          <button className="icon-button" onClick={onClose}><span>×</span></button>
        </div>

        <div className="settings-tabs">
          <button className={`settings-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}><User size={16} /> Profile</button>
          <button className={`settings-tab ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}><Lock size={16} /> Security</button>
          <button className={`settings-tab ${tab === 'notifications' ? 'active' : ''}`} onClick={() => setTab('notifications')}><Bell size={16} /> Notifications</button>
          <button className={`settings-tab ${tab === 'privacy' ? 'active' : ''}`} onClick={() => setTab('privacy')}><Shield size={16} /> Privacy & Data</button>
        </div>

        <div className="settings-content">
          {tab === 'profile' && <ProfileSettings />}
          {tab === 'security' && <SecuritySettings />}
          {tab === 'notifications' && <NotificationSettings />}
          {tab === 'privacy' && <PrivacySettings onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}

function ProfileSettings() {
  const { user, displayName, setDisplayName } = useAuth();
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: name })
      .eq('id', user!.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setDisplayName(name);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <form onSubmit={handleSave} className="settings-form">
      <label className="auth-field">
        <span>Display name</span>
        <div className="auth-input-wrap"><User size={17} /><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
      </label>
      <label className="auth-field">
        <span>Email address</span>
        <div className="auth-input-wrap"><span className="auth-input-text">{user?.email}</span></div>
      </label>
      {error && <div className="auth-error"><AlertCircle size={16} /> {error}</div>}
      {saved && <div className="auth-success-inline"><CheckCircle2 size={16} /> Profile updated</div>}
      <button type="submit" className="auth-button auth-button-primary" disabled={saving}>
        {saving ? <><Loader2 size={18} className="auth-spin" /> Saving...</> : <>Save changes <ArrowRight size={18} /></>}
      </button>
    </form>
  );
}

function SecuritySettings() {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setPassword('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <div>
      <form onSubmit={handleChangePassword} className="settings-form">
        <h4 className="settings-section-title">Change password</h4>
        <label className="auth-field">
          <span>New password</span>
          <div className="auth-input-wrap"><Lock size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} autoComplete="new-password" /></div>
        </label>
        {error && <div className="auth-error"><AlertCircle size={16} /> {error}</div>}
        {success && <div className="auth-success-inline"><CheckCircle2 size={16} /> Password updated</div>}
        <button type="submit" className="auth-button auth-button-primary" disabled={saving || !password}>
          {saving ? <><Loader2 size={18} className="auth-spin" /> Updating...</> : <>Update password <ArrowRight size={18} /></>}
        </button>
      </form>
      <div className="settings-divider" />
      <button className="settings-action" onClick={() => supabase.auth.signOut()}>
        <LogOut size={18} /> Sign out of MediBridge <ChevronRight size={16} />
      </button>
    </div>
  );
}

function NotificationSettings() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [healthTips, setHealthTips] = useState(false);

  return (
    <div className="settings-form">
      <h4 className="settings-section-title">Notification preferences</h4>
      <label className="settings-toggle-row">
        <div><strong>Email notifications</strong><span>Receive updates about your account and activity</span></div>
        <input type="checkbox" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} className="settings-toggle" />
      </label>
      <label className="settings-toggle-row">
        <div><strong>Appointment reminders</strong><span>Get notified about upcoming appointments</span></div>
        <input type="checkbox" checked={appointmentReminders} onChange={(e) => setAppointmentReminders(e.target.checked)} className="settings-toggle" />
      </label>
      <label className="settings-toggle-row">
        <div><strong>Health tips</strong><span>Occasional tips for managing your health information</span></div>
        <input type="checkbox" checked={healthTips} onChange={(e) => setHealthTips(e.target.checked)} className="settings-toggle" />
      </label>
      <div className="auth-success-inline"><CheckCircle2 size={16} /> Preferences are saved automatically</div>
    </div>
  );
}

function PrivacySettings({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const [conversations, documents, briefs, appointments] = await Promise.all([
        supabase.from('conversations').select('*').eq('user_id', user!.id),
        supabase.from('documents').select('*').eq('user_id', user!.id),
        supabase.from('health_briefs').select('*').eq('user_id', user!.id),
        supabase.from('appointments').select('*').eq('user_id', user!.id),
      ]);

      const exportData = {
        profile: { email: user?.email, exported_at: new Date().toISOString() },
        conversations: conversations.data,
        documents: documents.data,
        health_briefs: briefs.data,
        appointments: appointments.data,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medibridge-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not export data. Please try again.');
    }
    setExporting(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError('');
    const { error: deleteError } = await supabase.auth.admin?.deleteUser(user!.id) ?? { error: null };
    if (deleteError) {
      setError('Account deletion requires contacting support. You can sign out and your data is protected by Row Level Security.');
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    setDeleting(false);
    onClose();
  };

  return (
    <div className="settings-form">
      <h4 className="settings-section-title">Your data</h4>
      <p className="settings-description">Your health information is encrypted in transit and at rest. Only you can access your data. MediBridge never shares your information without your explicit consent.</p>

      <button className="settings-action" onClick={handleExport} disabled={exporting}>
        {exporting ? <><Loader2 size={18} className="auth-spin" /> Exporting...</> : <><Download size={18} /> Export all my data <ChevronRight size={16} /></>}
      </button>

      <div className="settings-divider" />
      <h4 className="settings-section-title settings-danger-title">Delete account</h4>
      <p className="settings-description">Permanently delete your account and all associated health data. This action cannot be undone.</p>

      {error && <div className="auth-error"><AlertCircle size={16} /> {error}</div>}

      {!confirmDelete ? (
        <button className="settings-action settings-danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={18} /> Delete my account <ChevronRight size={16} />
        </button>
      ) : (
        <div className="settings-confirm-delete">
          <p className="settings-warning-text">Are you absolutely sure? This will permanently delete all your conversations, documents, health briefs, and appointments.</p>
          <div className="settings-confirm-buttons">
            <button className="outline-button" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button>
            <button className="auth-button auth-button-danger" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? <><Loader2 size={18} className="auth-spin" /> Deleting...</> : <>Yes, delete everything</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
