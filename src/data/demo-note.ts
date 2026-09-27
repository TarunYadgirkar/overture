import { NoteGenerationResult } from '../types';

export const DEMO_TRANSCRIPT = `Agent: Hi, I'm Overture, your clinic's intake assistant. What brings you in?
Patient: I've got this itchy rash on my right forearm, it started about three days ago after I was gardening.
Agent: I see you had a similar rash last November that was treated with triamcinolone cream. Does this feel like the same thing?
Patient: Oh yeah, honestly it does. That cream worked great last time.
Agent: Good to know — I'll note that for your doctor. Any fever, swelling of your face or throat, or trouble breathing?
Patient: No, nothing like that. Just really itchy, especially at night. I tried hydrocortisone from the pharmacy but it barely helps.
Agent: Understood. Anything else the doctor should know? And do you have any questions about cost or coverage?
Patient: Yeah actually — what would a visit cost me?
Agent: Your UnitedHealthcare plan shows active coverage. A telehealth visit would be about a $20 copay, and given your history this looks well suited to telehealth. Your doctor will confirm.
Patient: Perfect, that's all I needed.
Agent: Great. I've charted everything for your provider to review before your visit. Feel better soon!`;

export const DEMO_NOTE: NoteGenerationResult = {
  patient_summary:
    'Patient reports an itchy, spreading rash on the right forearm that began three days ago after gardening. No fever, no trouble breathing, no facial swelling. Tried over-the-counter hydrocortisone with minimal relief. History of a similar contact dermatitis episode last November.',
  chief_concern: 'Itchy spreading rash on right forearm, 3 days',
  symptoms_reported: ['Itchy raised rash', 'Mild spreading over 3 days', 'No fever', 'No swelling of face or throat'],
  history_of_present_illness:
    'Onset 3 days ago after gardening. Gradual spread on forearm. Itching worse at night. OTC hydrocortisone tried with minimal effect. Denies systemic symptoms.',
  medication_mentions: 'OTC hydrocortisone cream (minimal relief). Loratadine 10mg daily for seasonal allergies.',
  prior_care: 'Similar rash treated with triamcinolone cream in November 2025, resolved in two weeks.',
  patient_goals: ['Identify the rash and stop the itching', 'Know whether an in-person visit is needed', 'Understand visit cost in advance'],
  soap_note: {
    subjective:
      'Patient reports a pruritic, mildly spreading rash on the right forearm beginning three days ago after gardening. Itching is worse at night. OTC hydrocortisone provided minimal relief. Patient recalls a similar episode in November 2025 that resolved with prescription triamcinolone. Denies fever, facial/throat swelling, or difficulty breathing. Takes loratadine 10mg daily for seasonal allergies. Documented penicillin allergy.',
    objective:
      'Voice intake only — no exam or vitals available. Patient was coherent and organized; reported visible raised red rash localized to right forearm.',
    assessment:
      'Patient-reported localized pruritic rash consistent with prior contact dermatitis history. No diagnosis is made by this AI system. No red-flag features reported (no systemic symptoms, no mucosal involvement).',
    plan:
      'Provider to visually assess rash (photo or in-person). Consider whether prior triamcinolone regimen is appropriate to repeat. Review allergy history before any prescription. Counsel on trigger avoidance (gardening exposure).',
  },
  risk: {
    level: 'low',
    flags: ['Recurrent dermatitis', 'Penicillin allergy on record'],
    urgent_provider_review: false,
    reason: 'Localized rash without systemic involvement. Routine review appropriate.',
  },
  care_recommendation: {
    care_level: 'telehealth',
    confidence: 0.82,
    reasoning: 'Localized recurrent rash without red flags is well suited to a photo/video telehealth assessment; prior episode resolved with topical prescription.',
    red_flags_to_watch: ['Rapid spreading', 'Facial or throat swelling', 'Fever', 'Blistering or open sores'],
  },
  suggested_provider_questions: [
    'Any new soaps, plants, or chemicals during gardening?',
    'Has the rash changed appearance since onset (blisters, oozing)?',
    'Did the November episode occur after similar exposure?',
  ],
  follow_up_actions: [
    'Provider to review rash photos before or during visit',
    'Confirm allergy list before prescribing',
    'Advise ER immediately if breathing difficulty or facial swelling develops',
  ],
  missing_information: ['Photo of the rash', 'Exact products/plants contacted', 'Any prior patch testing'],
};
