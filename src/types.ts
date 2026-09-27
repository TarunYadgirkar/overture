// Domain types. Extends the shapes from klarity-voicenote with the
// care-navigation layer from carepath (care level + cost + coverage).

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';
export type NoteStatus = 'ai_draft' | 'reviewed' | 'urgent_review';
export type CareLevel = 'self_care' | 'telehealth' | 'primary_care' | 'urgent_care' | 'emergency_room';

export interface PatientRow {
  id: string;
  name: string;
  age_range?: string;
  appointment_type?: string;
  provider_name?: string;
  created_at?: string;
  call_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  note_id?: string;
  note_status?: NoteStatus;
  risk_level?: RiskLevel;
}

export interface CareRecommendation {
  care_level: CareLevel;
  confidence: number; // 0-1
  reasoning: string;
  red_flags_to_watch: string[];
}

export interface CoverageSummary {
  source: 'stedi' | 'synthetic';
  payer: string;
  plan_status: string;
  copay?: number | null;
  coinsurance_percent?: number;
  deductible_remaining?: number;
  estimated_visit_cost: { min: number; max: number };
  spoken_summary: string;
}

export interface NoteGenerationResult {
  patient_summary: string;
  chief_concern: string;
  symptoms_reported: string[];
  history_of_present_illness: string;
  medication_mentions: string;
  prior_care: string;
  patient_goals: string[];
  soap_note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  risk: {
    level: RiskLevel;
    flags: string[];
    urgent_provider_review: boolean;
    reason: string;
  };
  care_recommendation: CareRecommendation;
  suggested_provider_questions: string[];
  follow_up_actions: string[];
  missing_information: string[];
}

// Flat note shape consumed by the provider dashboard (klarity contract).
export interface Note {
  id: string;
  patient_id: string;
  call_id: string; // Encounter id
  ai_summary?: string;
  soap_subjective?: string;
  soap_objective?: string;
  soap_assessment?: string;
  soap_plan?: string;
  risk_level: RiskLevel;
  risk_flags: string[];
  suggested_questions: string[];
  follow_up_actions: string[];
  chief_concern?: string;
  symptoms_reported: string[];
  patient_goals: string[];
  status: NoteStatus;
  provider_edited_note?: string;
  reviewed_at?: string;
  created_at?: string;
  care_recommendation?: CareRecommendation;
  coverage?: CoverageSummary;
}

export interface TranscriptUtterance {
  role: 'agent' | 'user';
  content: string;
}

// A patient-logged symptom, stored as a FHIR Observation
export interface SymptomEntry {
  id: string;
  patient_id?: string;
  text: string;
  severity: number; // 1-10
  onset: string; // ISO — when the patient felt it
  tags: string[];
  recorded_at?: string;
}

// MedCard storage
export interface MedCardData {
  medications: string[];
  allergies: string[];
  conditions: string[];
  lastUpdated: string;
}

// Epic MyChart simulation import
export interface EpicSystem {
  id: string;
  name: string;
  logo: string;
  fhirBase: string;
}

export type LabFlag = 'NORMAL' | 'HIGH_NORMAL' | 'ELEVATED' | 'BORDERLINE' | 'HIGH' | 'LOW';

export interface EpicImportResult {
  patient: {
    name: string;
    dob: string;
    mrn: string;
    facility: string;
    primaryProvider: string;
  };
  medications: Array<{
    name: string;
    frequency: string;
    prescriber: string;
    started: string;
  }>;
  allergies: Array<{
    substance: string;
    reaction: string;
    severity: string;
    recorded: string;
  }>;
  conditions: Array<{
    name: string;
    icd10: string;
    status: string;
    diagnosed: string;
  }>;
  recentEncounters: Array<{
    date: string;
    type: string;
    provider: string;
    facility: string;
  }>;
  labResults: Array<{
    name: string;
    value: string;
    date: string;
    reference: string;
    flag: LabFlag;
  }>;
  immunizations: Array<{
    name: string;
    date: string;
  }>;
  upcomingVisits: Array<{
    date: string;
    type: string;
    provider: string;
  }>;
}

export interface EpicImportState {
  connected: boolean;
  systemId: string;
  systemName: string;
  importedAt: string;
  record: EpicImportResult;
}

// Patient session in localStorage
export interface PatientSession {
  patientId: string;
  patientName?: string;
}

// History docs indexed for retrieval
export interface HistoryDoc {
  id: string;
  text: string;
  metadata?: Record<string, string>;
}

// Insurance plans catalog
export type CarrierKey = 'UHC' | 'CIGNA' | 'AETNA' | 'BCBS' | 'KAISER' | 'MEDICARE' | 'MEDICAID';
export type StediPayerKey = 'UHC' | 'CIGNA' | 'AETNA' | 'CMS';

export interface PlanCopays {
  telehealth: number | null;
  primary_care: number | null;
  urgent_care: number | null;
  emergency_room: number | null;
}

export interface InsurancePlanOption {
  id: string;
  name: string;
  copays: PlanCopays;
  deductibleRemaining: number;
  coinsurancePct: number;
}

export interface Carrier {
  key: CarrierKey;
  name: string;
  stediPayerKey?: StediPayerKey;
  plans: InsurancePlanOption[];
}

// Deep research types
export interface CareOption {
  level: 'self_monitor' | 'telehealth' | 'primary_care' | 'urgent_care' | 'emergency_room';
  fit: 'low' | 'medium' | 'high';
  why: string;
  est_cost: string;
}

export interface ResearchResult {
  patient_explainer: string;
  provider_considerations: string[];
  red_flags_to_watch: string[];
  care_options: CareOption[];
  questions_to_ask: string[];
}

// Communities
export interface Community {
  name: string;
  title: string;
  members: number | null;
  description: string;
  why: string;
  url: string;
}

// Clinical trials
export interface TrialMatch {
  title: string;
  condition_match: string;
  why_eligible: string;
  search_url: string;
}

// Scan label
export interface ScanLabelResult {
  medicationName: string;
  dosage: string;
  frequency: string;
  confidence: 'low' | 'medium' | 'high';
}
