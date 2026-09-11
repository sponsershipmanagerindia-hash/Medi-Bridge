import { describe, it, expect } from 'vitest';
import type { ChatMessage, BriefData, Appointment, DocumentItem } from '../lib/types';

describe('MediBridge Data Types and Contracts', () => {
  it('should validate ChatMessage structure and roles', () => {
    const userMsg: ChatMessage = {
      role: 'user',
      content: 'Can you explain my lipid panel test?',
      created_at: new Date().toISOString(),
    };
    expect(userMsg.role).toBe('user');
    expect(userMsg.content).toBeTruthy();
    expect(new Date(userMsg.created_at).getTime()).toBeGreaterThan(0);

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: 'Your lipid panel shows total cholesterol...',
      created_at: new Date().toISOString(),
    };
    expect(assistantMsg.role).toBe('assistant');
  });

  it('should validate Health Brief structure with medical categories', () => {
    const sampleBrief: BriefData = {
      summary: 'Patient presenting with mild seasonal allergies.',
      symptoms: ['Sneezing', 'Watery eyes', 'Mild congestion'],
      medications: [
        { name: 'Cetirizine', dosage: '10mg once daily' },
        { name: 'Fluticasone', dosage: '2 sprays per nostril' },
      ],
      allergies: ['Penicillin', 'Pollen'],
      conditions: ['Allergic rhinitis'],
      vitals: {
        blood_pressure: '120/80',
        heart_rate: '72 bpm',
        temperature: '98.6 F',
      },
      next_steps: ['Follow up with allergist in 4 weeks', 'Keep symptom log'],
    };

    expect(sampleBrief.summary).toBeDefined();
    expect(sampleBrief.symptoms).toHaveLength(3);
    expect(sampleBrief.medications).toHaveLength(2);
    expect(sampleBrief.vitals?.blood_pressure).toBe('120/80');
    expect(sampleBrief.allergies).toContain('Penicillin');
  });

  it('should validate Appointment scheduling model', () => {
    const appt: Appointment = {
      id: 'apt-101',
      doctor_name: 'Dr. Sarah Jenkins',
      specialty: 'Cardiology',
      appointment_date: new Date(Date.now() + 86400000).toISOString(),
      consultation_type: 'video',
      status: 'confirmed',
      notes: 'Annual heart rhythm checkup',
    };

    expect(appt.doctor_name).toBe('Dr. Sarah Jenkins');
    expect(['video', 'phone', 'in_person']).toContain(appt.consultation_type);
    expect(['pending', 'confirmed', 'cancelled', 'completed']).toContain(appt.status);
  });

  it('should validate DocumentItem storage metadata', () => {
    const doc: DocumentItem = {
      id: 'doc-001',
      file_name: 'blood_test_results_2026.pdf',
      document_type: 'Lab Report',
      created_at: new Date().toISOString(),
      status: 'ready',
    };

    expect(doc.file_name.endsWith('.pdf')).toBe(true);
    expect(['uploaded', 'processing', 'ready', 'error']).toContain(doc.status);
  });
});
