import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Edit3,
  ShieldAlert,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Check,
  ArrowRight,
  ArrowLeft,
  SquareCheck,
  FolderSync,
  Sparkles,
  FileText,
  Badge,
  Calendar,
  Hourglass,
  Shield,
  FileCode,
  StopCircle,
  Clock,
  CreditCard,
  User,
  Bot,
} from 'lucide-react';
import { Nav, StepProgress, Btn, IconSquareInputRow } from '../components/primitives';
import { VoiceOrb } from '../components/VoiceOrb';
import { CoverageBot } from '../components/CoverageBot';
import { CARRIERS } from '../data/insurance-plans';
import { CarrierKey, CoverageSummary } from '../types';
import { DEMO_TRANSCRIPT } from '../data/demo-note';
import { hasEmergencyIndicator } from '../data/emergency-keywords';
import {
  createPatient,
  openEncounter,
  finishEncounter,
  saveTranscript,
  saveNote,
} from '../services/recordStore';
import { generateNote } from '../services/gemini';
import { checkEligibility } from '../services/eligibility';
import { useVoiceAgent } from '../services/voiceAgent';

export function IntakePage() {
  const navigate = useNavigate();

  // Wizard steps: 'form' | 'consent' | 'calling' | 'complete'
  const [step, setStep] = useState<'form' | 'consent' | 'calling' | 'complete'>('form');
  const [voiceFirst, setVoiceFirst] = useState(false);

  // Form State
  const [patientName, setPatientName] = useState('');
  const [appointmentType, setAppointmentType] = useState('Sick visit');
  const [customAppointment, setCustomAppointment] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [carrierKey, setCarrierKey] = useState<CarrierKey | 'NONE'>('UHC');
  const [planId, setPlanId] = useState('uhc-choice-plus');
  const [callSeconds, setCallSeconds] = useState(180);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Session State
  const [patientId, setPatientId] = useState<string>('');
  const [encounterId, setEncounterId] = useState<string>('');
  const [noteId, setNoteId] = useState<string>('');
  const [savedCoverage, setSavedCoverage] = useState<CoverageSummary | null>(null);
  const [coverageCheckedDuringCall, setCoverageCheckedDuringCall] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Session ID refs to avoid stale closure issues
  const patientIdRef = useRef<string>('');
  const encounterIdRef = useRef<string>('');

  // Finishing ref guard to guarantee idempotency and prevent duplicate calls
  const finishingRef = useRef(false);

  // Ref to auto-scroll live transcript
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Voice Agent Hook
  const voice = useVoiceAgent();

  // Track if coverage check actually ran during live call
  useEffect(() => {
    if (voice.coverage) {
      setCoverageCheckedDuringCall(true);
    }
  }, [voice.coverage]);

  const selectedCarrier = CARRIERS.find((c) => c.key === carrierKey);

  const handleCarrierChange = (newCarrier: string) => {
    if (newCarrier === 'NONE') {
      setCarrierKey('NONE');
      setPlanId('');
    } else {
      const cKey = newCarrier as CarrierKey;
      setCarrierKey(cKey);
      const c = CARRIERS.find((item) => item.key === cKey);
      if (c && c.plans.length > 0) {
        setPlanId(c.plans[0].id);
      }
    }
  };

  const effectiveAppointment =
    appointmentType === 'Other — describe it…' ? customAppointment : appointmentType;

  const handleStartCheckIn = async (voiceFirst = false) => {
    try {
      finishingRef.current = false;
      setCoverageCheckedDuringCall(false);
      const name = voiceFirst && !patientName.trim() ? 'Walk-in Patient' : patientName.trim() || 'Walk-in Patient';
      const appt = voiceFirst && !patientName.trim() ? 'Voice check-in' : effectiveAppointment || 'Voice check-in';

      // 1. Create Patient & Encounter in IndexedDB exactly ONCE
      const pId = await createPatient(name, ageRange, appt);
      const eId = await openEncounter(pId, appt);

      patientIdRef.current = pId;
      encounterIdRef.current = eId;
      setPatientId(pId);
      setEncounterId(eId);

      // Store in localStorage for session tracking
      localStorage.setItem('overture-patient-id', pId);
      localStorage.setItem('overture-patient-name', name);
      if (carrierKey !== 'NONE') {
        localStorage.setItem('overture-payer', carrierKey);
        localStorage.setItem('overture-plan', planId);
      } else {
        localStorage.removeItem('overture-payer');
        localStorage.removeItem('overture-plan');
      }

      setStep('calling');

      // Start voice agent with onCallComplete callback
      await voice.start({
        patientId: pId,
        patientName: name,
        appointmentType: appt,
        callSeconds,
        collectIdentity: voiceFirst,
        payerKey: carrierKey !== 'NONE' ? carrierKey : undefined,
        planId: carrierKey !== 'NONE' ? planId : undefined,
        onCallComplete: () => {
          handleFinishCall(false);
        },
      });
    } catch (err) {
      console.error('Failed to start intake:', err);
    }
  };

  const handleFinishCall = async (useDemo = false) => {
    // Idempotent guard: prevent multiple calls or duplicate execution
    if (finishingRef.current) return;
    finishingRef.current = true;
    setIsFinishing(true);

    // Stop audio, micro streams, and live session
    voice.stop();

    try {
      let pId = patientIdRef.current || patientId;
      let eId = encounterIdRef.current || encounterId;

      // Fallback ONLY if user clicked demo transcript without ever pressing Start
      if (!pId) {
        const name = patientName.trim() || 'Walk-in Patient';
        const appt = effectiveAppointment || 'Voice check-in';
        pId = await createPatient(name, ageRange, appt);
        eId = await openEncounter(pId, appt);
        patientIdRef.current = pId;
        encounterIdRef.current = eId;
        setPatientId(pId);
        setEncounterId(eId);
      }

      // Read transcript and activity state directly from getters (never stale closures)
      const liveUtterances = voice.getTranscript();
      const callWasActive = voice.hasEverBeenActive();
      const hasLiveUtterances = liveUtterances.length > 0;

      // Fall back to demo ONLY when explicitly requested (useDemo === true) OR (live transcript has zero utterances AND call never reached active)
      const shouldUseDemo = useDemo || (!hasLiveUtterances && !callWasActive);

      const finalTranscript = !shouldUseDemo && hasLiveUtterances
        ? liveUtterances
            .map((u) => `${u.role === 'agent' ? 'Agent' : 'Patient'}: ${u.content}`)
            .join('\n')
        : DEMO_TRANSCRIPT;

      console.log('Generating note from transcript of length:', finalTranscript.length, 'utterances:', liveUtterances.length);

      // Deterministic emergency keyword screen on patient turns
      const emergencyFlag = hasEmergencyIndicator(finalTranscript);

      // Save transcript
      await saveTranscript(eId, pId, finalTranscript);
      if (eId) {
        await finishEncounter(eId);
      }

      // Generate Note
      const noteResult = await generateNote(finalTranscript);

      // If emergency was detected by deterministic screen, enforce high risk
      if (emergencyFlag && noteResult.risk.level !== 'high') {
        noteResult.risk.level = 'high';
        noteResult.risk.urgent_provider_review = true;
        if (!noteResult.risk.flags.includes('Emergency indicator detected in patient conversation')) {
          noteResult.risk.flags.unshift('Emergency indicator detected in patient conversation');
        }
      }

      // Calculate coverage / eligibility for the recommended care level
      const coverageSummary = checkEligibility({
        careLevel: noteResult.care_recommendation.care_level,
        payerKey: carrierKey !== 'NONE' ? carrierKey : undefined,
        planId: carrierKey !== 'NONE' ? planId : undefined,
      });
      setSavedCoverage(coverageSummary);

      // If demo transcript was used, coverage check did NOT run during call
      if (shouldUseDemo) {
        setCoverageCheckedDuringCall(false);
      }

      // Save Note into IndexedDB
      const saved = await saveNote({
        patient_id: pId,
        call_id: eId,
        ai_summary: noteResult.patient_summary,
        chief_concern: noteResult.chief_concern,
        symptoms_reported: noteResult.symptoms_reported,
        soap_subjective: noteResult.soap_note.subjective,
        soap_objective: noteResult.soap_note.objective,
        soap_assessment: noteResult.soap_note.assessment,
        soap_plan: noteResult.soap_note.plan,
        risk_level: noteResult.risk.level,
        risk_flags: noteResult.risk.flags,
        suggested_questions: noteResult.suggested_provider_questions,
        follow_up_actions: noteResult.follow_up_actions,
        status: noteResult.risk.urgent_provider_review ? 'urgent_review' : 'ai_draft',
        care_recommendation: noteResult.care_recommendation,
        coverage: coverageSummary,
      });

      setNoteId(saved.id);
      setStep('complete');
    } catch (err) {
      console.error('Failed to complete intake note:', err);
      setStep('complete');
    } finally {
      setIsFinishing(false);
    }
  };

  // Auto-scroll transcript to bottom as new messages arrive
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [voice.transcript]);

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Nav
        rightSlot={
          <div className="flex items-center gap-1.5 text-xs font-semibold text-faint">
            <Mic size={14} className="text-danger" />
            <span>Voice check-in</span>
          </div>
        }
      />

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10">
        {/* Step Progress Header */}
        <StepProgress currentStep={step} />

        {/* Step 1: Form */}
        {step === 'form' && (
          <div className="bg-panel border border-line p-6 sm:p-8 space-y-6 -mt-px">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-ink">
                Check in before your visit
              </h1>
              <p className="text-sm text-body">
                Talk to Overture for ~3 minutes. Your conversation is charted for your doctor as it happens — and you can ask what your visit will cost.
              </p>
            </div>

            {/* Emergency Callout */}
            <div className="bg-danger/10 border-l-4 border-l-danger p-4 flex items-start gap-3">
              <ShieldAlert size={20} className="text-danger shrink-0 mt-0.5" />
              <div className="text-xs text-ink leading-relaxed">
                <strong className="text-danger font-bold">Not a doctor. </strong>
                Overture collects information only — no diagnosis, no treatment. In an emergency call{' '}
                <strong className="font-bold">911</strong> (or <strong className="font-bold">988</strong> for mental health crisis).
              </div>
            </div>

            {/* Input Rows */}
            <div className="space-y-4">
              {/* Full Name */}
              <IconSquareInputRow icon={Badge} label="Your name" iconDark>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Full name as it appears in your records"
                  className="w-full text-sm font-bold text-ink outline-none bg-transparent pt-1 placeholder:text-faint placeholder:font-normal"
                />
              </IconSquareInputRow>

              {/* 2-Column: Appointment Type & Age Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <IconSquareInputRow icon={Calendar} label="Appointment type">
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                    className="w-full text-sm font-medium text-ink outline-none bg-transparent pt-1"
                  >
                    <option value="Sick visit">Sick visit</option>
                    <option value="New patient visit">New patient visit</option>
                    <option value="Annual physical">Annual physical</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Telehealth consult">Telehealth consult</option>
                    <option value="Other — describe it…">Other — describe it…</option>
                  </select>
                </IconSquareInputRow>

                <IconSquareInputRow icon={Hourglass} label="Age range · optional">
                  <select
                    value={ageRange}
                    onChange={(e) => setAgeRange(e.target.value)}
                    className="w-full text-sm font-medium text-ink outline-none bg-transparent pt-1"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="18–24">18–24</option>
                    <option value="25–34">25–34</option>
                    <option value="35–44">35–44</option>
                    <option value="45–54">45–54</option>
                    <option value="55+">55+</option>
                  </select>
                </IconSquareInputRow>
              </div>

              {appointmentType === 'Other — describe it…' && (
                <IconSquareInputRow icon={Edit3} label="Describe your visit">
                  <input
                    type="text"
                    value={customAppointment}
                    onChange={(e) => setCustomAppointment(e.target.value)}
                    placeholder="e.g. knee pain consult, medication review…"
                    maxLength={100}
                    className="w-full text-sm font-medium text-ink outline-none bg-transparent pt-1"
                  />
                </IconSquareInputRow>
              )}

              {/* Insurance & Plan */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <IconSquareInputRow icon={Shield} label="Insurance">
                    <select
                      value={carrierKey}
                      onChange={(e) => handleCarrierChange(e.target.value)}
                      className="w-full text-sm font-medium text-ink outline-none bg-transparent pt-1"
                    >
                      {CARRIERS.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name}
                        </option>
                      ))}
                      <option value="NONE">Self-pay / not sure</option>
                    </select>
                  </IconSquareInputRow>

                  {carrierKey !== 'NONE' && selectedCarrier && (
                    <IconSquareInputRow icon={FileCode} label="Plan">
                      <select
                        value={planId}
                        onChange={(e) => setPlanId(e.target.value)}
                        className="w-full text-sm font-medium text-ink outline-none bg-transparent pt-1"
                      >
                        {selectedCarrier.plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </IconSquareInputRow>
                  )}
                </div>
                <span className="text-xs text-faint block pl-1">
                  Used when you ask Overture what your visit will cost.
                </span>
              </div>

              {/* Call Length Slider */}
              <div className="bg-bright border border-line p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-faint flex items-center gap-1.5">
                    <Clock size={14} /> Urgency · call length:
                  </span>
                  <span className="font-bold text-brand">
                    {callSeconds === 15 ? '15 sec' : callSeconds === 60 ? '1 min' : callSeconds === 180 ? '3 min' : '5 min'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  value={callSeconds === 15 ? 0 : callSeconds === 60 ? 1 : callSeconds === 180 ? 2 : 3}
                  onChange={(e) => {
                    const map = [15, 60, 180, 300];
                    setCallSeconds(map[parseInt(e.target.value, 10)]);
                  }}
                  className="w-full accent-brand cursor-pointer"
                />
                <div className="flex justify-between text-xs text-faint pt-1">
                  <span className={callSeconds === 15 ? 'font-bold text-brand' : ''}>15 sec</span>
                  <span className={callSeconds === 60 ? 'font-bold text-brand' : ''}>1 min</span>
                  <span className={callSeconds === 180 ? 'font-bold text-brand' : ''}>3 min</span>
                  <span className={callSeconds === 300 ? 'font-bold text-brand' : ''}>5 min</span>
                </div>
              </div>

              {/* Health records notice */}
              <div className="p-4 bg-bright border border-line flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FolderSync size={24} className="text-brand shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-ink">Use MyChart?</div>
                    <div className="text-xs text-faint">
                      Import your record so Overture already knows your meds and allergies.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/records')}
                  className="px-3 py-2 text-xs font-bold border border-line hover:bg-panel shrink-0 cursor-pointer"
                >
                  Import records
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3 pt-2">
              <Btn
                variant="primary"
                onClick={() => {
                  setVoiceFirst(false);
                  setStep('consent');
                }}
                disabled={!patientName.trim()}
                className="w-full"
              >
                Continue &rarr;
              </Btn>

              <button
                type="button"
                onClick={() => {
                  setVoiceFirst(true);
                  setStep('consent');
                }}
                className="w-full py-3.5 px-6 border border-line bg-surface hover:bg-brand-light hover:border-brand text-ink text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Mic size={16} className="text-brand" />
                <span>Skip the form — just talk to Overture</span>
              </button>
              <div className="text-center text-xs text-faint">
                Overture will ask your name and visit type in conversation.
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Consent */}
        {step === 'consent' && (
          <div className="bg-panel border border-line p-6 sm:p-8 space-y-6 -mt-px">
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-danger flex items-center gap-1.5">
                <ShieldAlert size={14} />
                <span>Step 2 · consent</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-ink">
                Before we begin
              </h1>
              <p className="text-sm text-body">Please read and accept to continue.</p>
            </div>

            {/* 2x2 Grid of info tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
              <div className="bg-panel p-4 space-y-2">
                <div className="text-sm font-bold text-positive flex items-center gap-1.5">
                  <Check size={16} /> What this is
                </div>
                <p className="text-xs text-body leading-relaxed">
                  An AI voice assistant that collects check-in information and charts it for your licensed provider.
                </p>
              </div>

              <div className="bg-panel p-4 space-y-2">
                <div className="text-sm font-bold text-danger flex items-center gap-1.5">
                  <ShieldAlert size={16} /> What this is not
                </div>
                <p className="text-xs text-body leading-relaxed">
                  Not medical advice, diagnosis, treatment, or crisis support.
                </p>
              </div>

              <div className="bg-panel p-4 space-y-2">
                <div className="text-sm font-bold text-brand flex items-center gap-1.5">
                  <FileText size={16} /> Your responses
                </div>
                <p className="text-xs text-body leading-relaxed">
                  Transcribed, summarized, and stored in your clinic record (FHIR) for your provider to review before your visit.
                </p>
              </div>

              <div className="bg-panel p-4 space-y-2">
                <div className="text-sm font-bold text-danger flex items-center gap-1.5">
                  <ShieldAlert size={16} /> Emergency
                </div>
                <p className="text-xs text-body leading-relaxed">
                  If you are in immediate danger, call 911 (or 988 for mental health crisis) now.
                </p>
              </div>
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 p-4 bg-bright border border-line cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5 accent-brand w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-ink leading-relaxed">
                I understand this is an AI check-in assistant, not a clinician. I consent to my responses being charted for my provider's review.
              </span>
            </label>

            {/* Buttons */}
            <div className="flex gap-3">
              <Btn variant="secondary" onClick={() => setStep('form')} icon={ArrowLeft}>
                Back
              </Btn>
              <Btn
                variant="primary"
                onClick={() => handleStartCheckIn(voiceFirst)}
                disabled={!consentAccepted}
                icon={Mic}
                className="flex-1"
              >
                Start Voice Check-in
              </Btn>
            </div>
          </div>
        )}

        {/* Step 3: Check-in (Hero Screen) */}
        {step === 'calling' && (
          <div className="bg-panel border border-line -mt-px overflow-hidden space-y-6 p-6 sm:p-8">
            {/* Header: title dynamic by state */}
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-ink">
                  {isFinishing || voice.state === 'ended'
                    ? 'Charting your visit…'
                    : voice.state === 'connecting'
                    ? 'Connecting…'
                    : 'Speak naturally'}
                </h2>
                <p className="text-xs text-faint mt-1">
                  Speak naturally. Ask what your visit will cost — Overture checks your coverage live.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-positive">
                <span className="w-2 h-2 bg-positive animate-pulse inline-block" />
                <span>Voice Agent</span>
              </div>
            </div>

            {/* Error banner if mic access failed or connection failed */}
            {voice.error && (
              <div className="p-4 bg-danger/10 border-l-4 border-l-danger text-xs text-danger flex items-start gap-2.5">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{voice.error}</span>
              </div>
            )}

            {/* Dark Voice Stage */}
            <div className="relative h-72 bg-ink flex flex-col items-center justify-center overflow-hidden border border-line/40">
              {/* Ambient glows */}
              <div className="absolute top-0 left-0 w-72 h-72 bg-caution/25 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-danger/25 rounded-full blur-3xl pointer-events-none" />

              {/* Viewfinder corner ticks */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-bright/50 pointer-events-none" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-bright/50 pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-bright/50 pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-bright/50 pointer-events-none" />

              {/* VoiceOrb in mic mode */}
              {voice.state === 'ended' || isFinishing ? (
                <div className="w-16 h-16 bg-positive text-bright flex items-center justify-center shadow-lg">
                  <Check size={32} />
                </div>
              ) : (
                <VoiceOrb
                  size={165}
                  mode="mic"
                  micLevel={voice.micLevel}
                  reactivity={2.6}
                />
              )}

              {/* Bottom Status Line */}
              <div className="absolute bottom-3 text-center text-xs font-semibold text-bright/80 flex items-center gap-2">
                {isFinishing || voice.state === 'ended' ? (
                  <span>Charting your visit…</span>
                ) : voice.state === 'connecting' ? (
                  <span>Connecting — allow microphone access…</span>
                ) : voice.state === 'agent_speaking' ? (
                  <span>Overture is speaking</span>
                ) : voice.state === 'error' ? (
                  <span>Connection issue</span>
                ) : (
                  <span>Listening — speak when ready</span>
                )}
              </div>
            </div>

            {/* 7 Reactive Voice Bars */}
            {(voice.state === 'active' || voice.state === 'agent_speaking') && (
              <div className="flex items-center justify-center gap-2 h-7">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                  const isCenter = i === 3;
                  const isMid = i === 2 || i === 4;
                  const bg = isCenter ? 'bg-danger' : isMid ? 'bg-caution' : 'bg-ink';
                  const activeHeight = Math.min(100, Math.max(12, voice.micLevel * 100 * (1 - Math.abs(i - 3) * 0.18)));
                  return (
                    <span
                      key={i}
                      className={`w-1.5 transition-all duration-75 ${bg}`}
                      style={{ height: `${activeHeight}%` }}
                    />
                  );
                })}
              </div>
            )}

            {/* Live Coverage Card that slides in */}
            {voice.coverage && (
              <div className="p-4 bg-bright border-2 border-brand/40 shadow-sm space-y-2 transition-all animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-line">
                  <span className="font-bold text-brand flex items-center gap-1.5">
                    <CreditCard size={15} /> Live Coverage Check
                  </span>
                  <span className="px-2 py-0.5 bg-brand-light text-brand font-bold text-[10px]">
                    {voice.coverage.plan_status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-ink">{voice.coverage.payer}</div>
                  <div className="text-sm font-black text-brand">
                    {voice.coverage.copay !== null && voice.coverage.copay !== undefined
                      ? `$${voice.coverage.copay} copay`
                      : `$${voice.coverage.estimated_visit_cost.min}–$${voice.coverage.estimated_visit_cost.max}`}
                  </div>
                </div>
                <p className="text-xs text-body leading-relaxed">{voice.coverage.spoken_summary}</p>
              </div>
            )}

            {/* Live Transcript Panel */}
            {voice.transcript.length > 0 && (
              <div className="bg-bright border border-line p-4 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-line">
                  <span className="font-bold text-ink">Live transcript</span>
                  <span className="font-semibold text-brand flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-brand animate-pulse inline-block" /> Charting your visit
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-2.5 text-xs pr-1">
                  {voice.transcript.map((u, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 flex items-start gap-2.5 border ${
                        u.role === 'agent'
                          ? 'bg-panel border-line text-ink'
                          : 'bg-surface border-line/60 text-ink'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {u.role === 'agent' ? (
                          <Bot size={15} className="text-brand" />
                        ) : (
                          <User size={15} className="text-danger" />
                        )}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div
                          className={`text-xs font-bold ${
                            u.role === 'agent' ? 'text-brand' : 'text-danger'
                          }`}
                        >
                          {u.role === 'agent' ? 'Overture' : 'You'}
                        </div>
                        <div className="text-xs text-body leading-relaxed whitespace-pre-wrap">
                          {u.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            )}

            {/* Live Controls */}
            {(voice.state === 'active' || voice.state === 'agent_speaking') && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={voice.toggleMic}
                    aria-pressed={voice.micMuted}
                    className={`py-3 px-4 border text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      voice.micMuted
                        ? 'border-danger bg-danger/10 text-danger'
                        : 'border-line bg-bright text-ink hover:bg-panel'
                    }`}
                  >
                    {voice.micMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    <span>{voice.micMuted ? 'Unmute mic' : 'Mute mic'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={voice.toggleAgent}
                    aria-pressed={voice.agentMuted}
                    className={`py-3 px-4 border text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      voice.agentMuted
                        ? 'border-danger bg-danger/10 text-danger'
                        : 'border-line bg-bright text-ink hover:bg-panel'
                    }`}
                  >
                    {voice.agentMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    <span>{voice.agentMuted ? 'Unmute Overture' : 'Mute Overture'}</span>
                  </button>
                </div>

                <Btn
                  variant="dangerSoft"
                  onClick={() => handleFinishCall(false)}
                  loading={isFinishing}
                  loadingLabel="Charting your visit…"
                  icon={StopCircle}
                  className="w-full"
                >
                  End Check-in
                </Btn>
              </div>
            )}

            {/* Complete Call Action after ended or error */}
            {(voice.state === 'ended' || voice.state === 'error') && !isFinishing && (
              <Btn
                variant="primary"
                onClick={() => handleFinishCall(false)}
                icon={ArrowRight}
                className="w-full"
              >
                Generate Visit Note
              </Btn>
            )}

            {/* Demo Transcript Option BELOW Voice Stage */}
            <div className="pt-4 border-t border-line space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-faint flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand" /> No mic? Use the demo transcript
                </span>
                <span className="text-faint text-xs">Instant test mode</span>
              </div>
              <p className="text-xs text-faint line-clamp-2 italic bg-bright p-2.5 border border-line">
                "{DEMO_TRANSCRIPT.slice(0, 160)}…"
              </p>
              <Btn
                variant="secondary"
                onClick={() => handleFinishCall(true)}
                loading={isFinishing}
                loadingLabel="Charting your visit…"
                className="w-full"
              >
                Use Demo Transcript + Chart Visit
              </Btn>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'complete' && (
          <div className="bg-panel border border-line p-6 sm:p-10 space-y-6 -mt-px text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-positive to-ink flex items-center justify-center text-bright shadow-lg">
                <Check size={44} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-positive flex items-center justify-center gap-1.5">
                  <SquareCheck size={14} />
                  <span>Step 4 · done</span>
                </div>
                <h1 className="text-3xl font-black text-ink">You're checked in</h1>
                <p className="text-sm text-body max-w-md mx-auto">
                  Your conversation was charted as FHIR resources. Your provider will review the AI draft note before your visit.
                </p>
              </div>
            </div>

            {/* Receipt list */}
            <div className="divide-y divide-line border border-line bg-bright text-left">
              <div className="p-3.5 flex items-center gap-3 text-xs font-semibold text-ink">
                <Badge size={16} className="text-brand shrink-0" />
                <span>Patient · Encounter created</span>
              </div>
              <div className="p-3.5 flex items-center gap-3 text-xs font-semibold text-ink">
                <FileText size={16} className="text-brand shrink-0" />
                <span>DocumentReference · transcript</span>
              </div>
              <div className="p-3.5 flex items-center gap-3 text-xs font-semibold text-ink">
                <Edit3 size={16} className="text-caution shrink-0" />
                <span>Composition · SOAP draft</span>
              </div>
              {/* Show copay receipt row only if check_insurance_coverage ran during live call */}
              {coverageCheckedDuringCall && savedCoverage?.copay !== null && savedCoverage?.copay !== undefined && (
                <div className="p-3.5 flex items-center gap-3 text-xs font-semibold text-ink bg-positive/5">
                  <CreditCard size={16} className="text-positive shrink-0" />
                  <span>
                    Coverage · ${savedCoverage.copay} copay confirmed ({savedCoverage.payer})
                  </span>
                </div>
              )}
            </div>

            {/* Action Links */}
            <div className="space-y-3 pt-2">
              {noteId && (
                <Btn
                  variant="primary"
                  onClick={() => navigate(`/dashboard/note/${noteId}`)}
                  icon={FileText}
                  className="w-full"
                >
                  View the provider's draft note
                </Btn>
              )}

              <button
                onClick={() => navigate('/dashboard')}
                className="text-xs font-bold text-ink hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Provider dashboard</span> &rarr;
              </button>
            </div>
          </div>
        )}
      </main>

      <CoverageBot />
    </div>
  );
}
