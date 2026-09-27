import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  CareLevel,
  Note,
  NoteStatus,
  PatientRow,
  RiskLevel,
  SymptomEntry,
} from '../types';
import { DEMO_PATIENTS } from '../data/demo-patients';
import { resolveCarrierPlan } from '../data/insurance-plans';
import { syntheticPricing } from '../data/synthetic-pricing';

interface PatientRecord {
  id: string;
  name: string;
  age_range?: string;
  appointment_type?: string;
  created_at: string;
  updated_at: string;
}

interface EncounterRecord {
  id: string;
  patient_id: string;
  status: 'in-progress' | 'finished';
  type: string;
  started_at: string;
  finished_at?: string;
}

interface TranscriptRecord {
  id: string;
  encounter_id: string;
  patient_id: string;
  text: string;
  created_at: string;
}

interface AllergyRecord {
  id: string;
  patient_id: string;
  substance: string;
  reaction: string;
  severity?: string;
  recorded_at: string;
}

interface MedicationRecord {
  id: string;
  patient_id: string;
  name: string;
  dosage: string;
  frequency?: string;
  prescriber?: string;
  started_at: string;
}

interface OvertureDB extends DBSchema {
  patients: {
    key: string;
    value: PatientRecord;
    indexes: { 'by-updated': string };
  };
  encounters: {
    key: string;
    value: EncounterRecord;
    indexes: { 'by-patient': string };
  };
  transcripts: {
    key: string;
    value: TranscriptRecord;
    indexes: { 'by-encounter': string; 'by-patient': string };
  };
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-patient': string; 'by-call': string };
  };
  observations: {
    key: string;
    value: SymptomEntry;
    indexes: { 'by-patient': string };
  };
  allergies: {
    key: string;
    value: AllergyRecord;
    indexes: { 'by-patient': string };
  };
  medications: {
    key: string;
    value: MedicationRecord;
    indexes: { 'by-patient': string };
  };
}

const DB_NAME = 'overture_records_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OvertureDB>> | null = null;

function getDb(): Promise<IDBPDatabase<OvertureDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OvertureDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('patients')) {
          const patientStore = db.createObjectStore('patients', { keyPath: 'id' });
          patientStore.createIndex('by-updated', 'updated_at');
        }
        if (!db.objectStoreNames.contains('encounters')) {
          const encStore = db.createObjectStore('encounters', { keyPath: 'id' });
          encStore.createIndex('by-patient', 'patient_id');
        }
        if (!db.objectStoreNames.contains('transcripts')) {
          const txStore = db.createObjectStore('transcripts', { keyPath: 'id' });
          txStore.createIndex('by-encounter', 'encounter_id');
          txStore.createIndex('by-patient', 'patient_id');
        }
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('by-patient', 'patient_id');
          noteStore.createIndex('by-call', 'call_id');
        }
        if (!db.objectStoreNames.contains('observations')) {
          const obsStore = db.createObjectStore('observations', { keyPath: 'id' });
          obsStore.createIndex('by-patient', 'patient_id');
        }
        if (!db.objectStoreNames.contains('allergies')) {
          const allgStore = db.createObjectStore('allergies', { keyPath: 'id' });
          allgStore.createIndex('by-patient', 'patient_id');
        }
        if (!db.objectStoreNames.contains('medications')) {
          const medStore = db.createObjectStore('medications', { keyPath: 'id' });
          medStore.createIndex('by-patient', 'patient_id');
        }
      },
    }).then(async (db) => {
      await seedIfEmpty(db);
      return db;
    });
  }
  return dbPromise;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

export async function createPatient(
  name: string,
  ageRange?: string,
  appointmentType?: string,
): Promise<string> {
  const db = await getDb();
  const id = uid('pat');
  const now = new Date().toISOString();
  await db.put('patients', {
    id,
    name: name.trim(),
    age_range: ageRange,
    appointment_type: appointmentType,
    created_at: now,
    updated_at: now,
  });
  return id;
}

export async function openEncounter(
  patientId: string,
  appointmentType?: string,
): Promise<string> {
  const db = await getDb();
  const id = uid('enc');
  const now = new Date().toISOString();
  await db.put('encounters', {
    id,
    patient_id: patientId,
    status: 'in-progress',
    type: appointmentType || 'Pre-visit voice intake',
    started_at: now,
  });

  const patient = await db.get('patients', patientId);
  if (patient) {
    patient.updated_at = now;
    await db.put('patients', patient);
  }
  return id;
}

export async function finishEncounter(encounterId: string): Promise<void> {
  const db = await getDb();
  const enc = await db.get('encounters', encounterId);
  if (enc) {
    enc.status = 'finished';
    enc.finished_at = new Date().toISOString();
    await db.put('encounters', enc);
  }
}

export async function saveTranscript(
  encounterId: string,
  patientId: string,
  text: string,
): Promise<string> {
  const db = await getDb();
  const id = uid('tx');
  const now = new Date().toISOString();
  await db.put('transcripts', {
    id,
    encounter_id: encounterId,
    patient_id: patientId,
    text,
    created_at: now,
  });
  return id;
}

export async function getTranscript(encounterId: string): Promise<string | null> {
  const db = await getDb();
  const tx = await db.getFromIndex('transcripts', 'by-encounter', encounterId);
  return tx ? tx.text : null;
}

export async function saveNote(note: Partial<Note> & { patient_id: string; call_id: string }): Promise<Note> {
  const db = await getDb();
  const id = note.id || uid('note');
  const now = new Date().toISOString();
  const fullNote: Note = {
    id,
    patient_id: note.patient_id,
    call_id: note.call_id,
    ai_summary: note.ai_summary || '',
    soap_subjective: note.soap_subjective || '',
    soap_objective: note.soap_objective || '',
    soap_assessment: note.soap_assessment || '',
    soap_plan: note.soap_plan || '',
    risk_level: note.risk_level || 'none',
    risk_flags: note.risk_flags || [],
    suggested_questions: note.suggested_questions || [],
    follow_up_actions: note.follow_up_actions || [],
    chief_concern: note.chief_concern || '',
    symptoms_reported: note.symptoms_reported || [],
    patient_goals: note.patient_goals || [],
    status: note.status || 'ai_draft',
    provider_edited_note: note.provider_edited_note,
    reviewed_at: note.reviewed_at,
    created_at: note.created_at || now,
    care_recommendation: note.care_recommendation,
    coverage: note.coverage,
  };

  await db.put('notes', fullNote);

  // Update patient timestamp
  const patient = await db.get('patients', note.patient_id);
  if (patient) {
    patient.updated_at = now;
    await db.put('patients', patient);
  }
  return fullNote;
}

export async function updateNote(
  noteId: string,
  updates: { status?: NoteStatus; riskLevel?: RiskLevel; providerEditedNote?: string; reviewed_at?: string },
): Promise<Note> {
  const db = await getDb();
  const note = await db.get('notes', noteId);
  if (!note) {
    throw new Error(`Note not found: ${noteId}`);
  }
  if (updates.status !== undefined) {
    note.status = updates.status;
    if (updates.status === 'reviewed') {
      note.reviewed_at = updates.reviewed_at || new Date().toISOString();
    }
  }
  if (updates.riskLevel !== undefined) {
    note.risk_level = updates.riskLevel;
  }
  if (updates.providerEditedNote !== undefined) {
    note.provider_edited_note = updates.providerEditedNote;
  }
  await db.put('notes', note);
  return note;
}

export async function getNote(noteId: string): Promise<Note | null> {
  const db = await getDb();
  const note = await db.get('notes', noteId);
  return note || null;
}

export async function getNoteByPatient(patientId: string): Promise<Note | null> {
  const db = await getDb();
  const notes = await db.getAllFromIndex('notes', 'by-patient', patientId);
  if (!notes || notes.length === 0) return null;
  // Sort descending by created_at
  notes.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return notes[0];
}

export async function listPatientRows(): Promise<PatientRow[]> {
  const db = await getDb();
  const patients = await db.getAll('patients');
  // Sort newest first
  patients.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const rows: PatientRow[] = [];

  for (const pat of patients) {
    const encounters = await db.getAllFromIndex('encounters', 'by-patient', pat.id);
    encounters.sort((a, b) => b.started_at.localeCompare(a.started_at));
    const latestEnc = encounters[0];

    const notes = await db.getAllFromIndex('notes', 'by-patient', pat.id);
    notes.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const latestNote = notes[0];

    let call_status: 'pending' | 'in_progress' | 'completed' | 'failed' = 'pending';
    if (latestEnc) {
      if (latestEnc.status === 'finished') {
        call_status = 'completed';
      } else if (latestEnc.status === 'in-progress') {
        call_status = 'in_progress';
      }
    }

    rows.push({
      id: pat.id,
      name: pat.name,
      age_range: pat.age_range,
      appointment_type: pat.appointment_type,
      provider_name: 'Dr. Chen',
      created_at: pat.updated_at || pat.created_at,
      call_status,
      note_id: latestNote ? latestNote.id : undefined,
      note_status: latestNote ? latestNote.status : undefined,
      risk_level: latestNote ? latestNote.risk_level : undefined,
    });
  }

  return rows;
}

export async function getPatient(patientId: string): Promise<PatientRecord | null> {
  const db = await getDb();
  const pat = await db.get('patients', patientId);
  return pat || null;
}

export async function deletePatient(patientId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ['patients', 'encounters', 'transcripts', 'notes', 'observations', 'allergies', 'medications'],
    'readwrite',
  );

  // Observations
  const obs = await tx.objectStore('observations').index('by-patient').getAll(patientId);
  for (const o of obs) {
    await tx.objectStore('observations').delete(o.id);
  }

  // Allergies
  const allg = await tx.objectStore('allergies').index('by-patient').getAll(patientId);
  for (const a of allg) {
    await tx.objectStore('allergies').delete(a.id);
  }

  // Medications
  const meds = await tx.objectStore('medications').index('by-patient').getAll(patientId);
  for (const m of meds) {
    await tx.objectStore('medications').delete(m.id);
  }

  // Transcripts
  const tscripts = await tx.objectStore('transcripts').index('by-patient').getAll(patientId);
  for (const t of tscripts) {
    await tx.objectStore('transcripts').delete(t.id);
  }

  // Notes
  const notes = await tx.objectStore('notes').index('by-patient').getAll(patientId);
  for (const n of notes) {
    await tx.objectStore('notes').delete(n.id);
  }

  // Encounters
  const encs = await tx.objectStore('encounters').index('by-patient').getAll(patientId);
  for (const e of encs) {
    await tx.objectStore('encounters').delete(e.id);
  }

  // Patient
  await tx.objectStore('patients').delete(patientId);
  await tx.done;
}

// Symptoms (Observations) CRUD
export async function addSymptom(
  patientId: string,
  entry: Omit<SymptomEntry, 'id'>,
): Promise<SymptomEntry> {
  const db = await getDb();
  const id = uid('obs');
  const now = new Date().toISOString();
  const newEntry: SymptomEntry = {
    id,
    patient_id: patientId,
    text: entry.text.slice(0, 400),
    severity: Math.min(10, Math.max(1, Math.round(entry.severity))),
    onset: entry.onset || now,
    tags: (entry.tags || []).slice(0, 8),
    recorded_at: entry.recorded_at || now,
  };
  await db.put('observations', newEntry);
  return newEntry;
}

export async function listSymptoms(patientId: string): Promise<SymptomEntry[]> {
  const db = await getDb();
  const symptoms = await db.getAllFromIndex('observations', 'by-patient', patientId);
  symptoms.sort((a, b) => b.onset.localeCompare(a.onset));
  return symptoms;
}

export async function deleteSymptom(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('observations', id);
}

// Allergies and Medications
export async function addAllergy(patientId: string, substance: string, reaction = ''): Promise<void> {
  const db = await getDb();
  await db.put('allergies', {
    id: uid('alg'),
    patient_id: patientId,
    substance,
    reaction,
    recorded_at: new Date().toISOString(),
  });
}

export async function listAllergies(patientId: string): Promise<Array<{ substance: string; reaction: string }>> {
  const db = await getDb();
  const items = await db.getAllFromIndex('allergies', 'by-patient', patientId);
  return items.map((i) => ({ substance: i.substance, reaction: i.reaction }));
}

export async function addMedication(patientId: string, name: string, dosage = ''): Promise<void> {
  const db = await getDb();
  await db.put('medications', {
    id: uid('med'),
    patient_id: patientId,
    name,
    dosage,
    started_at: new Date().toISOString(),
  });
}

export async function listMedications(patientId: string): Promise<Array<{ name: string; dosage: string }>> {
  const db = await getDb();
  const items = await db.getAllFromIndex('medications', 'by-patient', patientId);
  return items.map((i) => ({ name: i.name, dosage: i.dosage }));
}

// Helper to seed initial demo patients if store is empty
async function seedIfEmpty(db: IDBPDatabase<OvertureDB>): Promise<void> {
  const count = await db.count('patients');
  if (count > 0) return;

  const nowMs = Date.now();

  for (let i = 0; i < DEMO_PATIENTS.length; i++) {
    const demo = DEMO_PATIENTS[i];
    const offsetMs = (DEMO_PATIENTS.length - i) * 600000;
    const patTime = new Date(nowMs - offsetMs).toISOString();

    const patientId = `pat_demo_${i + 1}`;
    await db.put('patients', {
      id: patientId,
      name: demo.name,
      age_range: demo.ageRange,
      appointment_type: demo.appointmentType,
      created_at: patTime,
      updated_at: patTime,
    });

    const encounterId = `enc_demo_${i + 1}`;
    await db.put('encounters', {
      id: encounterId,
      patient_id: patientId,
      status: 'finished',
      type: demo.appointmentType,
      started_at: patTime,
      finished_at: new Date(nowMs - offsetMs + 180000).toISOString(),
    });

    await db.put('transcripts', {
      id: `tx_demo_${i + 1}`,
      encounter_id: encounterId,
      patient_id: patientId,
      text: demo.transcript,
      created_at: patTime,
    });

    if (demo.allergies) {
      for (const a of demo.allergies) {
        await db.put('allergies', {
          id: uid('alg'),
          patient_id: patientId,
          substance: a.substance,
          reaction: a.reaction,
          recorded_at: patTime,
        });
      }
    }

    if (demo.medications) {
      for (const m of demo.medications) {
        await db.put('medications', {
          id: uid('med'),
          patient_id: patientId,
          name: m.name,
          dosage: m.dosage,
          started_at: patTime,
        });
      }
    }

    if (demo.symptoms) {
      for (const s of demo.symptoms) {
        const onsetDate = new Date(nowMs - s.daysAgo * 86400000).toISOString();
        await db.put('observations', {
          id: uid('obs'),
          patient_id: patientId,
          text: s.text,
          severity: s.severity,
          onset: onsetDate,
          tags: ['diabetic neuropathy', 'blood sugar'],
          recorded_at: onsetDate,
        });
      }
    }

    // Pre-baked note tailored for each demo patient
    const noteId = `note_demo_${i + 1}`;
    let note: Note;

    if (demo.name === 'Marcus Whitfield') {
      note = {
        id: noteId,
        patient_id: patientId,
        call_id: encounterId,
        ai_summary:
          'Patient reports acute chest tightness and squeezing sensation radiating to left arm with cold sweat, lightheadedness, and shortness of breath. History of hypertension, on lisinopril. Strongly advised to call 911 / go to ER immediately.',
        chief_concern: 'Chest pressure radiating to left arm with shortness of breath',
        symptoms_reported: [
          'Chest pressure (rated 6-8/10)',
          'Radiation to left arm',
          'Shortness of breath on exertion and at rest',
          'Cold sweat and lightheadedness',
        ],
        patient_goals: ['Relief of chest pain', 'Safe emergency triage'],
        soap_subjective:
          '55yo male with known hypertension presents with acute chest tightness that began yesterday afternoon. Describes squeezing sensation in center of chest rated 6/10 spiking to 8/10, radiating to left arm. Experienced cold sweat and dizziness this morning. Endorses dyspnea at rest. Takes lisinopril 20mg daily. Family history positive for father with myocardial infarction at age 60.',
        soap_objective:
          'Voice check-in only — no vitals or exam available. Patient sounded breathless on call.',
        soap_assessment:
          'Acute coronary syndrome cannot be ruled out. High cardiovascular risk profile with classic ischemic symptoms.',
        soap_plan:
          'Immediate emergency department evaluation recommended. Patient advised that spouse is driving to ER. Case flagged for urgent clinician follow-up.',
        risk_level: 'high',
        risk_flags: [
          'Chest pain radiating to left arm',
          'Shortness of breath at rest',
          'Diaphoresis and presyncope',
          'Strong family history of early MI',
        ],
        suggested_questions: [
          'Exact time of peak chest pain onset?',
          'Any relief with rest or change in position?',
          'Prior cardiac catheterization or stress testing?',
        ],
        follow_up_actions: [
          'Immediate provider notification',
          'Confirm arrival at nearest emergency department',
          'Acquire hospital transfer / discharge records when stable',
        ],
        status: 'urgent_review',
        care_recommendation: {
          care_level: 'emergency_room',
          confidence: 0.98,
          reasoning:
            'Acute chest pressure radiating to left arm with diaphoresis and dyspnea requires immediate emergency department evaluation.',
          red_flags_to_watch: [
            'Worsening chest pain',
            'Syncope or loss of consciousness',
            'Severe shortness of breath',
            'Cyanosis',
          ],
        },
        coverage: {
          source: 'synthetic',
          payer: 'UnitedHealthcare Choice Plus',
          plan_status: 'Active Coverage',
          copay: 350,
          deductible_remaining: 750,
          estimated_visit_cost: { min: 350, max: 1200 },
          spoken_summary:
            'Your UnitedHealthcare Choice Plus plan shows active coverage. Expect roughly a $350 copay for an emergency room visit.',
        },
        created_at: patTime,
      };
    } else if (demo.name === 'Priya Anand') {
      note = {
        id: noteId,
        patient_id: patientId,
        call_id: encounterId,
        ai_summary:
          'Patient checking in for routine annual physical. Notes mild seasonal allergies managed with OTC Zyrtec. Overall stable, sleeping well, exercises regularly.',
        chief_concern: 'Annual physical checkup & seasonal allergy check',
        symptoms_reported: [
          'Seasonal allergy symptoms (sneezing, itchy eyes for 3 weeks)',
          'No systemic complaints',
        ],
        patient_goals: ['Preventive health review', 'Check vaccination status'],
        soap_subjective:
          '28yo female presents for yearly checkup. Seasonal allergic rhinitis for 3 weeks, using OTC Zyrtec PRN with good relief. Denies chest pain, shortness of breath, palpitations, or digestive complaints. Takes multivitamin. NKDA.',
        soap_objective:
          'Voice check-in only. Patient coherent, alert, normal speech pattern.',
        soap_assessment:
          'Routine wellness exam. Mild seasonal allergic rhinitis, well controlled.',
        soap_plan:
          'Conduct comprehensive physical exam. Verify and administer Tdap booster if due. Routine preventive lab panel (CBC, CMP, lipids).',
        risk_level: 'low',
        risk_flags: ['Family history of diabetes and hypertension'],
        suggested_questions: [
          'When was your last Tdap booster administered?',
          'Any occupational or environmental allergy triggers?',
        ],
        follow_up_actions: [
          'Administer Tdap booster if overdue',
          'Review preventive lab results with patient',
        ],
        status: 'ai_draft',
        care_recommendation: {
          care_level: 'primary_care',
          confidence: 0.92,
          reasoning:
            'Routine annual wellness visit without acute symptoms is appropriate for primary care.',
          red_flags_to_watch: [],
        },
        coverage: {
          source: 'synthetic',
          payer: 'UnitedHealthcare Choice Plus',
          plan_status: 'Active Coverage',
          copay: 30,
          deductible_remaining: 750,
          estimated_visit_cost: { min: 30, max: 120 },
          spoken_summary:
            'Your UnitedHealthcare Choice Plus plan shows active coverage. Expect roughly a $30 copay for a primary care visit.',
        },
        created_at: patTime,
      };
    } else {
      // Robert Alan Chen
      note = {
        id: noteId,
        patient_id: patientId,
        call_id: encounterId,
        ai_summary:
          'Patient with type 2 diabetes and hypertension presenting for follow-up and medication refill. Ran out of metformin 4 days ago. Reports increased thirst, fatigue, and bilateral foot tingling at night. Home BP ~135/85.',
        chief_concern: 'Type 2 diabetes follow-up, metformin refill, and bilateral foot tingling',
        symptoms_reported: [
          'Bilateral foot tingling worse at night (2 months)',
          'Increased thirst and fatigue since metformin ran out',
          'Fasting sugars 130-145, postprandial spikes > 200',
        ],
        patient_goals: ['Refill Metformin prescription', 'Address foot tingling and fatigue'],
        soap_subjective:
          '50yo male with T2D and HTN presents for follow-up. Refill needed for metformin 1000mg BID (ran out 4 days ago). Fasting glucose 130-145 with postprandial spikes over 200. Reports polydipsia, fatigue, and bilateral peripheral paresthesias in feet at night for 2 months. No skin breakdown or foot wounds.',
        soap_objective:
          'Voice check-in only. Patient coherent. Last clinic A1C was 7.8% 3 months ago. Home BP ~135/85.',
        soap_assessment:
          'Type 2 diabetes mellitus with recent medication non-adherence/lapse and symptoms concerning for early diabetic peripheral neuropathy.',
        soap_plan:
          'Refill Metformin 1000mg BID. Conduct comprehensive diabetic foot exam with monofilament testing today. Order repeat HbA1c, comprehensive metabolic panel, and urine microalbumin. Discuss glycemic and dietary targets.',
        risk_level: 'medium',
        risk_flags: [
          'Metformin medication lapse (4 days)',
          'Persistent peripheral neuropathy symptoms in feet',
          'Elevated glucose readings > 200 mg/dL',
        ],
        suggested_questions: [
          'Have you noticed any balance issues or loss of sensation in your feet during the day?',
          'What were your typical carbohydrate portions during recent work travel?',
        ],
        follow_up_actions: [
          'Immediate Metformin 1000mg BID refill',
          'Perform 10g monofilament sensory exam of feet',
          'Draw repeat HbA1c and lipid panel',
        ],
        status: 'reviewed',
        reviewed_at: new Date(nowMs - 3600000).toISOString(),
        provider_edited_note:
          'AI Draft — Provider Review Required\n\nReviewed and approved. Metformin 1000mg BID refilled for 90 days. Comprehensive foot exam planned today with repeat A1c.',
        care_recommendation: {
          care_level: 'primary_care',
          confidence: 0.88,
          reasoning:
            'Follow-up visit for diabetes refill and neuropathy evaluation is best handled in primary care clinic.',
          red_flags_to_watch: [
            'Non-healing foot ulcers or blisters',
            'Symptoms of severe hyperglycemia (nausea, confusion)',
            'Vision changes',
          ],
        },
        coverage: {
          source: 'synthetic',
          payer: 'UnitedHealthcare Choice Plus',
          plan_status: 'Active Coverage',
          copay: 30,
          deductible_remaining: 750,
          estimated_visit_cost: { min: 30, max: 120 },
          spoken_summary:
            'Your UnitedHealthcare Choice Plus plan shows active coverage. Expect roughly a $30 copay for a primary care visit.',
        },
        created_at: patTime,
      };
    }

    await db.put('notes', note);
  }
}
