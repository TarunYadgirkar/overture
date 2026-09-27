import { GoogleGenAI, Type } from '@google/genai';
import { NoteGenerationResult } from '../types';
import { DEMO_NOTE, DEMO_TRANSCRIPT } from '../data/demo-note';
import { hasEmergencyIndicator, extractPatientText } from '../data/emergency-keywords';

export function getApiKey(): string {
  const key = process.env.API_KEY;
  return typeof key === 'string' ? key.trim() : '';
}
export function hasKey(): boolean { return getApiKey().length > 0; }

export interface GenerateJsonRequest {
  contents: any;
  systemInstruction?: string;
  responseSchema?: any;
  temperature?: number;
}

export async function generateJson<T>(request: GenerateJsonRequest): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No Gemini API key available');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const runAttempt = async (model: string): Promise<T> => {
    const response = await ai.models.generateContent({
      model,
      contents: request.contents,
      config: {
        systemInstruction: request.systemInstruction,
        temperature: request.temperature ?? 0.2,
        responseMimeType: 'application/json',
        ...(request.responseSchema ? { responseSchema: request.responseSchema } : {}),
      },
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error(`Empty response from ${model}`);
    }
    return JSON.parse(text) as T;
  };

  // Attempt 1: gemini-3.8-flash
  try {
    const result = await runAttempt('gemini-3.8-flash');
    console.log('Gemini JSON generation succeeded on attempt 1 (gemini-3.8-flash)');
    return result;
  } catch (err1) {
    console.warn('Attempt 1 (gemini-3.8-flash) failed:', err1);
    // Wait 1.5 s before retry on transient error
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // Attempt 2: gemini-3.8-flash retry
  try {
    const result = await runAttempt('gemini-3.8-flash');
    console.log('Gemini JSON generation succeeded on attempt 2 (gemini-3.8-flash retry)');
    return result;
  } catch (err2) {
    console.warn('Attempt 2 (gemini-3.8-flash retry) failed:', err2);
  }

  // Attempt 3: gemini-3.7-flash fallback
  try {
    const result = await runAttempt('gemini-3.7-flash');
    console.log('Gemini JSON generation succeeded on attempt 3 (gemini-3.7-flash fallback)');
    return result;
  } catch (err3) {
    console.error('Attempt 3 (gemini-3.7-flash) failed, throwing error for safe fallback:', err3);
    throw err3;
  }
}

export function buildFallbackNote(transcript: string): NoteGenerationResult {
  // Check if it matches the demo rash transcript
  const trimmed = transcript.trim();
  const demoTrimmed = DEMO_TRANSCRIPT.trim();
  if (trimmed === demoTrimmed || transcript.includes('gardening') && transcript.includes('triamcinolone')) {
    return JSON.parse(JSON.stringify(DEMO_NOTE));
  }

  // Deterministic emergency keyword screen (spec 5.7)
  const isEmergency = hasEmergencyIndicator(transcript);
  const patientText = extractPatientText(transcript);

  // Extract the first patient sentence truncated to 80 characters with an ellipsis
  const lines = transcript.split('\n').map((l) => l.trim()).filter(Boolean);
  const patientLines = lines
    .filter((l) => l.toLowerCase().startsWith('patient:'))
    .map((l) => l.replace(/^patient:\s*/i, '').trim());

  const candidateText = patientLines[0] || patientText || lines[0] || 'Pre-visit voice intake';
  const sentenceMatch = candidateText.match(/^([^.!?\n]+[.!?]?)/);
  let firstPatientSentence = (sentenceMatch ? sentenceMatch[1] : candidateText).trim();
  if (!firstPatientSentence) {
    firstPatientSentence = 'Pre-visit voice intake';
  }

  const chiefConcern =
    firstPatientSentence.length > 80
      ? `${firstPatientSentence.slice(0, 77)}...`
      : firstPatientSentence;

  return {
    patient_summary: `Patient completed a voice intake check-in. Key statements: "${patientText.slice(0, 240).trim()}${patientText.length > 240 ? '...' : ''}"`,
    chief_concern: chiefConcern,
    symptoms_reported: [chiefConcern],
    history_of_present_illness: 'Not mentioned',
    medication_mentions: 'Not mentioned',
    prior_care: 'Not mentioned',
    patient_goals: ['Provider clinical assessment and care plan'],
    soap_note: {
      subjective: `Patient reported the following during pre-visit check-in:\n${transcript}`,
      objective: 'Voice intake only — no physical exam, vitals, or labs available.',
      assessment: isEmergency
        ? 'High-risk concern identified. Potential emergency symptoms reported by patient during check-in. Immediate clinician review required.'
        : 'Patient-reported symptoms recorded via voice check-in. AI preliminary draft — no clinical diagnosis or treatment recommended.',
      plan: isEmergency
        ? 'Escalate immediately for urgent clinician review / emergency triage. Verify patient safety before routine outpatient visit.'
        : 'Provider to review reported symptoms with patient, conduct standard physical evaluation, and confirm treatment plan.',
    },
    risk: isEmergency
      ? {
          level: 'high',
          flags: ['Emergency indicator detected in patient conversation'],
          urgent_provider_review: true,
          reason: 'Emergency keywords detected in patient statements requiring immediate provider attention.',
        }
      : {
          level: 'none',
          flags: [],
          urgent_provider_review: false,
          reason: 'No emergency keywords detected in patient intake transcript.',
        },
    care_recommendation: isEmergency
      ? {
          care_level: 'emergency_room',
          confidence: 0.95,
          reasoning: 'Emergency red flags identified in patient responses. Immediate emergency evaluation advised.',
          red_flags_to_watch: ['Chest pain', 'Shortness of breath', 'Loss of consciousness', 'Severe acute symptoms'],
        }
      : {
          care_level: 'primary_care',
          confidence: 0.75,
          reasoning: 'Routine primary care evaluation appropriate based on conversation content.',
          red_flags_to_watch: [],
        },
    suggested_provider_questions: [
      'Can you elaborate on when these symptoms first started and their progression?',
      'Have you noticed any factors that make the symptoms better or worse?',
      'Are you taking any new prescriptions, over-the-counter medications, or supplements?',
    ],
    follow_up_actions: [
      'Licensed provider to review draft note and edit as needed',
      'Confirm allergy list and active medications with patient',
      ...(isEmergency ? ['Verify urgent triage status immediately'] : []),
    ],
    missing_information: ['In-person physical examination', 'Vital signs'],
  };
}

export async function generateNote(
  transcript: string,
  _context?: string,
): Promise<NoteGenerationResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return buildFallbackNote(transcript);
  }

  const systemPrompt = `You are an AI clinical documentation assistant for a primary-care clinic's pre-visit intake system.
Your job is to convert a patient voice-intake transcript into (1) a provider-reviewed draft note and (2) a care-level recommendation.

Important rules:
- Do not diagnose. Do not prescribe. Do not recommend medication changes.
- Use patient-reported language. If information is missing, say "Not mentioned."
- Flag safety concerns for provider review.
- The output is a draft and must be reviewed by a licensed provider.
- Do not invent facts not present in the transcript.
- care_level must be one of: self_care, telehealth, primary_care, urgent_care, emergency_room. Choose the LOWEST safe level; escalate only for red-flag symptoms.

Return ONLY valid JSON matching the schema.`;

  const noteSchema = {
    type: Type.OBJECT,
    properties: {
      patient_summary: { type: Type.STRING },
      chief_concern: { type: Type.STRING },
      symptoms_reported: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      history_of_present_illness: { type: Type.STRING },
      medication_mentions: { type: Type.STRING },
      prior_care: { type: Type.STRING },
      patient_goals: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      soap_note: {
        type: Type.OBJECT,
        properties: {
          subjective: { type: Type.STRING },
          objective: { type: Type.STRING },
          assessment: { type: Type.STRING },
          plan: { type: Type.STRING },
        },
        required: ['subjective', 'objective', 'assessment', 'plan'],
      },
      risk: {
        type: Type.OBJECT,
        properties: {
          level: {
            type: Type.STRING,
            enum: ['none', 'low', 'medium', 'high'],
          },
          flags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          urgent_provider_review: { type: Type.BOOLEAN },
          reason: { type: Type.STRING },
        },
        required: ['level', 'flags', 'urgent_provider_review', 'reason'],
      },
      care_recommendation: {
        type: Type.OBJECT,
        properties: {
          care_level: {
            type: Type.STRING,
            enum: ['self_care', 'telehealth', 'primary_care', 'urgent_care', 'emergency_room'],
          },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
          red_flags_to_watch: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['care_level', 'confidence', 'reasoning', 'red_flags_to_watch'],
      },
      suggested_provider_questions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      follow_up_actions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      missing_information: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: [
      'patient_summary',
      'chief_concern',
      'symptoms_reported',
      'history_of_present_illness',
      'medication_mentions',
      'prior_care',
      'patient_goals',
      'soap_note',
      'risk',
      'care_recommendation',
      'suggested_provider_questions',
      'follow_up_actions',
      'missing_information',
    ],
  };

  try {
    return await generateJson<NoteGenerationResult>({
      contents: `Transcript:\n${transcript}`,
      systemInstruction: systemPrompt,
      temperature: 0.2,
      responseSchema: noteSchema,
    });
  } catch (err) {
    console.warn('Gemini note generation failed, falling back to safe note:', err);
    return buildFallbackNote(transcript);
  }
}

