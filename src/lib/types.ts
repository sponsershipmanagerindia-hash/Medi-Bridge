export type Database = {
  profiles: {
    Row: { id: string; display_name: string; created_at: string };
    Insert: { id: string; display_name?: string };
    Update: { display_name?: string };
  };
  conversations: {
    Row: { id: string; user_id: string; title: string; created_at: string; updated_at: string };
    Insert: { title?: string };
    Update: { title?: string };
  };
  messages: {
    Row: { id: string; conversation_id: string; user_id: string; role: 'user' | 'assistant'; content: string; created_at: string };
    Insert: { conversation_id: string; role: 'user' | 'assistant'; content: string };
    Update: { content?: string };
  };
  documents: {
    Row: { id: string; user_id: string; file_name: string; document_type: string; storage_path: string | null; extracted_text: string | null; status: string; created_at: string };
    Insert: { file_name: string; document_type?: string; storage_path?: string | null; extracted_text?: string | null; status?: string };
    Update: { file_name?: string; document_type?: string; extracted_text?: string | null; status?: string };
  };
  health_briefs: {
    Row: { id: string; user_id: string; brief_data: BriefData; updated_at: string };
    Insert: { brief_data?: BriefData };
    Update: { brief_data?: BriefData };
  };
  appointments: {
    Row: { id: string; user_id: string; doctor_name: string; specialty: string; appointment_date: string | null; consultation_type: string; status: string; notes: string; created_at: string };
    Insert: { doctor_name: string; specialty?: string; appointment_date?: string | null; consultation_type?: string; status?: string; notes?: string };
    Update: { doctor_name?: string; specialty?: string; appointment_date?: string | null; consultation_type?: string; status?: string; notes?: string };
  };
};

export type BriefData = {
  patientOverview?: { name?: string; age?: string; background?: string };
  medicalHistory?: Array<{ condition: string; date?: string; source?: string; confirmed?: boolean }>;
  medications?: Array<{ name: string; dosage?: string; frequency?: string; source?: string; confirmed?: boolean }>;
  allergies?: Array<{ name: string; source?: string; confirmed?: boolean }>;
  symptoms?: Array<{ description: string; onset?: string; severity?: string; source?: string }>;
  doctorQuestions?: string[];
};

export type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
};
