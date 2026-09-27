import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Camera,
  Mic,
  Plus,
  Building,
  Check,
  RotateCcw,
  ExternalLink,
  Upload,
  Pill,
  Heart,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { Nav, Btn, Spinner } from '../components/primitives';
import { ConnectRecordsModal } from '../components/ConnectRecordsModal';
import { MedCardData, TrialMatch, ScanLabelResult } from '../types';
import { getApiKey, hasKey } from '../services/gemini';

export function MedCardPage() {
  const [card, setCard] = useState<MedCardData>({
    medications: [],
    allergies: [],
    conditions: [],
    lastUpdated: 'Today',
  });
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Section refs for anchor scrolling from empty-state tiles
  const scanRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<HTMLDivElement>(null);
  const manualRef = useRef<HTMLDivElement>(null);

  // Manual Add Form State
  const [manualName, setManualName] = useState('');
  const [manualDosage, setManualDosage] = useState('');
  const [manualFrequency, setManualFrequency] = useState('');
  const [manualSuccessMsg, setManualSuccessMsg] = useState('');

  // Vision Scan State
  const [scanState, setScanState] = useState<'idle' | 'loading' | 'confirm' | 'saved' | 'no_key' | 'error'>('idle');
  const [scanResult, setScanResult] = useState<ScanLabelResult | null>(null);
  const [lastAutosavedMed, setLastAutosavedMed] = useState<string>('');
  const [scanEditName, setScanEditName] = useState('');
  const [scanEditDosage, setScanEditDosage] = useState('');
  const [scanEditFreq, setScanEditFreq] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Description State
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'review' | 'extracting' | 'confirm' | 'saved' | 'unsupported'>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [extractedMeds, setExtractedMeds] = useState<Array<{ medicationName: string; dosage: string; frequency: string }>>([]);
  const recognitionRef = useRef<any>(null);

  // Clinical Trials State
  const [trialLoading, setTrialLoading] = useState(false);
  const [trials, setTrials] = useState<TrialMatch[] | null>(null);

  const loadCard = () => {
    try {
      const rawCard = localStorage.getItem('overture-medcard');
      if (rawCard) {
        setCard(JSON.parse(rawCard));
      } else {
        setCard({
          medications: [],
          allergies: [],
          conditions: [],
          lastUpdated: 'Today',
        });
      }
    } catch {
      setCard({
        medications: [],
        allergies: [],
        conditions: [],
        lastUpdated: 'Today',
      });
    }
  };

  useEffect(() => {
    loadCard();
    const handleChanged = () => loadCard();
    window.addEventListener('overture:records-changed', handleChanged);
    return () => window.removeEventListener('overture:records-changed', handleChanged);
  }, []);

  const saveCard = (updated: MedCardData) => {
    localStorage.setItem('overture-medcard', JSON.stringify(updated));
    setCard(updated);
    window.dispatchEvent(new CustomEvent('overture:records-changed'));
  };

  const formatMedString = (name: string, dosage?: string, freq?: string) => {
    const cleanName = name.trim();
    const cleanDosage = (dosage || '').trim();
    const cleanFreq = (freq || '').trim();

    if (cleanDosage && cleanFreq) {
      return `${cleanName} ${cleanDosage} — ${cleanFreq}`;
    }
    if (cleanDosage) {
      return `${cleanName} ${cleanDosage}`;
    }
    if (cleanFreq) {
      return `${cleanName} — ${cleanFreq}`;
    }
    return cleanName;
  };

  const addMedicationToCard = (formatted: string) => {
    const existing = card.medications || [];
    const lower = formatted.toLowerCase();
    if (!existing.some((m) => m.toLowerCase() === lower)) {
      const updated: MedCardData = {
        ...card,
        medications: [...existing, formatted],
        lastUpdated: new Date().toLocaleDateString(),
      };
      saveCard(updated);
    }
  };

  const removeMedicationFromCard = (formatted: string) => {
    const existing = card.medications || [];
    const updated: MedCardData = {
      ...card,
      medications: existing.filter((m) => m.toLowerCase() !== formatted.toLowerCase()),
      lastUpdated: new Date().toLocaleDateString(),
    };
    saveCard(updated);
  };

  const handleClear = () => {
    const empty: MedCardData = {
      medications: [],
      allergies: [],
      conditions: [],
      lastUpdated: new Date().toLocaleDateString(),
    };
    saveCard(empty);
  };

  // Manual Add Form Submit
  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    const formatted = formatMedString(manualName, manualDosage, manualFrequency);
    addMedicationToCard(formatted);
    setManualSuccessMsg(`Added ${formatted} to your MedCard`);
    setManualName('');
    setManualDosage('');
    setManualFrequency('');

    setTimeout(() => {
      setManualSuccessMsg('');
    }, 4000);
  };

  // Scan Pill Bottle with Gemini Vision
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!hasKey()) {
      setScanState('no_key');
      return;
    }

    setScanState('loading');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const apiKey = getApiKey();

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const imagePart = {
          inlineData: {
            mimeType: file.type || 'image/jpeg',
            data: base64Data,
          },
        };

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              imagePart,
              {
                text: 'Read this medication label.',
              },
            ],
          },
          config: {
            systemInstruction: `You are a pill bottle label reader. Extract medication name, dosage, and frequency/instructions from the image. Return JSON: {"medicationName": string, "dosage": string, "frequency": string, "confidence": "low"|"medium"|"high"}. If the image is unreadable or not a medication label, set medicationName to "" and confidence to "low".`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                medicationName: { type: Type.STRING },
                dosage: { type: Type.STRING },
                frequency: { type: Type.STRING },
                confidence: {
                  type: Type.STRING,
                  enum: ['low', 'medium', 'high'],
                },
              },
              required: ['medicationName', 'dosage', 'frequency', 'confidence'],
            },
          },
        });

        const text = response.text?.trim();
        if (text) {
          const parsed = JSON.parse(text) as ScanLabelResult;
          setScanResult(parsed);

          if (parsed.confidence === 'high' && parsed.medicationName) {
            const formatted = formatMedString(parsed.medicationName, parsed.dosage, parsed.frequency);
            addMedicationToCard(formatted);
            setLastAutosavedMed(formatted);
            setScanEditName(parsed.medicationName);
            setScanEditDosage(parsed.dosage || '');
            setScanEditFreq(parsed.frequency || '');
            setScanState('saved');
          } else {
            setScanEditName(parsed.medicationName || '');
            setScanEditDosage(parsed.dosage || '');
            setScanEditFreq(parsed.frequency || '');
            setScanState('confirm');
          }
        } else {
          setScanState('error');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Scan failed:', err);
      setScanState('error');
    }
  };

  const handleConfirmScan = () => {
    if (!scanEditName.trim()) return;
    const formatted = formatMedString(scanEditName, scanEditDosage, scanEditFreq);
    addMedicationToCard(formatted);
    setScanState('saved');
  };

  const handleUndoAutosave = () => {
    if (lastAutosavedMed) {
      removeMedicationFromCard(lastAutosavedMed);
    }
    setScanState('confirm');
  };

  // Voice Description with Web Speech API
  const startListening = () => {
    setVoiceError('');
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceState('unsupported');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setVoiceState('listening');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        setVoiceTranscript(transcript.trim());
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setVoiceError('Microphone access was denied. Allow mic access in your browser settings, or type your medications below instead.');
        } else if (event.error === 'no-speech') {
          setVoiceError("We didn't hear anything. Tap the mic and try again.");
        } else if (event.error === 'audio-capture') {
          setVoiceError('No microphone was found. Check your device and try again.');
        } else if (event.error === 'network') {
          setVoiceError('Speech recognition needs a network connection. Check your connection and try again.');
        } else {
          setVoiceError('Voice input failed — please try again.');
        }
        stopListening();
        setVoiceState('idle');
      };

      recognition.onend = () => {
        if (voiceState === 'listening') {
          setVoiceState('review');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setVoiceError('Voice input failed — please try again.');
      setVoiceState('idle');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (voiceState === 'listening') {
      setVoiceState('review');
    }
  };

  const handleExtractFromVoice = async () => {
    if (!voiceTranscript.trim()) return;
    setVoiceState('extracting');

    if (!hasKey()) {
      // Fallback extraction without Gemini
      const items = voiceTranscript
        .split(/(?:,|\band\b|\n)/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 2);
      setExtractedMeds(
        items.map((it) => ({ medicationName: it, dosage: '', frequency: '' })),
      );
      setVoiceState('confirm');
      return;
    }

    try {
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: voiceTranscript,
        config: {
          systemInstruction: `You extract medications from a patient's spoken or typed description. The text may mention several medications. Return JSON: {"medications": [{"medicationName": string, "dosage": string, "frequency": string, "confidence": "low"|"medium"|"high"}]}. Use "" for any dosage or frequency the patient did not state. Confidence reflects how clearly the medication was named. If no medications are mentioned, return {"medications": []}. Never invent medications not present in the text.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              medications: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    medicationName: { type: Type.STRING },
                    dosage: { type: Type.STRING },
                    frequency: { type: Type.STRING },
                    confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                  },
                  required: ['medicationName', 'dosage', 'frequency', 'confidence'],
                },
              },
            },
            required: ['medications'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{"medications":[]}');
      setExtractedMeds(parsed.medications || []);
      setVoiceState('confirm');
    } catch {
      setVoiceState('confirm');
    }
  };

  const handleSaveExtractedMeds = () => {
    for (const med of extractedMeds) {
      if (med.medicationName.trim()) {
        const formatted = formatMedString(med.medicationName, med.dosage, med.frequency);
        addMedicationToCard(formatted);
      }
    }
    setVoiceState('saved');
    setVoiceTranscript('');
    setExtractedMeds([]);
  };

  // Clinical Trials Matching
  const handleCheckTrials = async () => {
    setTrialLoading(true);

    const activeMeds = card.medications || [];
    const activeConditions = card.conditions || [];
    const activeAllergies = card.allergies || [];

    const context = `Medications:\n${activeMeds.join('\n')}\n\nConditions:\n${activeConditions.join('\n')}\n\nAllergies:\n${activeAllergies.join('\n')}`;

    if (!hasKey()) {
      // Deterministic fallback keyword matching
      const allText = context.toLowerCase();
      const matched: TrialMatch[] = [];

      if (/diabet|metformin|insulin|a1c|glucose|prediabet/.test(allText)) {
        matched.push({
          title: 'Lifestyle and medication studies in type 2 diabetes and prediabetes',
          condition_match: 'Type 2 Diabetes',
          why_eligible: 'Matches your active glycemic management and blood sugar profile.',
          search_url: 'https://clinicaltrials.gov/search?cond=' + encodeURIComponent('Type 2 Diabetes'),
        });
      }
      if (/hypertension|blood pressure|lisinopril|amlodipine|losartan/.test(allText)) {
        matched.push({
          title: 'Blood pressure control and cardiovascular outcome studies',
          condition_match: 'Hypertension',
          why_eligible: 'Matches active blood pressure therapy and cardiovascular markers.',
          search_url: 'https://clinicaltrials.gov/search?cond=' + encodeURIComponent('Hypertension'),
        });
      }
      if (/dermatitis|eczema|rash|psoriasis|hives/.test(allText)) {
        matched.push({
          title: 'Topical and biologic studies for inflammatory skin conditions',
          condition_match: 'Dermatitis',
          why_eligible: 'Matches prior documented skin reactions and anti-inflammatory therapy.',
          search_url: 'https://clinicaltrials.gov/search?cond=' + encodeURIComponent('Dermatitis'),
        });
      }
      if (/asthma|inhaler|albuterol|wheez/.test(allText)) {
        matched.push({
          title: 'Inhaled therapy and asthma-control studies',
          condition_match: 'Asthma',
          why_eligible: 'Matches respiratory medication history on file.',
          search_url: 'https://clinicaltrials.gov/search?cond=' + encodeURIComponent('Asthma'),
        });
      }
      if (/migraine|headache|sumatriptan|triptan/.test(allText)) {
        matched.push({
          title: 'Preventive and acute treatment studies for migraine',
          condition_match: 'Migraine',
          why_eligible: 'Matches episodic headache and migraine history on record.',
          search_url: 'https://clinicaltrials.gov/search?cond=' + encodeURIComponent('Migraine'),
        });
      }

      setTrials(matched);
      setTrialLoading(false);
      return;
    }

    try {
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: context,
        config: {
          systemInstruction: `You match a patient's medication/condition profile to types of clinical trials they MAY be eligible for on ClinicalTrials.gov. Given medications, conditions, and allergies, suggest 2-3 trial categories. Return JSON: {"trials": [{"title": string (max 90 chars), "condition_match": string, "why_eligible": string}]}. RULES: Only suggest categories clearly supported by the given profile. If nothing matches, return {"trials": []}. Never promise eligibility — phrase as "may be eligible". condition_match must be a real, searchable condition name.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              trials: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    condition_match: { type: Type.STRING },
                    why_eligible: { type: Type.STRING },
                  },
                  required: ['title', 'condition_match', 'why_eligible'],
                },
              },
            },
            required: ['trials'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{"trials":[]}');
      const formatted = (parsed.trials || []).map((t: any) => ({
        ...t,
        search_url: `https://clinicaltrials.gov/search?cond=${encodeURIComponent(t.condition_match)}`,
      }));
      setTrials(formatted);
    } catch {
      setTrials([]);
    } finally {
      setTrialLoading(false);
    }
  };

  const hasData =
    (card.medications && card.medications.length > 0) ||
    (card.allergies && card.allergies.length > 0) ||
    (card.conditions && card.conditions.length > 0);

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Nav
        rightSlot={
          <Link to="/" className="text-xs font-bold text-ink hover:underline">
            Home
          </Link>
        }
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-ink">Your MedCard</h1>
          <p className="text-sm text-body leading-relaxed">
            Medications, allergies, and conditions on file. Overture uses this during your voice check-in so you don't have to repeat yourself.
          </p>
        </div>

        {/* SECTION (a): MedCard display card */}
        <div className="bg-panel border border-line p-6 space-y-4">
          {!hasData ? (
            /* Empty State */
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-ink">Your card is empty — let's fix that</h2>
                <p className="text-xs text-body">
                  Three ways to fill it, pick whichever is easiest:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Tile 1: Scan a pill bottle */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 bg-bright border border-line hover:border-brand text-left space-y-2 cursor-pointer transition-colors group"
                >
                  <div className="w-8 h-8 bg-brand/10 text-brand flex items-center justify-center group-hover:bg-brand group-hover:text-bright transition-colors">
                    <Camera size={16} />
                  </div>
                  <div className="text-xs font-bold text-ink">Scan a pill bottle</div>
                  <p className="text-[11px] text-faint leading-relaxed">
                    Upload a photo of your prescription label.
                  </p>
                </button>

                {/* Tile 2: Add it manually */}
                <button
                  type="button"
                  onClick={() => manualRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="p-4 bg-bright border border-line hover:border-brand text-left space-y-2 cursor-pointer transition-colors group"
                >
                  <div className="w-8 h-8 bg-brand/10 text-brand flex items-center justify-center group-hover:bg-brand group-hover:text-bright transition-colors">
                    <Plus size={16} />
                  </div>
                  <div className="text-xs font-bold text-ink">Add it manually</div>
                  <p className="text-[11px] text-faint leading-relaxed">
                    Type in medication names and instructions.
                  </p>
                </button>

                {/* Tile 3: Import from MyChart */}
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(true)}
                  className="p-4 bg-bright border border-line hover:border-brand text-left space-y-2 cursor-pointer transition-colors group"
                >
                  <div className="w-8 h-8 bg-brand/10 text-brand flex items-center justify-center group-hover:bg-brand group-hover:text-bright transition-colors">
                    <Building size={16} />
                  </div>
                  <div className="text-xs font-bold text-ink">Import from MyChart</div>
                  <p className="text-[11px] text-faint leading-relaxed">
                    Connect health records to pre-fill your card.
                  </p>
                </button>
              </div>
            </div>
          ) : (
            /* Filled State: 3 columns (Medications / Allergies / Conditions) */
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Column 1: Medications */}
                <div className="p-4 bg-bright border border-line space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand pb-2 border-b border-line">
                    <Pill size={14} />
                    <span>Medications</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {card.medications && card.medications.length > 0 ? (
                      card.medications.map((m, idx) => (
                        <div key={idx} className="p-2 bg-surface border border-line/60 font-medium text-ink">
                          {m}
                        </div>
                      ))
                    ) : (
                      <div className="text-faint italic text-xs py-2">Nothing on file yet</div>
                    )}
                  </div>
                </div>

                {/* Column 2: Allergies */}
                <div className="p-4 bg-bright border border-line space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-danger pb-2 border-b border-line">
                    <ShieldAlert size={14} />
                    <span>Allergies</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {card.allergies && card.allergies.length > 0 ? (
                      card.allergies.map((a, idx) => (
                        <div key={idx} className="p-2 bg-danger/5 border border-danger/20 font-bold text-danger">
                          {a}
                        </div>
                      ))
                    ) : (
                      <div className="text-faint italic text-xs py-2">Nothing on file yet</div>
                    )}
                  </div>
                </div>

                {/* Column 3: Conditions */}
                <div className="p-4 bg-bright border border-line space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-caution pb-2 border-b border-line">
                    <Heart size={14} />
                    <span>Conditions</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {card.conditions && card.conditions.length > 0 ? (
                      card.conditions.map((c, idx) => (
                        <div key={idx} className="p-2 bg-surface border border-line/60 font-medium text-ink">
                          {c}
                        </div>
                      ))
                    ) : (
                      <div className="text-faint italic text-xs py-2">Nothing on file yet</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Updated Date and Clear saved data */}
              <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
                <span className="text-faint">Updated {card.lastUpdated || 'Today'}</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-faint hover:text-danger font-semibold cursor-pointer transition-colors"
                >
                  Clear saved data
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION (b): Import from your health record */}
        <div className="bg-panel border border-line p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Building size={16} className="text-brand" />
              <span>Import from your health record</span>
            </h2>
            <p className="text-xs text-body">
              Connect your Epic MyChart to pre-fill your medications, allergies, and conditions — they land on this card automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsConnectModalOpen(true)}
            className="px-4 py-2.5 bg-ink hover:bg-hover-grad text-bright text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Building size={14} />
            <span>Import from Epic MyChart</span>
          </button>
        </div>

        {/* SECTION (c): Scan a pill bottle */}
        <div ref={scanRef} className="bg-panel border border-line p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Camera size={16} className="text-brand" />
              <span>Scan a pill bottle</span>
            </h2>
            <p className="text-xs text-body">
              Upload a photo of a pill bottle label. Overture reads the medication name, dosage, and instructions so you can confirm and save them to your MedCard.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageUpload}
            className="hidden"
          />

          {scanState === 'idle' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-line bg-bright p-8 text-center space-y-2 hover:bg-panel cursor-pointer transition-colors"
            >
              <Upload size={24} className="mx-auto text-faint" />
              <div className="text-xs font-bold text-ink">Take photo or choose image</div>
              <p className="text-[11px] text-faint">
                Camera opens on mobile · JPEG, PNG, HEIC supported
              </p>
            </div>
          )}

          {scanState === 'loading' && (
            <div className="p-8 bg-bright border border-line text-center space-y-3">
              <Spinner size="md" />
              <p className="text-xs font-bold text-body">Reading label…</p>
            </div>
          )}

          {scanState === 'no_key' && (
            <div className="p-4 bg-caution/10 border-l-4 border-l-caution text-xs space-y-1">
              <div className="font-bold text-caution">Scanner needs a Gemini key</div>
              <p className="text-body">
                Label scanning uses Gemini vision, which isn't configured yet. You can still add medications manually below.
              </p>
            </div>
          )}

          {scanState === 'confirm' && (
            <div className="p-4 bg-bright border border-line space-y-3">
              <div className="text-xs font-bold text-ink">Confirm medication details</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-faint block">Medication name</label>
                  <input
                    type="text"
                    value={scanEditName}
                    onChange={(e) => setScanEditName(e.target.value)}
                    className="w-full text-xs font-bold text-ink p-2 border border-line bg-panel outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-faint block">Dosage</label>
                  <input
                    type="text"
                    value={scanEditDosage}
                    onChange={(e) => setScanEditDosage(e.target.value)}
                    className="w-full text-xs text-ink p-2 border border-line bg-panel outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-faint block">Frequency</label>
                  <input
                    type="text"
                    value={scanEditFreq}
                    onChange={(e) => setScanEditFreq(e.target.value)}
                    className="w-full text-xs text-ink p-2 border border-line bg-panel outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setScanState('idle')}
                  className="px-3 py-1.5 border border-line text-xs font-semibold hover:bg-panel cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmScan}
                  className="px-4 py-1.5 bg-ink text-bright text-xs font-bold hover:bg-hover-grad cursor-pointer"
                >
                  Add to MedCard
                </button>
              </div>
            </div>
          )}

          {scanState === 'saved' && (
            <div className="p-4 bg-positive/10 border-l-4 border-l-positive space-y-2">
              <div className="text-xs font-bold text-positive flex items-center gap-1.5">
                <Check size={16} /> Added to your MedCard
              </div>
              <p className="text-xs text-body">
                Saved automatically — the label was read with high confidence.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleUndoAutosave}
                  className="px-3 py-1 border border-line text-xs font-semibold hover:bg-panel cursor-pointer"
                >
                  Undo & edit
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 bg-ink text-bright text-xs font-bold cursor-pointer"
                >
                  Scan another bottle
                </button>
              </div>
            </div>
          )}

          <div className="text-[11px] text-faint pt-1">
            Privacy: Your photo is sent to Gemini for one-time label extraction and is not stored. Only the extracted text is saved locally.
          </div>
        </div>

        {/* SECTION (d): Describe by voice */}
        <div ref={voiceRef} className="bg-panel border border-line p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Mic size={16} className="text-brand" />
              <span>Describe by voice</span>
            </h2>
            <p className="text-xs text-body">
              Speak your medication list naturally. Overture extracts each prescription name and dosage.
            </p>
          </div>

          {voiceError && (
            <div className="p-3 bg-danger/10 border-l-4 border-l-danger text-xs text-danger">
              {voiceError}
            </div>
          )}

          {voiceState === 'unsupported' && (
            <div className="p-4 bg-caution/10 border-l-4 border-l-caution text-xs text-caution">
              Voice input is not supported in this browser.
            </div>
          )}

          {voiceState === 'idle' && (
            <div className="flex items-center gap-4 p-4 bg-bright border border-line">
              <button
                type="button"
                onClick={startListening}
                className="w-12 h-12 bg-ink hover:bg-hover-grad text-bright rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                title="Tap to start speaking"
              >
                <Mic size={20} />
              </button>
              <div>
                <div className="text-xs font-bold text-ink">Tap to start speaking</div>
                <div className="text-[11px] text-faint">Web speech recognition stream</div>
              </div>
            </div>
          )}

          {voiceState === 'listening' && (
            <div className="p-4 bg-bright border border-brand space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-brand">
                  <span className="w-2 h-2 bg-brand animate-ping" />
                  <span>Listening — tap to stop</span>
                </div>
                <button
                  type="button"
                  onClick={stopListening}
                  className="px-3 py-1 bg-danger text-bright text-xs font-bold cursor-pointer"
                >
                  Stop
                </button>
              </div>
              <p className="text-xs text-ink min-h-12 p-2 bg-panel border border-line">
                {voiceTranscript || 'Listening…'}
              </p>
            </div>
          )}

          {voiceState === 'review' && (
            <div className="space-y-3 p-4 bg-bright border border-line">
              <label className="text-xs font-bold text-ink block">
                Your description — edit if needed
              </label>
              <textarea
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                rows={3}
                className="w-full text-xs text-ink p-2 border border-line bg-panel outline-none"
              />
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setVoiceState('idle');
                    setVoiceTranscript('');
                  }}
                  className="px-3 py-1.5 border border-line text-xs font-semibold hover:bg-panel cursor-pointer"
                >
                  Start over
                </button>
                <button
                  type="button"
                  onClick={startListening}
                  className="px-3 py-1.5 border border-line text-xs font-semibold hover:bg-panel cursor-pointer"
                >
                  Keep talking
                </button>
                <button
                  type="button"
                  onClick={handleExtractFromVoice}
                  className="px-4 py-1.5 bg-ink text-bright text-xs font-bold hover:bg-hover-grad cursor-pointer"
                >
                  Extract medications
                </button>
              </div>
            </div>
          )}

          {voiceState === 'extracting' && (
            <div className="p-6 bg-bright border border-line text-center space-y-2">
              <Spinner size="sm" />
              <p className="text-xs text-body font-bold">Extracting medications…</p>
            </div>
          )}

          {voiceState === 'confirm' && (
            <div className="p-4 bg-bright border border-line space-y-3">
              <div className="text-xs font-bold text-ink">
                Found {extractedMeds.length} medication(s). Review, correct, or remove before saving.
              </div>
              <div className="space-y-2">
                {extractedMeds.map((med, idx) => (
                  <div key={idx} className="p-2.5 bg-panel border border-line grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={med.medicationName}
                      onChange={(e) => {
                        const copy = [...extractedMeds];
                        copy[idx].medicationName = e.target.value;
                        setExtractedMeds(copy);
                      }}
                      placeholder="Medication"
                      className="text-xs font-bold text-ink p-1 bg-bright border border-line"
                    />
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => {
                        const copy = [...extractedMeds];
                        copy[idx].dosage = e.target.value;
                        setExtractedMeds(copy);
                      }}
                      placeholder="Dosage"
                      className="text-xs text-ink p-1 bg-bright border border-line"
                    />
                    <input
                      type="text"
                      value={med.frequency}
                      onChange={(e) => {
                        const copy = [...extractedMeds];
                        copy[idx].frequency = e.target.value;
                        setExtractedMeds(copy);
                      }}
                      placeholder="Frequency"
                      className="text-xs text-ink p-1 bg-bright border border-line"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoiceState('idle')}
                  className="px-3 py-1.5 border border-line text-xs font-semibold hover:bg-panel cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveExtractedMeds}
                  className="px-4 py-1.5 bg-positive text-bright text-xs font-bold hover:bg-positive/90 cursor-pointer"
                >
                  Add {extractedMeds.length} to MedCard
                </button>
              </div>
            </div>
          )}

          {voiceState === 'saved' && (
            <div className="p-4 bg-positive/10 border-l-4 border-l-positive flex items-center justify-between text-xs">
              <span className="font-bold text-positive">Added to your MedCard</span>
              <button
                type="button"
                onClick={() => setVoiceState('idle')}
                className="px-3 py-1 bg-ink text-bright text-xs font-bold cursor-pointer"
              >
                Add more
              </button>
            </div>
          )}
        </div>

        {/* SECTION (e): Add a medication manually */}
        <div ref={manualRef} className="bg-panel border border-line p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Plus size={16} className="text-brand" />
              <span>Add a medication manually</span>
            </h2>
            <p className="text-xs text-body">
              No camera or photo handy? Type in a medication and it's saved to your MedCard right away — no account, no keys, stored only in this browser.
            </p>
          </div>

          {manualSuccessMsg && (
            <div className="p-3 bg-positive/10 border-l-4 border-l-positive text-xs text-positive font-semibold">
              ✓ {manualSuccessMsg}
            </div>
          )}

          <form onSubmit={handleManualAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-faint block mb-1">Medication name *</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Lisinopril"
                  className="w-full text-xs font-medium text-ink p-2.5 border border-line bg-bright outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[11px] text-faint block mb-1">Dosage (optional)</label>
                <input
                  type="text"
                  value={manualDosage}
                  onChange={(e) => setManualDosage(e.target.value)}
                  placeholder="e.g. 10mg"
                  className="w-full text-xs font-medium text-ink p-2.5 border border-line bg-bright outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[11px] text-faint block mb-1">Frequency / instructions (optional)</label>
                <input
                  type="text"
                  value={manualFrequency}
                  onChange={(e) => setManualFrequency(e.target.value)}
                  placeholder="e.g. Once daily in the morning"
                  className="w-full text-xs font-medium text-ink p-2.5 border border-line bg-bright outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Btn
                variant="primary"
                icon={Plus}
                className="w-full sm:w-auto"
              >
                Add to MedCard
              </Btn>
            </div>
          </form>
        </div>

        {/* SECTION (f): Clinical trials */}
        <div className="bg-panel border border-line p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <Sparkles size={16} className="text-brand" />
                <span>Clinical trials</span>
              </h2>
              <p className="text-xs text-body">
                Scan your MedCard and imported chart for research studies you may be eligible for.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCheckTrials}
              disabled={trialLoading}
              className="px-4 py-2 bg-ink hover:bg-hover-grad text-bright text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {trialLoading ? (
                <>
                  <Spinner size="sm" />
                  <span>Matching trials…</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Check trial eligibility</span>
                </>
              )}
            </button>
          </div>

          {trials !== null && (
            <div className="space-y-3 pt-2 border-t border-line">
              {trials.length === 0 ? (
                <p className="text-xs text-faint italic py-2">
                  No potential matches found from your current card. Adding medications or conditions may surface more.
                </p>
              ) : (
                <div className="space-y-3">
                  {trials.map((tr, idx) => (
                    <div key={idx} className="p-4 bg-bright border border-line space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-xs font-bold text-ink leading-snug">{tr.title}</h3>
                        <a
                          href={tr.search_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <span>View on ClinicalTrials.gov</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      <p className="text-xs text-body">{tr.why_eligible}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-[11px] text-faint italic pt-1">
                Potential matches only — eligibility is determined by the trial team and your provider. Not medical advice.
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Connect Records Modal */}
      <ConnectRecordsModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  );
}
