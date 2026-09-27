import { GoogleGenAI, Type } from '@google/genai';
import { CareLevel, CoverageSummary, ResearchResult, CareOption } from '../types';
import { getApiKey, hasKey } from './gemini';

export interface ResearchParams {
  chiefConcern: string;
  symptoms?: string[];
  patientGoals?: string[];
  riskFlags?: string[];
  recommendedCareLevel?: CareLevel;
  coverage?: CoverageSummary | null;
}

const CARE_LEVEL_ORDER: Array<CareOption['level']> = [
  'self_monitor',
  'telehealth',
  'primary_care',
  'urgent_care',
  'emergency_room',
];

export function buildDeterministicFallbackResearch(params: ResearchParams): ResearchResult {
  const rec = params.recommendedCareLevel || 'primary_care';
  const recIndex = CARE_LEVEL_ORDER.indexOf(rec === 'self_care' ? 'self_monitor' : rec as any);
  const effectiveIndex = recIndex === -1 ? 2 : recIndex;

  const cov = params.coverage;
  const copay = cov?.copay;
  const deductible = cov?.deductible_remaining;
  const isSelfPay = cov?.payer === 'Self-pay' || !cov?.payer;
  const deductSuffix = deductible && deductible > 0 ? ` (until ~$${deductible} deductible is met)` : '';

  const costLookup: Record<CareOption['level'], string> = {
    self_monitor: '$0 — home monitoring',
    telehealth:
      copay !== null && copay !== undefined && !isSelfPay
        ? `~$${copay} copay`
        : '$40–$90 typical',
    primary_care:
      copay !== null && copay !== undefined && !isSelfPay
        ? `~$${copay} copay${deductSuffix}`
        : `$100–$200 typical${deductSuffix}`,
    urgent_care:
      copay !== null && copay !== undefined && !isSelfPay
        ? `~$${copay} copay${deductSuffix}`
        : `$120–$250 typical${deductSuffix}`,
    emergency_room:
      copay !== null && copay !== undefined && !isSelfPay
        ? `~$${copay} copay${deductSuffix}`
        : `$800–$2,500+ typical${deductSuffix}`,
  };

  const whyLookup: Record<CareOption['level'], string> = {
    self_monitor: 'Appropriate for mild, transient symptoms that show steady improvement.',
    telehealth: 'Convenient for clinical guidance, routine triage, or non-acute follow-ups.',
    primary_care: 'Comprehensive exam and clinical assessment with ongoing care management.',
    urgent_care: 'Same-day evaluation when timely physical exam or basic diagnostics are needed.',
    emergency_room: 'Immediate medical evaluation required for red-flag or acute severe symptoms.',
  };

  const care_options: CareOption[] = CARE_LEVEL_ORDER.map((lvl, idx) => {
    let fit: 'low' | 'medium' | 'high' = 'low';
    if (idx === effectiveIndex) {
      fit = 'high';
    } else if (Math.abs(idx - effectiveIndex) === 1) {
      fit = 'medium';
    }
    return {
      level: lvl,
      fit,
      why: whyLookup[lvl],
      est_cost: costLookup[lvl],
    };
  });

  const concern = params.chiefConcern || 'reported concerns';
  return {
    patient_explainer: `The reported symptoms centered around ${concern}. A primary care provider will evaluate the onset, severity, and potential underlying triggers during your visit to confirm what is going on and guide next steps.`,
    provider_considerations: [
      `Consider evaluation of ${concern} and associated modifiers.`,
      'May warrant review of medication history and recent symptom progression.',
      'Consider ruling out acute inflammatory or localized triggers.',
    ],
    red_flags_to_watch: [
      'Symptoms suddenly worsening or spreading',
      'New chest pain, trouble breathing, or confusion',
      'High fever that does not respond to usual measures',
      'Symptoms interfering with eating, drinking, or sleeping',
    ],
    care_options,
    questions_to_ask: [
      'What do you think is most likely causing these symptoms?',
      'Are there tests, labs, or imaging that would help narrow this down?',
      'What warning signs mean I should come back sooner?',
      'How long should I expect this to last, and when should I follow up?',
      'Is there anything I should avoid or change while this resolves?',
    ],
  };
}

export async function runDeepResearch(params: ResearchParams): Promise<ResearchResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return buildDeterministicFallbackResearch(params);
  }

  const systemInstruction = `You are a health research assistant that prepares a pre-visit research draft. You are NOT a doctor. You NEVER diagnose or prescribe. Everything you produce is a draft that a licensed provider reviews before the visit.

HARD RULES:
- No diagnosis. No prescribing. No treatment instructions.
- The patient explainer must be plain language, educational, and must state that their provider will confirm what is actually going on.
- Provider considerations are phrased as considerations to weigh ("Consider...", "May warrant..."), never as diagnoses.
- If emergency red flags are present in the input, emergency_room must be rated "high" fit.
- Cost estimates: if coverage copay/deductible values are provided, use them; otherwise give typical US price ranges.

Return a JSON object with exactly this structure: { patient_explainer: string (3-4 sentences), provider_considerations: string[3-5], red_flags_to_watch: string[3-5], care_options: [{level: self_monitor|telehealth|primary_care|urgent_care|emergency_room, fit: low|medium|high, why: string, est_cost: string}] (all 5 levels, each once, in that order), questions_to_ask: string[4-5] }`;

  let prompt = `Symptom summary:\n${params.chiefConcern || 'Not specified'}`;
  if (params.symptoms && params.symptoms.length > 0) {
    prompt += `\n\nReported symptoms:\n${params.symptoms.map((s) => `- ${s}`).join('\n')}`;
  }
  if (params.riskFlags && params.riskFlags.length > 0) {
    prompt += `\n\nRisk flags:\n${params.riskFlags.map((f) => `- ${f}`).join('\n')}`;
  }
  if (params.recommendedCareLevel) {
    prompt += `\n\nAI-recommended care level:\n${params.recommendedCareLevel}`;
  }
  if (params.coverage) {
    prompt += `\n\nInsurance coverage:\nPayer: ${params.coverage.payer}\nPlan status: ${params.coverage.plan_status}\nCopay: ${params.coverage.copay ?? 'None'}\nDeductible remaining: ${params.coverage.deductible_remaining ?? 'None'}\nVisit estimate: $${params.coverage.estimated_visit_cost.min}–$${params.coverage.estimated_visit_cost.max}`;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patient_explainer: { type: Type.STRING },
            provider_considerations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            red_flags_to_watch: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            care_options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  level: {
                    type: Type.STRING,
                    enum: ['self_monitor', 'telehealth', 'primary_care', 'urgent_care', 'emergency_room'],
                  },
                  fit: {
                    type: Type.STRING,
                    enum: ['low', 'medium', 'high'],
                  },
                  why: { type: Type.STRING },
                  est_cost: { type: Type.STRING },
                },
                required: ['level', 'fit', 'why', 'est_cost'],
              },
            },
            questions_to_ask: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'patient_explainer',
            'provider_considerations',
            'red_flags_to_watch',
            'care_options',
            'questions_to_ask',
          ],
        },
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return buildDeterministicFallbackResearch(params);
    }

    const parsed = JSON.parse(text) as ResearchResult;

    // Validate structure
    if (
      !parsed.patient_explainer ||
      !Array.isArray(parsed.provider_considerations) ||
      parsed.provider_considerations.length === 0 ||
      !Array.isArray(parsed.red_flags_to_watch) ||
      parsed.red_flags_to_watch.length === 0 ||
      !Array.isArray(parsed.care_options) ||
      parsed.care_options.length !== 5 ||
      !Array.isArray(parsed.questions_to_ask) ||
      parsed.questions_to_ask.length === 0
    ) {
      return buildDeterministicFallbackResearch(params);
    }

    return parsed;
  } catch (err) {
    console.warn('Deep research call failed, using fallback:', err);
    return buildDeterministicFallbackResearch(params);
  }
}
