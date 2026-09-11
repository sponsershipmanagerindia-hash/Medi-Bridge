import { describe, it, expect } from 'vitest';
import type { BriefData } from '../lib/types';

export function formatHealthBriefForDoctor(brief: BriefData): string {
  const sections: string[] = [];
  sections.push(`SUMMARY:\n${brief.summary}`);

  if (brief.symptoms && brief.symptoms.length > 0) {
    sections.push(`ACTIVE SYMPTOMS:\n- ${brief.symptoms.join('\n- ')}`);
  }

  if (brief.medications && brief.medications.length > 0) {
    const meds = brief.medications.map(m => `${m.name} (${m.dosage})`).join('\n- ');
    sections.push(`CURRENT MEDICATIONS:\n- ${meds}`);
  }

  if (brief.allergies && brief.allergies.length > 0) {
    sections.push(`KNOWN ALLERGIES:\n- ${brief.allergies.join(', ')}`);
  }

  if (brief.vitals) {
    const vitalsStr = Object.entries(brief.vitals)
      .map(([k, v]) => `${k.replace('_', ' ')}: ${v}`)
      .join(' | ');
    sections.push(`VITALS:\n${vitalsStr}`);
  }

  return sections.join('\n\n');
}

describe('Health Brief Formatting & Export', () => {
  it('should generate a structured clinical summary from brief data', () => {
    const brief: BriefData = {
      summary: 'Patient recovering from bronchitis.',
      symptoms: ['Mild productive cough', 'Slight fatigue'],
      medications: [
        { name: 'Amoxicillin', dosage: '500mg TID' },
        { name: 'Albuterol Inhaler', dosage: '90mcg PRN' },
      ],
      allergies: ['Sulfa drugs'],
      vitals: { blood_pressure: '118/76', heart_rate: '68 bpm' },
    };

    const formatted = formatHealthBriefForDoctor(brief);
    expect(formatted).toContain('SUMMARY:');
    expect(formatted).toContain('ACTIVE SYMPTOMS:');
    expect(formatted).toContain('- Mild productive cough');
    expect(formatted).toContain('CURRENT MEDICATIONS:');
    expect(formatted).toContain('Amoxicillin (500mg TID)');
    expect(formatted).toContain('Sulfa drugs');
    expect(formatted).toContain('blood pressure: 118/76');
  });

  it('should safely handle briefs with missing optional fields', () => {
    const minimalBrief: BriefData = {
      summary: 'Routine wellness check.',
      symptoms: [],
      medications: [],
      allergies: [],
    };

    const formatted = formatHealthBriefForDoctor(minimalBrief);
    expect(formatted).toContain('SUMMARY:');
    expect(formatted).not.toContain('ACTIVE SYMPTOMS:');
    expect(formatted).not.toContain('CURRENT MEDICATIONS:');
  });
});
