import { HistoryDoc } from '../types';
import { demoHistoryDocs, EPIC_FHIR_MOCK } from '../data/epic-mock';
import {
  getPatient,
  listAllergies,
  listMedications,
  listSymptoms,
  getNoteByPatient,
} from './recordStore';

export interface HistorySearchResult {
  source: 'stored' | 'epic' | 'demo' | 'fallback';
  results: Array<{ text: string; score: number }>;
}

export async function buildHistoryDocs(
  patientId?: string,
  patientName?: string,
): Promise<HistoryDoc[]> {
  const docs: HistoryDoc[] = [];
  const targetName = patientName?.trim() || 'Patient';

  // 1. Check Epic MyChart import from localStorage
  try {
    const rawImport = localStorage.getItem('overture-epic-import');
    if (rawImport) {
      const parsed = JSON.parse(rawImport);
      if (
        parsed?.record?.patient?.name &&
        parsed.record.patient.name.toLowerCase() === targetName.toLowerCase()
      ) {
        const record = parsed.record as typeof EPIC_FHIR_MOCK;
        if (record.medications?.length) {
          const medList = record.medications
            .map((m) => `${m.name}, ${m.frequency} (started ${m.started})`)
            .join('; ');
          docs.push({
            id: 'epic_meds',
            text: `${targetName} — Active medications: ${medList}`,
          });
        }
        if (record.allergies?.length) {
          const allgList = record.allergies
            .map((a) => `${a.substance} (${a.reaction}, ${a.severity}, recorded ${a.recorded})`)
            .join('; ');
          docs.push({
            id: 'epic_allergies',
            text: `${targetName} — Allergy list: ${allgList}`,
          });
        }
        if (record.conditions?.length) {
          const condList = record.conditions
            .map((c) => `${c.name} (${c.icd10}, ${c.status}, diagnosed ${c.diagnosed})`)
            .join('; ');
          docs.push({
            id: 'epic_conditions',
            text: `${targetName} — Active conditions: ${condList}`,
          });
        }
        if (record.recentEncounters?.length) {
          for (let i = 0; i < record.recentEncounters.length; i++) {
            const enc = record.recentEncounters[i];
            docs.push({
              id: `epic_enc_${i}`,
              text: `${targetName} — Visit ${enc.date}: ${enc.type} with ${enc.provider} at ${enc.facility}.`,
            });
          }
        }
      }
    }
  } catch {
    // Ignore storage parsing issues
  }

  // 2. If patientId is provided, fetch stored patient history from recordStore
  if (patientId) {
    try {
      const pat = await getPatient(patientId);
      const name = pat?.name || targetName;

      // Allergies
      const allergies = await listAllergies(patientId);
      if (allergies.length > 0) {
        const str = allergies.map((a) => `${a.substance} (${a.reaction || 'recorded'})`).join('; ');
        docs.push({
          id: `pat_allergies_${patientId}`,
          text: `${name} — Allergy list: ${str}`,
        });
      }

      // Meds
      const meds = await listMedications(patientId);
      if (meds.length > 0) {
        const str = meds.map((m) => `${m.name} — ${m.dosage || 'as directed'}`).join('; ');
        docs.push({
          id: `pat_meds_${patientId}`,
          text: `${name} — Active medications: ${str}`,
        });
      }

      // Symptoms (last 30 days, up to 15)
      const symptoms = await listSymptoms(patientId);
      if (symptoms.length > 0) {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const recentSymptoms = symptoms.filter((s) => {
          try {
            return new Date(s.onset) >= thirtyDaysAgo;
          } catch {
            return true;
          }
        });
        const itemsToUse = recentSymptoms.length > 0 ? recentSymptoms : symptoms;

        const symptomStrs = itemsToUse.slice(0, 15).map((s) => {
          let rel = 'recently';
          const ymd = s.onset.split('T')[0] || s.onset;
          try {
            const onsetDate = new Date(s.onset);
            const diffDays = Math.floor((now.getTime() - onsetDate.getTime()) / (1000 * 60 * 60 * 24));
            rel = diffDays <= 0 ? 'today' : diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
          } catch {}
          return `${s.text} (severity ${s.severity} of 10, started ${rel} on ${ymd})`;
        });
        docs.push({
          id: `pat_symptoms_${patientId}`,
          text: `${name} — Symptoms the patient logged themselves in the last 30 days: ${symptomStrs.join('; ')}`,
        });
      }

      // Notes
      const note = await getNoteByPatient(patientId);
      if (note && note.ai_summary) {
        docs.push({
          id: `pat_note_${note.id}`,
          text: `${name} — Prior visit note: ${note.chief_concern || 'Intake'}. ${note.ai_summary} Assessment: ${note.soap_assessment || ''} Plan: ${note.soap_plan || ''}`,
        });
      }
    } catch {
      // Continue to fallback
    }
  }

  // 3. Fallback to demo docs if docs array is empty
  if (docs.length === 0) {
    return demoHistoryDocs(targetName);
  }

  return docs;
}

export async function lookupPatientHistory(
  query: string,
  patientId?: string,
  patientName?: string,
): Promise<HistorySearchResult> {
  const docs = await buildHistoryDocs(patientId, patientName);

  if (!query || query.trim().length === 0) {
    return {
      source: 'fallback',
      results: docs.slice(0, 3).map((d) => ({ text: d.text, score: 1 })),
    };
  }

  // Keyword retrieval algorithm from spec 6.9:
  // Split query into words longer than 3 chars, score each doc by how many match
  const searchWords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const scoredDocs = docs.map((doc) => {
    const lowerText = doc.text.toLowerCase();
    let score = 0;
    for (const word of searchWords) {
      if (lowerText.includes(word)) {
        score++;
      }
    }
    return { text: doc.text, score };
  });

  const matchingDocs = scoredDocs.filter((d) => d.score > 0);
  matchingDocs.sort((a, b) => b.score - a.score);

  if (matchingDocs.length > 0) {
    return {
      source: 'stored',
      results: matchingDocs.slice(0, 3),
    };
  }

  return {
    source: 'fallback',
    results: scoredDocs.slice(0, 3),
  };
}
