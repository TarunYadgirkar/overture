# Overture

Overture is a voice-first pre-visit intake application designed to make clinical check-in seamless and transparent. The patient speaks with a Gemini Live agent for a few minutes before their appointment. As they talk, the conversation is charted into a FHIR-shaped record directly in the browser. The agent checks insurance details against synthetic eligibility data to answer what the visit is expected to cost, and the provider opens a structured draft SOAP note ready for clinical review.

## What it does

### Patient features
- Intake wizard: guides patients through personal details, insurance selection, and consent before launching the voice check-in.
- Health records import: simulates connecting patient health records to preload relevant medical history and conditions.
- MedCard: allows patients to scan pill bottles or manage active medications with dosage and frequency details.
- Symptom timeline: lets patients log symptom progression and severity over time prior to their visit.
- Coverage assistant: estimates copays, deductibles, and visit costs using synthetic payer plans.

### Provider features
- Queue dashboard: lists patients awaiting consultation with real-time intake statuses and risk indicators.
- Note review with deep research: displays draft clinical notes with patient explainers, care options, and clinical considerations.
- Patient chart: provides a complete view of historical records, logged symptoms, encounter history, and medication profiles.

## How the AI is used

Overture uses Gemini models across both voice and structured text tasks:

- Gemini Live: uses native audio streaming with three client tools: lookup_patient_history, check_insurance_coverage, and end_checkin.
- Gemini text with JSON schemas: generates structured clinical notes, deep research analyses, pill bottle label readings, voice-based medication extractions, and clinical trial matching.
- Safe fallbacks: every feature includes a deterministic fallback path so the entire application functions predictably even when no API key is present.

## Run it locally

1. Install dependencies:
   ```bash
   npm install
   ```
   or
   ```bash
   bun install
   ```

2. Configure environment variables:
   Create a `.env.local` file at the root and set your API key:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Run strict type checking:
   ```bash
   npm run lint
   ```

## Data and privacy

All application data is stored locally in the browser. The system uses an IndexedDB record store containing records shaped after Patient, Encounter, DocumentReference, Composition, RiskAssessment, and Observation resources. Browser localStorage is used for MedCard details, imported records, and insurance selections. All data generated and processed within the application is synthetic.

## Safety

Overture never diagnoses, prescribes, or treats medical conditions. If red-flag symptoms are detected during intake, the agent immediately instructs the patient to call 911 for medical emergencies or 988 for crisis support and concludes the check-in. All generated clinical notes and summaries are drafts intended exclusively for licensed provider review.
