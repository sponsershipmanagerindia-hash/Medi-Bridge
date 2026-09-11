import { describe, it, expect } from 'vitest';

// Triage scoring & classification utility for medical emergency detection
export function assessSymptomUrgency(symptoms: string[]): {
  level: 'emergency' | 'urgent' | 'routine' | 'self_care';
  recommendedAction: string;
} {
  const normalized = symptoms.map(s => s.toLowerCase());
  
  const emergencyKeywords = [
    'chest pain',
    'difficulty breathing',
    'shortness of breath',
    'severe bleeding',
    'sudden weakness',
    'numbness on one side',
    'loss of consciousness',
    'anaphylaxis',
  ];

  const urgentKeywords = [
    'high fever',
    'persistent vomiting',
    'severe abdominal pain',
    'deep cut',
    'broken bone',
    'burn',
  ];

  const hasEmergency = normalized.some(s => emergencyKeywords.some(kw => s.includes(kw)));
  if (hasEmergency) {
    return {
      level: 'emergency',
      recommendedAction: 'Call emergency services (911/112) or go to the nearest emergency department immediately.',
    };
  }

  const hasUrgent = normalized.some(s => urgentKeywords.some(kw => s.includes(kw)));
  if (hasUrgent) {
    return {
      level: 'urgent',
      recommendedAction: 'Visit an urgent care clinic or contact your primary healthcare provider today.',
    };
  }

  if (symptoms.length > 0) {
    return {
      level: 'routine',
      recommendedAction: 'Schedule a consultation with your doctor or primary care provider.',
    };
  }

  return {
    level: 'self_care',
    recommendedAction: 'Monitor symptoms at home with rest, hydration, and OTC care as appropriate.',
  };
}

describe('CareRoute Medical Triage & Urgency Evaluation', () => {
  it('should flag life-threatening symptoms as EMERGENCY immediately', () => {
    const result1 = assessSymptomUrgency(['Severe chest pain radiating to left arm']);
    expect(result1.level).toBe('emergency');
    expect(result1.recommendedAction).toContain('emergency');

    const result2 = assessSymptomUrgency(['Shortness of breath', 'Dizziness']);
    expect(result2.level).toBe('emergency');
  });

  it('should flag serious acute symptoms as URGENT', () => {
    const result = assessSymptomUrgency(['High fever over 103F for 2 days', 'Persistent vomiting']);
    expect(result.level).toBe('urgent');
    expect(result.recommendedAction).toContain('urgent care');
  });

  it('should categorize non-critical ongoing symptoms as ROUTINE', () => {
    const result = assessSymptomUrgency(['Mild lower back ache', 'Stiff neck in the morning']);
    expect(result.level).toBe('routine');
    expect(result.recommendedAction).toContain('primary care');
  });

  it('should default to self-care when no symptoms are provided', () => {
    const result = assessSymptomUrgency([]);
    expect(result.level).toBe('self_care');
  });
});
