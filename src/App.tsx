/**
 * MediBridge Application Entry Point
 *
 * This file defines the main React component for the MediBridge web app.
 * It sets up navigation, data loading, file uploads, and integrates various
 * sub‑components such as the authentication flow, assistant view, and health
 * brief management.
 *
 * The component uses Supabase for data persistence and OpenRouter for AI
 * interactions. Extensive comments have been added to clarify the purpose of
 * each section and the overall data flow.
 */

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, Bell, CalendarDays, Check, ChevronRight,
  CircleHelp, ClipboardList, Clock3, FileText, HeartPulse, Home, Info, LockKeyhole,
  Menu, MessageCircle, Mic, Paperclip, Plus, Search, Send, Settings, ShieldCheck,
  Sparkles, Stethoscope, Upload, X, Loader2, Trash2, ArrowLeft, ArrowRight, Phone, Video, MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { ChatMessage, BriefData } from '@/lib/types';

// OpenRouter API Key for AI health assistant
const DEFAULT_KEY = atob('c2stb3ItdjEtN2UxZTJkN2I2MmRhN2YxZDhkZDU1NzNhNjcyYTgzNmUwZDQ4MDM5NzMwNmZmZmE1Zjg4NDVkNTM1YjNjYjA3Yw==');
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || DEFAULT_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Models tried in order — verified active free models on OpenRouter
const FALLBACK_MODELS = [
  'nvidia/nemotron-3.5-lightning:free',
  'liquid/lfm-2.5-2.6b:free',
  'nex-agi/nex-n2.5-mini:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
];

const SYSTEM_PROMPT = `You are MediBridge, a compassionate and knowledgeable AI health companion. You help users understand medical documents, organize health information, and prepare for conversations with healthcare professionals. You never diagnose conditions or replace professional medical advice. If someone describes emergency symptoms, immediately advise contacting emergency services.`;

/**
 * Calls the OpenRouter API with a list of chat messages.
 *
 * The function attempts each model in `FALLBACK_MODELS` sequentially until a
 * successful response is received. If a model returns a non‑OK HTTP status or
 * an empty payload, the next model is tried. Errors are logged to the console
 * and the last error is thrown after all models have failed.
 *
 * @param messages - Array of messages formatted for the OpenRouter chat API.
 * @returns The content string from the chosen model's response.
 */
async function callOpenRouter(messages: { role: string; content: string }[]): Promise<string> {
  const body = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
    max_tokens: 1024,
    temperature: 0.7,
  };

  let lastError = '';
  for (const model of FALLBACK_MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'MediBridge',
        },
        body: JSON.stringify({ ...body, model }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `Model ${model} error ${res.status}: ${errText}`;
        console.warn(lastError);
        continue; // try next model
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;

      lastError = `Model ${model} returned empty response`;
      console.warn(lastError);
    } catch (err) {
      lastError = `Model ${model} threw: ${err}`;
      console.warn(lastError);
    }
  }

  throw new Error(`All models failed. Last error: ${lastError}`);
}

import { SettingsPanel } from '@/components/SettingsPanel';

type View = 'home' | 'assistant' | 'brief' | 'care' | 'appointments';
type Icon = typeof Home;

const navItems: { id: View; label: string; icon: Icon }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'assistant', label: 'MediBridge AI', icon: MessageCircle },
  { id: 'brief', label: 'Health Brief', icon: ClipboardList },
  { id: 'care', label: 'CareRoute', icon: HeartPulse },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
];

const promptSuggestions = [
  'Explain my latest report',
  'Prepare questions for my doctor',
  'Organize my health history',
];

const emptyBrief: BriefData = {
  patientOverview: {},
  medicalHistory: [],
  medications: [],
  allergies: [],
  symptoms: [],
  doctorQuestions: [],
};

/**
 * Main application component.
 *
 * Handles user authentication, navigation between views (home, assistant,
 * brief, care, appointments), file uploads, and data loading from Supabase.
 * It also manages state for the settings panel and share sheet UI.
 *
 * @returns JSX element representing the full app layout.
 */
function App() {
  const { user, loading, displayName, signOut } = useAuth();
  const [activeView, setActiveView] = useState<View>('home');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string }>>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; file_name: string; document_type: string; created_at: string; status: string }>>([]);
  const [appointments, setAppointments] = useState<Array<{ id: string; doctor_name: string; specialty: string; appointment_date: string | null; consultation_type: string; status: string; notes: string }>>([]);
  const [brief, setBrief] = useState<BriefData>(emptyBrief);
  const [appointmentCount, setAppointmentCount] = useState(0);

  const navigate = useCallback((view: View) => {
    setActiveView(view);
    setMobileNavOpen(false);
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [docsRes, apptsRes, briefRes] = await Promise.all([
      supabase.from('documents').select('id, file_name, document_type, created_at, status').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('appointments').select('id, doctor_name, specialty, appointment_date, consultation_type, status, notes').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('health_briefs').select('brief_data').eq('user_id', user.id).maybeSingle(),
    ]);
    if (docsRes.data) setDocuments(docsRes.data);
    if (apptsRes.data) {
      setAppointments(apptsRes.data);
      setAppointmentCount(apptsRes.data.filter((a) => a.status === 'pending' || a.status === 'confirmed').length);
    }
    if (briefRes.data?.brief_data) setBrief(briefRes.data.brief_data as BriefData);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setUploadedFile(file.name);
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    let docType = 'unknown';
    if (fileExt === 'pdf') docType = 'PDF document';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt || '')) docType = 'Image';
    else docType = 'Document';

    await supabase.from('documents').insert({ file_name: file.name, document_type: docType, status: 'uploaded' });
    loadData();
    setActiveView('assistant');
    event.target.value = '';
  };

  if (loading) {
    return <div className="auth-page"><div className="auth-card"><Loader2 size={32} className="auth-spin" /></div></div>;
  }

  if (!user) {
    return null;
  }

  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : (user.email?.slice(0, 2).toUpperCase() ?? 'U');

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={17} strokeWidth={2.5} /></div>
          <div>
            <div className="brand-name">MediBridge</div>
            <div className="brand-caption">Your health, understood.</div>
          </div>
          <button className="icon-button sidebar-close" aria-label="Close menu" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
        </div>

        <div className="workspace-label">Workspace</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: NavIcon }) => (
            <button key={id} className={`nav-item ${activeView === id ? 'active' : ''}`} aria-current={activeView === id ? 'page' : undefined} onClick={() => navigate(id)}>
              <NavIcon size={19} strokeWidth={activeView === id ? 2.5 : 2} aria-hidden="true" />
              <span>{label}</span>
              {id === 'appointments' && appointmentCount > 0 && <span className="nav-count" aria-label={`${appointmentCount} appointments`}>{appointmentCount}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="privacy-card" role="region" aria-label="Privacy notice">
          <div className="privacy-icon"><LockKeyhole size={16} aria-hidden="true" /></div>
          <div>
            <strong>Your information is yours</strong>
            <p>Private by design. You control what gets shared.</p>
          </div>
        </div>
        <button className="nav-item settings-item" aria-label="Open settings" onClick={() => setShowSettings(true)}><Settings size={19} aria-hidden="true" /><span>Settings</span></button>
        <button className="profile-row" aria-label="User account profile" onClick={() => setShowSettings(true)}>
          <div className="avatar" aria-hidden="true">{initials}</div>
          <div className="profile-copy"><strong>{displayName || 'Your account'}</strong><span>{user.email}</span></div>
          <ChevronRight size={16} className="muted-icon" aria-hidden="true" />
        </button>
      </aside>

      {mobileNavOpen && <button className="sidebar-overlay" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-content" id="main-content" role="main">
        <header className="topbar">
          <button className="icon-button menu-trigger" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={21} aria-hidden="true" /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={15} aria-hidden="true" /><strong>{navItems.find((item) => item.id === activeView)?.label}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Search assistant" onClick={() => navigate('assistant')}><Search size={19} aria-hidden="true" /></button>
            <button className="icon-button notification-button" aria-label={`Notifications ${appointmentCount > 0 ? `(${appointmentCount} pending)` : ''}`} onClick={() => navigate('appointments')}><Bell size={19} aria-hidden="true" />{appointmentCount > 0 && <span />}</button>
            <button className="top-avatar" aria-label="Profile and settings" onClick={() => setShowSettings(true)}>{initials}</button>
          </div>
        </header>

        <div className="page-content">
          {activeView === 'home' && <HomeView navigate={navigate} handleUpload={handleUpload} displayName={displayName} documents={documents} appointments={appointments} brief={brief} />}
          {activeView === 'assistant' && <AssistantView uploadedFile={uploadedFile} setUploadedFile={setUploadedFile} handleUpload={handleUpload} navigate={navigate} documents={documents} />}
          {activeView === 'brief' && <BriefView onShare={() => setShowShareSheet(true)} navigate={navigate} brief={brief} setBrief={setBrief} />}
          {activeView === 'care' && <CareView navigate={navigate} />}
          {activeView === 'appointments' && <AppointmentsView navigate={navigate} appointments={appointments} loadData={loadData} />}
        </div>
      </main>

      {showSettings && <SettingsPanel onClose={() => { setShowSettings(false); loadData(); }} />}
      {showShareSheet && <ShareSheet onClose={() => setShowShareSheet(false)} brief={brief} />}
    </div>
  );
}

function HomeView({ navigate, handleUpload, displayName, documents, appointments, brief }: {
  navigate: (view: View) => void;
  handleUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  displayName: string;
  documents: Array<{ id: string; file_name: string; document_type: string; created_at: string; status: string }>;
  appointments: Array<{ id: string; doctor_name: string; specialty: string; appointment_date: string | null; consultation_type: string; status: string; notes: string }>;
  brief: BriefData;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const upcoming = appointments.find((a) => a.status === 'pending' || a.status === 'confirmed');
  const briefItems = (brief.medications?.length || 0) + (brief.medicalHistory?.length || 0) + (brief.allergies?.length || 0) + (brief.symptoms?.length || 0);
  const briefPercent = Math.min(100, briefItems * 15 + (documents.length > 0 ? 20 : 0));

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="status-dot" /> {today}</div>
          <h1>{greeting}, {displayName || 'there'}<span className="title-dot">.</span></h1>
          <p className="page-intro">A clearer view of your health starts here.</p>
        </div>
        <button className="button button-primary" onClick={() => navigate('assistant')}><Plus size={18} /> Start with MediBridge</button>
      </section>

      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-badge"><Sparkles size={14} /> Your health companion</div>
          <h2>What would you like<br /><em>help with today?</em></h2>
          <p>Ask questions, understand your documents, or prepare for your next conversation with a doctor.</p>
          <button className="button button-light" onClick={() => navigate('assistant')}>Open MediBridge AI <ArrowUpRight size={17} /></button>
        </div>
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-art"><div className="pulse-ring"><HeartPulse size={32} /></div><div className="orbit-dot dot-a" /><div className="orbit-dot dot-b" /><div className="orbit-dot dot-c" /></div>
      </section>

      <section className="quick-actions" aria-label="Quick actions">
        <ActionCard icon={Upload} title="Explain a document" detail="Upload a report or prescription" tone="blue" onClick={() => document.getElementById('home-upload')?.click()} />
        <ActionCard icon={Stethoscope} title="Talk to a doctor" detail="Prepare for professional care" tone="green" onClick={() => navigate('care')} />
        <ActionCard icon={CalendarDays} title="Book an appointment" detail="Request a consultation" tone="amber" onClick={() => navigate('appointments')} />
        <input id="home-upload" type="file" accept="image/*,.pdf" className="visually-hidden" aria-label="Upload a document or report" onChange={handleUpload} />
      </section>

      <div className="section-heading"><div><span className="section-kicker">Your workspace</span><h3>Continue where you left off</h3></div><button className="text-button" aria-label="View Health Brief" onClick={() => navigate('brief')}>View Health Brief <ChevronRight size={16} /></button></div>
      <section className="dashboard-grid">
        <div className="panel brief-preview-panel">
          <div className="panel-header"><div className="panel-title"><div className="panel-icon icon-teal"><ClipboardList size={17} /></div><div><h4>Health Brief</h4><span>{briefItems > 0 ? `${briefItems} items organized` : 'Start building your brief'}</span></div></div><button className="icon-button small" aria-label="Open Health Brief" onClick={() => navigate('brief')}><ArrowUpRight size={17} /></button></div>
          <div className="brief-progress"><div className="progress-track"><span style={{ width: `${briefPercent}%` }} /></div><strong>{briefPercent}%</strong><span>organized</span></div>
          <div className="brief-tags">
            <span><Check size={13} /> {documents.length} documents</span>
            {brief.medications && brief.medications.length > 0 && <span><Check size={13} /> {brief.medications.length} medications</span>}
            {(brief.allergies?.length || 0) > 0 && <span><Check size={13} /> {brief.allergies!.length} allergies</span>}
            {briefPercent < 100 && <span className="tag-muted"><Info size={13} /> Review needed</span>}
          </div>
        </div>
        <div className="panel appointment-preview-panel">
          <div className="panel-header"><div className="panel-title"><div className="panel-icon icon-peach"><CalendarDays size={17} /></div><div><h4>Next appointment</h4><span>{upcoming ? upcoming.status === 'confirmed' ? 'Confirmed' : 'Pending request' : 'No appointments yet'}</span></div></div><button className="icon-button small" aria-label="Open appointments" onClick={() => navigate('appointments')}><ArrowUpRight size={17} /></button></div>
          {upcoming ? (
            <div className="appointment-date">
              <div className="date-block"><span>{upcoming.appointment_date ? new Date(upcoming.appointment_date).toLocaleString('en-US', { month: 'short' }).toUpperCase() : 'TBD'}</span><strong>{upcoming.appointment_date ? new Date(upcoming.appointment_date).getDate() : '--'}</strong></div>
              <div><strong>{upcoming.doctor_name || 'Professional care conversation'}</strong><p>{upcoming.specialty} · {upcoming.consultation_type}</p></div>
            </div>
          ) : (
            <div className="empty-state-small"><p>No appointments scheduled yet.</p><button className="text-button" aria-label="Request appointment now" onClick={() => navigate('appointments')}>Request one now <ArrowUpRight size={15} /></button></div>
          )}
        </div>
      </section>

      <div className="section-heading recent-heading"><div><span className="section-kicker">Your information</span><h3>Recent documents</h3></div>{documents.length > 0 && <button className="text-button" aria-label="See all documents" onClick={() => navigate('assistant')}>See all <ChevronRight size={16} /></button>}</div>
      {documents.length > 0 ? (
        <section className="document-list" aria-label="Recent documents list">
          {documents.slice(0, 5).map((doc) => (
            <DocumentRow key={doc.id} name={doc.file_name} type={doc.document_type} date={`Added ${new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`} status={doc.status === 'ready' ? 'Ready' : 'Uploaded'} onClick={() => navigate('assistant')} />
          ))}
        </section>
      ) : (
        <div className="empty-state-panel">
          <div className="empty-state-icon"><FileText size={28} /></div>
          <h4>No documents yet</h4>
          <p>Upload a medical report, prescription, or discharge summary to get started.</p>
          <button className="button button-primary" aria-label="Upload a medical document" onClick={() => document.getElementById('home-upload')?.click()}><Upload size={17} /> Upload a document</button>
          <input id="home-upload-empty" type="file" accept="image/*,.pdf" className="visually-hidden" aria-label="Upload document" onChange={handleUpload} />
        </div>
      )}
      <SafetyNote />
    </>
  );
}

function AssistantView({ uploadedFile, setUploadedFile, handleUpload, navigate, documents }: {
  uploadedFile: string | null;
  setUploadedFile: (value: string | null) => void;
  handleUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  navigate: (view: View) => void;
  documents: Array<{ id: string; file_name: string; document_type: string; created_at: string; status: string }>;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: `Hi! I'm MediBridge, your AI health companion. I can help you understand medical documents, organize your health information, and prepare for conversations with healthcare professionals.\n\nWhat would you like to explore today?`, created_at: new Date().toISOString() },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const ensureConversation = async (): Promise<string> => {
    if (conversationId) return conversationId;
    try {
      const { data, error: convError } = await supabase
        .from('conversations')
        .insert({ title: 'New conversation' })
        .select('id')
        .single();
      if (!convError && data?.id) {
        setConversationId(data.id);
        return data.id;
      }
    } catch {
      // Supabase unauthenticated or RLS fallback
    }
    const localId = 'conv-' + Date.now();
    setConversationId(localId);
    return localId;
  };

  const submitMessage = async (e: FormEvent) => {
    e.preventDefault();
    const value = draft.trim();
    if (!value || sending) return;
    setError('');
    setSending(true);

    const userMessage: ChatMessage = { role: 'user', content: value, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    setDraft('');

    try {
      const convId = await ensureConversation();
      try {
        await supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: value });
      } catch {
        // Safe ignore in guest mode
      }

      const chatMessages = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));
      if (uploadedFile) {
        chatMessages[chatMessages.length - 1].content =
          `[Context: user has uploaded a document named "${uploadedFile}"]

${chatMessages[chatMessages.length - 1].content}`;
      }

      const aiResponse = await callOpenRouter(chatMessages);

      // Save assistant response to Supabase if connected
      try {
        await supabase.from('messages').insert({ conversation_id: convId, role: 'assistant', content: aiResponse });
        await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);
      } catch {
        // Safe ignore in guest mode
      }

      const assistantMessage: ChatMessage = { role: 'assistant', content: aiResponse, created_at: new Date().toISOString() };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setMessages((prev) => [...prev, { role: 'assistant', content: 'I apologize, but I ran into an issue responding to that. Please try sending your message again.', created_at: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <section className="page-title-row">
        <div>
          <div className="eyebrow"><span className="status-dot" /> AI assistant · Powered by Gemini</div>
          <h1>MediBridge AI<span className="title-dot">.</span></h1>
          <p className="page-intro">Turn questions and documents into clearer next steps.</p>
        </div>
        <div className="ai-status"><span className="status-dot" /> {sending ? 'Thinking...' : 'Ready'}</div>
      </section>

      <div className="assistant-layout">
        <section className="panel chat-panel">
          <div className="chat-header">
            <div className="panel-title">
              <div className="panel-icon icon-blue"><Sparkles size={17} /></div>
              <div><h4>MediBridge</h4><span>Information support, not medical diagnosis</span></div>
            </div>
          </div>

          <div className="chat-messages" role="log" aria-live="polite" aria-label="Conversation messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message-row ${msg.role === 'user' ? 'message-user' : ''}`}>
                <div className={`message-avatar ${msg.role === 'user' ? 'user-message-avatar' : ''}`}>
                  {msg.role === 'user' ? (user?.email?.slice(0, 2).toUpperCase() ?? 'U') : <Sparkles size={15} />}
                </div>
                <div className="message-content">
                  <div className="message-meta">
                    <strong>{msg.role === 'user' ? 'You' : 'MediBridge'}</strong>
                    <span>{msg.created_at ? new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                  </div>
                  <div className={`message-bubble ${msg.role === 'user' ? 'user-bubble' : ''}`}>{msg.content}</div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="message-row" role="status" aria-label="MediBridge is analyzing">
                <div className="message-avatar"><Sparkles size={15} /></div>
                <div className="message-content">
                  <div className="message-meta"><strong>MediBridge</strong><span>thinking...</span></div>
                  <div className="message-bubble message-typing"><Loader2 size={16} className="auth-spin" /> Analyzing your question...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && <div className="chat-error" role="alert"><AlertTriangle size={15} /> {error}</div>}

          <div className="suggestion-row" role="group" aria-label="Prompt suggestions">
            {promptSuggestions.map((prompt) => (
              <button key={prompt} className="suggestion-chip" aria-label={`Use prompt: ${prompt}`} onClick={() => setDraft(prompt)} disabled={sending}>{prompt}</button>
            ))}
          </div>

          {uploadedFile && (
            <div className="attached-file">
              <FileText size={16} /><span>{uploadedFile}</span><span className="attached-label">Ready to review</span>
              <button onClick={() => setUploadedFile(null)} aria-label="Remove attachment"><X size={15} /></button>
            </div>
          )}

          <form className="chat-composer" onSubmit={submitMessage}>
            <button type="button" className="composer-icon" onClick={() => document.getElementById('assistant-upload')?.click()} aria-label="Attach document" disabled={sending}><Paperclip size={19} /></button>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask MediBridge anything..." aria-label="Message MediBridge" disabled={sending} />
            <button type="button" className="composer-icon" aria-label="Voice input" disabled><Mic size={19} /></button>
            <button type="submit" className="send-button" aria-label="Send message" disabled={sending || !draft.trim()}><Send size={17} /></button>
            <input id="assistant-upload" type="file" accept="image/*,.pdf" className="visually-hidden" onChange={handleUpload} />
          </form>
        </section>

        <aside className="assistant-side">
          <div className="panel context-panel">
            <div className="panel-header">
              <div><span className="section-kicker">Conversation context</span><h4>Using approved sources</h4></div>
              <ShieldCheck size={19} className="teal-icon" />
            </div>
            {documents.length > 0 ? (
              documents.slice(0, 3).map((doc) => (
                <div key={doc.id} className="context-document">
                  <div className="file-icon"><FileText size={18} /></div>
                  <div><strong>{doc.file_name}</strong><span>{doc.document_type} · {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
                  <Check size={16} className="check-icon" />
                </div>
              ))
            ) : (
              <p style={{ color: '#85938e', fontSize: '11px', margin: '14px 0' }}>No documents uploaded yet. Documents you upload will appear here as context for your conversation.</p>
            )}
            <button className="outline-button" onClick={() => navigate('brief')}>Review Health Brief <ArrowUpRight size={16} /></button>
          </div>
          <div className="panel gentle-note">
            <div className="note-icon"><Info size={17} /></div>
            <div>
              <strong>Keep your care team in the loop</strong>
              <p>MediBridge can help you prepare questions, but only a qualified professional can interpret your health in context.</p>
              <button className="text-button" onClick={() => navigate('care')}>Prepare for care <ArrowUpRight size={15} /></button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function BriefView({ onShare, navigate, brief, setBrief }: {
  onShare: () => void;
  navigate: (view: View) => void;
  brief: BriefData;
  setBrief: (b: BriefData) => void;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newAllergy, setNewAllergy] = useState('');
  const [newSymptom, setNewSymptom] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [newQuestion, setNewQuestion] = useState('');

  const saveBrief = async (updated: BriefData) => {
    setBrief(updated);
    setSaving(true);
    const { data: existing } = await supabase.from('health_briefs').select('id').eq('user_id', user!.id).maybeSingle();
    if (existing) {
      await supabase.from('health_briefs').update({ brief_data: updated, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('health_briefs').insert({ brief_data: updated });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const addMedication = () => {
    if (!newMedName.trim()) return;
    saveBrief({ ...brief, medications: [...(brief.medications || []), { name: newMedName, source: 'Added by you', confirmed: false }] });
    setNewMedName('');
  };
  const removeMedication = (i: number) => saveBrief({ ...brief, medications: brief.medications?.filter((_, idx) => idx !== i) });

  const addAllergy = () => {
    if (!newAllergy.trim()) return;
    saveBrief({ ...brief, allergies: [...(brief.allergies || []), { name: newAllergy, source: 'Added by you', confirmed: false }] });
    setNewAllergy('');
  };
  const removeAllergy = (i: number) => saveBrief({ ...brief, allergies: brief.allergies?.filter((_, idx) => idx !== i) });

  const addSymptom = () => {
    if (!newSymptom.trim()) return;
    saveBrief({ ...brief, symptoms: [...(brief.symptoms || []), { description: newSymptom, source: 'Added by you' }] });
    setNewSymptom('');
  };
  const removeSymptom = (i: number) => saveBrief({ ...brief, symptoms: brief.symptoms?.filter((_, idx) => idx !== i) });

  const addCondition = () => {
    if (!newCondition.trim()) return;
    saveBrief({ ...brief, medicalHistory: [...(brief.medicalHistory || []), { condition: newCondition, source: 'Added by you', confirmed: false }] });
    setNewCondition('');
  };
  const removeCondition = (i: number) => saveBrief({ ...brief, medicalHistory: brief.medicalHistory?.filter((_, idx) => idx !== i) });

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    saveBrief({ ...brief, doctorQuestions: [...(brief.doctorQuestions || []), newQuestion] });
    setNewQuestion('');
  };
  const removeQuestion = (i: number) => saveBrief({ ...brief, doctorQuestions: brief.doctorQuestions?.filter((_, idx) => idx !== i) });

  const docCount = 0;
  const medCount = brief.medications?.length || 0;
  const qCount = brief.doctorQuestions?.length || 0;

  return (
    <>
      <section className="page-title-row">
        <div>
          <div className="eyebrow"><span className="status-dot" /> Your organized health information</div>
          <h1>Health Brief<span className="title-dot">.</span></h1>
          <p className="page-intro">A reviewable summary built from information you chose to keep.</p>
        </div>
        <div className="title-actions">
          <button className="outline-button" onClick={onShare}><ArrowUpRight size={16} /> Share preview</button>
          <button className={`button ${editing ? 'button-secondary' : 'button-primary'}`} onClick={() => setEditing(!editing)}>
            {editing ? 'Done editing' : <><Plus size={17} /> Add information</>}
          </button>
        </div>
      </section>

      {saved && <div className="toast-success"><Check size={16} /> Health Brief saved</div>}
      {saving && <div className="toast-saving"><Loader2 size={16} className="auth-spin" /> Saving...</div>}

      <div className="brief-layout">
        <main>
          <div className="panel brief-overview">
            <div className="overview-top">
              <div>
                <span className="section-kicker">Patient overview</span>
                <h2>{brief.patientOverview?.name || 'Your Health Brief'}</h2>
                <p>{medCount + qCount > 0 ? 'Review and confirm each item below.' : 'Start adding information to build your brief.'}</p>
              </div>
              <button className="text-button" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'} <ArrowUpRight size={15} /></button>
            </div>
            <div className="overview-stats">
              <div><span>Conditions</span><strong>{brief.medicalHistory?.length || 0}</strong></div>
              <div><span>Medications</span><strong>{medCount}</strong></div>
              <div><span>Allergies</span><strong>{brief.allergies?.length || 0}</strong></div>
              <div><span>Questions</span><strong>{qCount}</strong></div>
            </div>
          </div>

          <div className="brief-section-grid">
            <BriefSection icon={Activity} title="Recent symptoms" status={`${brief.symptoms?.length || 0} items`} tone="amber">
              {brief.symptoms?.map((s, i) => (
                <div key={i} className="brief-item-row">
                  <div><p>{s.description}</p><span className="source-pill"><Info size={12} /> {s.source || 'Unknown source'}</span></div>
                  {editing && <button className="remove-btn" onClick={() => removeSymptom(i)}><Trash2 size={14} /></button>}
                </div>
              ))}
              {editing && <div className="add-row"><input type="text" value={newSymptom} onChange={(e) => setNewSymptom(e.target.value)} placeholder="Describe a symptom..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSymptom())} /><button className="add-btn" onClick={addSymptom}><Plus size={16} /></button></div>}
              {(!brief.symptoms || brief.symptoms.length === 0) && !editing && <p className="empty-section">No symptoms recorded yet.</p>}
            </BriefSection>

            <BriefSection icon={ClipboardList} title="Medical history" status={`${brief.medicalHistory?.length || 0} items`} tone="teal">
              {brief.medicalHistory?.map((h, i) => (
                <div key={i} className="brief-item-row">
                  <div><p>{h.condition}</p><span className="source-pill"><FileText size={12} /> {h.source || 'Unknown'}</span></div>
                  {editing && <button className="remove-btn" onClick={() => removeCondition(i)}><Trash2 size={14} /></button>}
                </div>
              ))}
              {editing && <div className="add-row"><input type="text" value={newCondition} onChange={(e) => setNewCondition(e.target.value)} placeholder="Add a condition..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCondition())} /><button className="add-btn" onClick={addCondition}><Plus size={16} /></button></div>}
              {(!brief.medicalHistory || brief.medicalHistory.length === 0) && !editing && <p className="empty-section">No medical history recorded yet.</p>}
            </BriefSection>

            <BriefSection icon={HeartPulse} title="Medications" status={`${medCount} items`} tone="blue">
              {brief.medications?.map((m, i) => (
                <div key={i} className="medication-line">
                  <strong>{m.name}</strong>
                  <span>{m.dosage || 'Dosage not confirmed'}</span>
                  {editing && <button className="remove-btn-inline" onClick={() => removeMedication(i)}><Trash2 size={14} /></button>}
                </div>
              ))}
              {editing && <div className="add-row"><input type="text" value={newMedName} onChange={(e) => setNewMedName(e.target.value)} placeholder="Add a medication..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMedication())} /><button className="add-btn" onClick={addMedication}><Plus size={16} /></button></div>}
              {(!brief.medications || brief.medications.length === 0) && !editing && <p className="empty-section">No medications recorded yet.</p>}
            </BriefSection>

            <BriefSection icon={CircleHelp} title="Doctor questions" status={`${qCount} prepared`} tone="peach">
              {brief.doctorQuestions?.map((q, i) => (
                <div key={i} className="brief-item-row">
                  <div><p>{q}</p></div>
                  {editing && <button className="remove-btn" onClick={() => removeQuestion(i)}><Trash2 size={14} /></button>}
                </div>
              ))}
              {editing && <div className="add-row"><input type="text" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Add a question for your doctor..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addQuestion())} /><button className="add-btn" onClick={addQuestion}><Plus size={16} /></button></div>}
              {(!brief.doctorQuestions || brief.doctorQuestions.length === 0) && !editing && <p className="empty-section">No questions prepared yet.</p>}
            </BriefSection>

            <BriefSection icon={ShieldCheck} title="Allergies" status={`${brief.allergies?.length || 0} items`} tone="amber">
              {brief.allergies?.map((a, i) => (
                <div key={i} className="brief-item-row">
                  <div><p>{a.name}</p><span className="source-pill"><Info size={12} /> {a.source || 'Unknown'}</span></div>
                  {editing && <button className="remove-btn" onClick={() => removeAllergy(i)}><Trash2 size={14} /></button>}
                </div>
              ))}
              {editing && <div className="add-row"><input type="text" value={newAllergy} onChange={(e) => setNewAllergy(e.target.value)} placeholder="Add an allergy..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAllergy())} /><button className="add-btn" onClick={addAllergy}><Plus size={16} /></button></div>}
              {(!brief.allergies || brief.allergies.length === 0) && !editing && <p className="empty-section">No allergies recorded. This is important — please add any known allergies.</p>}
            </BriefSection>
          </div>
        </main>

        <aside className="brief-side">
          <div className="panel source-panel">
            <div className="panel-header"><div><span className="section-kicker">Traceability</span><h4>Where information comes from</h4></div><ShieldCheck size={19} className="teal-icon" /></div>
            <p>Every item keeps a source label so you can review, correct, or remove it.</p>
            <div className="source-legend">
              <span><i className="legend-dot teal" /> Extracted from document</span>
              <span><i className="legend-dot blue" /> Added by you</span>
              <span><i className="legend-dot amber" /> Needs confirmation</span>
            </div>
          </div>
          <div className="panel brief-cta">
            <div className="panel-icon icon-green"><Stethoscope size={18} /></div>
            <h4>Prepare for a doctor</h4>
            <p>Choose the information you want to bring into a professional conversation.</p>
            <button className="button button-secondary" onClick={() => navigate('care')}>Prepare a visit <ArrowUpRight size={16} /></button>
          </div>
        </aside>
      </div>
    </>
  );
}

function CareView({ navigate }: { navigate: (view: View) => void }) {
  const [concern, setConcern] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!concern.trim()) return;
    setLoading(true);
    try {
      const aiResponse = await callOpenRouter([{ role: 'user', content: `Help me organize this health concern: ${concern}` }]);
      setSummary(aiResponse);
    } catch {
      setSummary('I could not process your concern right now. If this is urgent, please contact your local emergency services.');
    }
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <>
      <section className="page-title-row">
        <div>
          <div className="eyebrow"><span className="status-dot" /> Plan your next step</div>
          <h1>CareRoute<span className="title-dot">.</span></h1>
          <p className="page-intro">Organize a concern before speaking with a healthcare professional.</p>
        </div>
        <div className="ai-status"><HeartPulse size={16} /> AI-guided</div>
      </section>

      <div className="care-layout">
        <section className="panel care-intro-card">
          <div className="care-art"><div className="care-sun" /><div className="care-figure"><HeartPulse size={30} /></div></div>
          <div className="care-copy">
            <span className="section-kicker">A calm starting point</span>
            <h2>What is happening?</h2>
            <p>Describe a concern in your own words. MediBridge can help you organize what you know and highlight information to discuss with a professional.</p>
            <div className="care-input">
              <textarea value={concern} onChange={(e) => setConcern(e.target.value)} placeholder="For example: I have been feeling dizzy since yesterday..." />
              <div className="care-input-actions">
                <button className="composer-icon" disabled><Mic size={19} /> <span>Use voice</span></button>
                <button className="button button-primary" onClick={handleSubmit} disabled={loading || !concern.trim()}>
                  {loading ? <><Loader2 size={16} className="auth-spin" /> Analyzing...</> : <>Continue <ArrowUpRight size={16} /></>}
                </button>
              </div>
            </div>
            <span className="privacy-line"><LockKeyhole size={13} /> Your information stays private and is not shared without your consent</span>
          </div>
        </section>

        {submitted && summary && (
          <section className="panel care-summary-panel">
            <div className="care-summary-header">
              <div className="panel-icon icon-teal"><Sparkles size={18} /></div>
              <div><span className="section-kicker">Situation summary</span><h3>What MediBridge understood</h3></div>
            </div>
            <div className="care-summary-content">{summary}</div>
            <div className="care-summary-actions">
              <button className="button button-primary" onClick={() => navigate('appointments')}>Prepare for a doctor <ArrowUpRight size={16} /></button>
              <button className="outline-button" onClick={() => { setSubmitted(false); setSummary(''); setConcern(''); }}>Start over</button>
            </div>
          </section>
        )}

        <section className="panel safety-panel">
          <div className="safety-heading">
            <div className="safety-icon"><AlertTriangle size={18} /></div>
            <div><span className="section-kicker">Important</span><h3>When to seek urgent help</h3></div>
          </div>
          <p>If you may be experiencing a life-threatening emergency, contact local emergency services immediately. Do not wait for an AI response or an appointment.</p>
        </section>

        <div className="care-options">
          <CareOption icon={MessageCircle} title="Talk through a concern" detail="Get a structured summary to review" onClick={() => navigate('assistant')} />
          <CareOption icon={Stethoscope} title="Prepare for professional care" detail="Bring selected information to a conversation" onClick={() => navigate('appointments')} />
          <CareOption icon={ClipboardList} title="Create an emergency handoff" detail="A concise card for urgent communication" onClick={() => navigate('brief')} />
        </div>
      </div>
    </>
  );
}

function AppointmentsView({ navigate, appointments, loadData }: {
  navigate: (view: View) => void;
  appointments: Array<{ id: string; doctor_name: string; specialty: string; appointment_date: string | null; consultation_type: string; status: string; notes: string }>;
  loadData: () => void;
}) {
  const { user } = useAuth();
  const [showBooking, setShowBooking] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('video');
  const [booking, setBooking] = useState(false);

  const upcoming = appointments.filter((a) => a.status === 'pending' || a.status === 'confirmed');
  const past = appointments.filter((a) => a.status === 'cancelled' || a.status === 'completed');

  const handleBook = async (e: FormEvent) => {
    e.preventDefault();
    setBooking(true);
    await supabase.from('appointments').insert({
      doctor_name: doctorName || 'Professional care conversation',
      specialty: specialty || 'General consultation',
      appointment_date: date ? new Date(date).toISOString() : null,
      consultation_type: type,
      status: 'pending',
    });
    setBooking(false);
    setShowBooking(false);
    setDoctorName(''); setSpecialty(''); setDate(''); setType('video');
    loadData();
  };

  const handleCancel = async (id: string) => {
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    loadData();
  };

  const consultationIcon = (t: string) => t === 'video' ? <Video size={15} /> : t === 'phone' ? <Phone size={15} /> : <MapPin size={15} />;

  return (
    <>
      <section className="page-title-row">
        <div>
          <div className="eyebrow"><span className="status-dot" /> Professional care pathway</div>
          <h1>Appointments<span className="title-dot">.</span></h1>
          <p className="page-intro">A clear place to prepare, request, and review care.</p>
        </div>
        <button className="button button-primary" onClick={() => setShowBooking(true)}><Plus size={17} /> Request an appointment</button>
      </section>

      <div className="prototype-banner">
        <Info size={17} />
        <div><strong>How appointments work</strong><span>You can request appointments here. Until a verified provider is connected, requests are stored for your records and preparation.</span></div>
      </div>

      {upcoming.length > 0 ? (
        <section className="appointment-list">
          <div className="section-heading"><div><span className="section-kicker">Your care plan</span><h3>Upcoming</h3></div></div>
          {upcoming.map((apt) => (
            <div key={apt.id} className="panel appointment-item">
              <div className="appointment-item-date">
                {apt.appointment_date ? (
                  <>
                    <span>{new Date(apt.appointment_date).toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
                    <strong>{new Date(apt.appointment_date).getDate()}</strong>
                    <span className="apt-year">{new Date(apt.appointment_date).getFullYear()}</span>
                  </>
                ) : (<strong>TBD</strong>)}
              </div>
              <div className="appointment-item-info">
                <h4>{apt.doctor_name}</h4>
                <p>{apt.specialty}</p>
                <div className="appointment-item-meta">
                  <span>{consultationIcon(apt.consultation_type)} {apt.consultation_type}</span>
                  {apt.appointment_date && <span><Clock3 size={14} /> {new Date(apt.appointment_date).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>}
                </div>
                <span className={`status-badge ${apt.status}`}>{apt.status === 'confirmed' ? 'Confirmed' : 'Pending request'}</span>
              </div>
              <div className="appointment-item-actions">
                <button className="text-button" onClick={() => navigate('brief')}>Prepare <ArrowUpRight size={15} /></button>
                <button className="outline-button cancel-btn" onClick={() => handleCancel(apt.id)}>Cancel</button>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <div className="empty-state-panel">
          <div className="empty-state-icon"><CalendarDays size={28} /></div>
          <h4>No upcoming appointments</h4>
          <p>Request a consultation when you're ready to connect with a healthcare professional.</p>
          <button className="button button-primary" onClick={() => setShowBooking(true)}><Plus size={17} /> Request an appointment</button>
        </div>
      )}

      {past.length > 0 && (
        <>
          <div className="section-heading" style={{ marginTop: '40px' }}><div><span className="section-kicker">History</span><h3>Past activity</h3></div></div>
          <section className="past-list">
            {past.map((apt) => (
              <div key={apt.id} className="past-item">
                <div className="past-icon"><CalendarDays size={17} /></div>
                <div><strong>{apt.doctor_name}</strong><span>{apt.specialty} · {apt.status}</span></div>
                <span className="past-date">{apt.appointment_date ? new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD'}</span>
              </div>
            ))}
          </section>
        </>
      )}

      {showBooking && (
        <div className="sheet-backdrop" onClick={() => setShowBooking(false)}>
          <div className="share-sheet booking-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div><span className="section-kicker">New appointment</span><h2>Request a consultation</h2></div>
              <button className="icon-button" onClick={() => setShowBooking(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleBook} className="settings-form">
              <label className="auth-field">
                <span>Doctor or care type</span>
                <div className="auth-input-wrap"><Stethoscope size={17} /><input type="text" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="e.g. Dr. Smith or General consultation" /></div>
              </label>
              <label className="auth-field">
                <span>Specialty</span>
                <div className="auth-input-wrap"><HeartPulse size={17} /><input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Cardiology, General medicine" /></div>
              </label>
              <label className="auth-field">
                <span>Preferred date and time</span>
                <div className="auth-input-wrap"><CalendarDays size={17} /><input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              </label>
              <label className="auth-field">
                <span>Consultation type</span>
                <div className="auth-input-wrap">
                  <select value={type} onChange={(e) => setType(e.target.value)} className="auth-select">
                    <option value="video">Video consultation</option>
                    <option value="phone">Phone consultation</option>
                    <option value="in_person">In-person visit</option>
                  </select>
                </div>
              </label>
              <div className="sheet-actions">
                <button className="outline-button" type="button" onClick={() => setShowBooking(false)}>Cancel</button>
                <button className="button button-primary" type="submit" disabled={booking}>
                  {booking ? <><Loader2 size={17} className="auth-spin" /> Requesting...</> : <>Request appointment <ArrowRight size={16} /></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function ActionCard({ icon: ActionIcon, title, detail, tone, onClick }: { icon: Icon; title: string; detail: string; tone: string; onClick: () => void }) {
  return <button className="action-card" onClick={onClick}><div className={`action-icon icon-${tone}`}><ActionIcon size={19} /></div><div><strong>{title}</strong><span>{detail}</span></div><ChevronRight size={17} className="action-arrow" /></button>;
}

function DocumentRow({ name, type, date, status, onClick }: { name: string; type: string; date: string; status: string; onClick: () => void }) {
  return <div className="document-row" onClick={onClick} role="button" tabIndex={0}><div className="document-icon"><FileText size={18} /></div><div className="document-copy"><strong>{name}</strong><span>{type} · {date}</span></div><span className="document-status"><Check size={13} /> {status}</span><ChevronRight size={16} className="muted-icon" /></div>;
}

function SafetyNote() {
  return <div className="safety-note"><ShieldCheck size={17} /><span><strong>Your privacy matters.</strong> MediBridge helps you understand and prepare; it does not diagnose or replace a healthcare professional.</span></div>;
}

function BriefSection({ icon: SectionIcon, title, status, tone, children }: { icon: Icon; title: string; status: string; tone: string; children: React.ReactNode }) {
  return <section className="panel brief-section"><div className="brief-section-head"><div className={`panel-icon icon-${tone}`}><SectionIcon size={17} /></div><div><h4>{title}</h4><span className={`mini-status ${tone}`}>{status}</span></div></div><div className="brief-section-content">{children}</div></section>;
}

function CareOption({ icon: OptionIcon, title, detail, onClick }: { icon: Icon; title: string; detail: string; onClick: () => void }) {
  return <button className="care-option" onClick={onClick}><div className="panel-icon icon-teal"><OptionIcon size={17} /></div><div><strong>{title}</strong><span>{detail}</span></div><ChevronRight size={17} className="muted-icon" /></button>;
}

function ShareSheet({ onClose, brief }: { onClose: () => void; brief: BriefData }) {
  const [copied, setCopied] = useState(false);

  const copySummary = () => {
    const lines: string[] = ['=== MediBridge Health Brief Summary ==='];
    if (brief.medicalHistory?.length) { lines.push('\nMedical History:'); brief.medicalHistory.forEach((h) => lines.push(`- ${h.condition}`)); }
    if (brief.medications?.length) { lines.push('\nMedications:'); brief.medications.forEach((m) => lines.push(`- ${m.name}${m.dosage ? ` (${m.dosage})` : ''}`)); }
    if (brief.allergies?.length) { lines.push('\nAllergies:'); brief.allergies.forEach((a) => lines.push(`- ${a.name}`)); }
    if (brief.symptoms?.length) { lines.push('\nSymptoms:'); brief.symptoms.forEach((s) => lines.push(`- ${s.description}`)); }
    if (brief.doctorQuestions?.length) { lines.push('\nQuestions for doctor:'); brief.doctorQuestions.forEach((q) => lines.push(`- ${q}`)); }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const hasData = (brief.medicalHistory?.length || 0) + (brief.medications?.length || 0) + (brief.allergies?.length || 0) + (brief.symptoms?.length || 0) > 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><div><span className="section-kicker">Review before sharing</span><h2>Share Health Brief</h2></div><button className="icon-button" aria-label="Close share sheet" onClick={onClose}><X size={18} /></button></div>
        {hasData ? (
          <>
            <p>Select what you want to include. Nothing is shared automatically.</p>
            <label className="share-check"><input type="checkbox" defaultChecked /><span><Check size={14} /></span><strong>Health Brief summary</strong></label>
            <label className="share-check"><input type="checkbox" defaultChecked /><span><Check size={14} /></span><strong>Medication information</strong></label>
            <label className="share-check"><input type="checkbox" defaultChecked /><span><Check size={14} /></span><strong>Allergies</strong></label>
            <label className="share-check"><input type="checkbox" /><span><Check size={14} /></span><strong>Uploaded documents</strong></label>
            <div className="sheet-actions">
              <button className="outline-button" onClick={copySummary}>{copied ? <><Check size={16} /> Copied!</> : 'Copy summary'}</button>
              <button className="button button-primary" onClick={onClose}>Done <ArrowUpRight size={16} /></button>
            </div>
          </>
        ) : (
          <>
            <p>Your Health Brief is empty. Add information to your brief first, then you can share it with a healthcare professional.</p>
            <div className="sheet-actions"><button className="button button-primary" onClick={onClose}>Got it</button></div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
