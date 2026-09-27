import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Check,
  AlertTriangle,
  FileText,
  Shield,
  Clock,
  Sparkles,
  HelpCircle,
  CheckSquare,
  Volume2,
  Calendar,
  Activity,
  Target,
  Edit3,
  Stethoscope,
  Info,
} from 'lucide-react';
import { Note, RiskLevel, PatientRow, ResearchResult, CareOption } from '../types';
import { getNote, updateNote, getTranscript, listPatientRows, getPatient } from '../services/recordStore';
import { runDeepResearch } from '../services/research';
import { Nav, StatusChip, RiskBadge, Spinner, Btn } from '../components/primitives';
import { CoverageBot } from '../components/CoverageBot';

export function NoteReviewPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const [pastVisits, setPastVisits] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Transcript State
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);

  // Deep Research State
  const [researchState, setResearchState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);

  useEffect(() => {
    async function load() {
      if (!noteId) return;
      try {
        const data = await getNote(noteId);
        setNote(data);

        if (data) {
          // Initialize edit text
          const defaultEdit =
            data.provider_edited_note ||
            `AI Draft — Provider Review Required\n\nPatient Summary:\n${data.ai_summary || ''}\n\nChief Concern:\n${data.chief_concern || ''}\n\nPatient-Reported Symptoms:\n${(data.symptoms_reported || []).map((s) => `- ${s}`).join('\n')}\n\nSOAP Note Draft:\nSubjective:\n${data.soap_subjective || ''}\n\nObjective:\n${data.soap_objective || ''}\n\nAssessment:\n${data.soap_assessment || ''}\n\nPlan:\n${data.soap_plan || ''}`;
          setEditedText(defaultEdit);

          // Fetch patient name & past visits
          if (data.patient_id) {
            const pat = await getPatient(data.patient_id);
            if (pat) {
              setPatient(pat);
              const allRows = await listPatientRows();
              const otherVisits = allRows.filter(
                (r) =>
                  r.name.toLowerCase() === pat.name.toLowerCase() &&
                  r.note_id &&
                  r.note_id !== data.id,
              );
              otherVisits.sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA;
              });
              setPastVisits(otherVisits);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load note:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [noteId]);

  const handleRiskOverride = async (riskLevel: RiskLevel) => {
    if (!note) return;
    setIsSaving(true);
    try {
      const updated = await updateNote(note.id, {
        riskLevel,
        providerEditedNote: note.provider_edited_note || editedText,
      });
      setNote({ ...updated });
    } catch (err) {
      console.error('Failed to update risk:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!note) return;
    setIsSaving(true);
    try {
      const updated = await updateNote(note.id, {
        status: 'reviewed',
        providerEditedNote: editedText,
        reviewed_at: new Date().toISOString(),
      });
      setNote({ ...updated });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to approve note:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTranscript = async () => {
    if (!showTranscript && note && !transcriptText) {
      const t = await getTranscript(note.call_id);
      setTranscriptText(t || 'Transcript not available.');
    }
    setShowTranscript((prev) => !prev);
  };

  const handleRunResearch = async () => {
    if (!note) return;
    setResearchState('loading');
    try {
      const res = await runDeepResearch({
        chiefConcern: note.chief_concern || '',
        symptoms: note.symptoms_reported || [],
        patientGoals: note.patient_goals || [],
        riskFlags: note.risk_flags || [],
        recommendedCareLevel: note.care_recommendation?.care_level,
        coverage: note.coverage || null,
      });
      setResearchResult(res);
      setResearchState('done');
    } catch (err) {
      console.error('Failed to run research:', err);
      setResearchState('error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <Nav variant="provider" />
        <div className="flex-1 flex flex-col items-center justify-center space-y-3">
          <Spinner size="lg" />
          <span className="text-sm font-semibold text-faint">Loading note…</span>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <Nav variant="provider" />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <h2 className="text-xl font-bold text-ink">Note not found</h2>
          <Link
            to="/dashboard"
            className="text-sm font-bold text-brand hover:underline inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={16} /> Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const riskTopBorder =
    note.risk_level === 'high'
      ? 'border-t-4 border-t-danger'
      : note.risk_level === 'medium'
      ? 'border-t-4 border-t-caution'
      : 'border-t-4 border-t-brand';

  const formatVisitDate = (isoStr?: string) => {
    if (!isoStr) return 'Recent visit';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recent visit';
    }
  };

  const recLevel = note.care_recommendation?.care_level || 'primary_care';

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Nav
        variant="provider"
        rightSlot={
          <div className="flex items-center gap-4 text-xs font-semibold">
            {note.patient_id && (
              <Link
                to={`/dashboard/patient/${note.patient_id}`}
                className="flex items-center gap-1.5 text-body hover:text-ink"
              >
                <User size={14} />
                <span>Patient chart</span>
              </Link>
            )}
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-body hover:text-ink pl-3 border-l border-line"
            >
              <ArrowLeft size={14} />
              <span>Dashboard</span>
            </Link>
          </div>
        }
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6">
        <div className={`bg-panel border border-line p-6 sm:p-8 space-y-6 ${riskTopBorder}`}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-body">Risk override</span>
                <div className="flex gap-1.5">
                  {(['none', 'low', 'medium', 'high'] as RiskLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => handleRiskOverride(level)}
                      disabled={isSaving}
                      className={`px-2 py-0.5 text-xs font-bold transition-all cursor-pointer ${
                        note.risk_level === level
                          ? level === 'high'
                            ? 'bg-danger text-bright ring-2 ring-danger/40'
                            : level === 'medium'
                            ? 'bg-caution text-bright ring-2 ring-caution/40'
                            : level === 'low'
                            ? 'bg-brand text-bright ring-2 ring-brand/40'
                            : 'bg-ink text-bright ring-2 ring-ink/40'
                          : 'border border-line text-faint hover:text-ink'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-ink mt-2">
                {patient?.name ? `${patient.name} · Intake note` : 'Intake note'}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-body pt-1">
                <span className="flex items-center gap-1">
                  <FileText size={13} className="text-faint" /> AI-drafted intake note
                </span>
                <span className="flex items-center gap-1 text-faint">
                  <Clock size={13} /> Generated {note.created_at ? new Date(note.created_at).toLocaleString() : ''}
                </span>
                {note.status === 'reviewed' && (
                  <span className="flex items-center gap-1 text-positive font-bold">
                    <Check size={13} /> Reviewed {note.reviewed_at ? formatVisitDate(note.reviewed_at) : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusChip status={note.status} />

              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 border border-line text-xs font-bold hover:bg-bright text-ink cursor-pointer"
              >
                {isEditing ? 'Cancel' : 'Edit note'}
              </button>

              <button
                onClick={handleApprove}
                disabled={isSaving}
                className="px-4 py-2 bg-positive hover:bg-positive/90 text-bright text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={14} />
                <span>{note.status === 'reviewed' ? 'Re-approve' : 'Approve note'}</span>
              </button>
            </div>
          </div>

          {/* AI Disclaimer Strip */}
          <div className="p-3 bg-caution/10 border-l-4 border-l-caution text-xs text-ink flex items-center gap-2">
            <AlertTriangle size={15} className="text-caution shrink-0" />
            <span>AI-generated draft — review and edit before clinical use.</span>
          </div>

          {/* Row 1: Summary / Chief Concern */}
          <div className="flex gap-4 pb-6 border-b border-line">
            <div className="w-13 h-13 shrink-0 bg-brand/10 text-brand flex items-center justify-center">
              <FileText size={22} />
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="text-xs font-semibold text-body">Chief concern</div>
              <div className="text-xl font-black text-ink">{note.chief_concern || 'Not specified'}</div>
              <p className="text-xs text-body leading-relaxed pt-1">{note.ai_summary}</p>
            </div>
          </div>

          {/* Row 2: Risk Flags */}
          <div className="flex gap-4 pb-6 border-b border-line">
            <div className="w-13 h-13 shrink-0 bg-caution/10 text-caution flex items-center justify-center">
              <AlertTriangle size={22} />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="text-xs font-semibold text-body">Risk flags</div>
              {note.risk_flags && note.risk_flags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {note.risk_flags.map((f, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs bg-caution/15 text-caution font-semibold">
                      ⚠ {f}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs italic text-faint">No specific risk flags identified from intake.</span>
              )}
            </div>
          </div>

          {/* Row 3: Care & Coverage */}
          {(note.care_recommendation || note.coverage) && (
            <div className="flex gap-4 pb-6 border-b border-line">
              <div className="w-13 h-13 shrink-0 bg-brand/10 text-brand flex items-center justify-center">
                <Shield size={22} />
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                {/* Suggested Care Level */}
                {note.care_recommendation && (
                  <div className="bg-bright border border-line p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-body">Suggested care level</span>
                      <span className="text-faint">{Math.round((note.care_recommendation.confidence || 0.8) * 100)}% confidence</span>
                    </div>
                    <div className="text-lg font-black text-ink">
                      {note.care_recommendation.care_level.replace('_', ' ')}
                    </div>
                    <p className="text-xs text-body leading-relaxed">
                      {note.care_recommendation.reasoning}
                    </p>
                    {note.care_recommendation.red_flags_to_watch?.length > 0 && (
                      <div className="pt-2 border-t border-line text-xs">
                        <span className="font-bold text-danger">Escalate if:</span>
                        <ul className="list-disc pl-4 text-danger/90 mt-1 space-y-0.5">
                          {note.care_recommendation.red_flags_to_watch.map((rf, i) => (
                            <li key={i}>{rf}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Coverage */}
                {note.coverage && (
                  <div className="bg-brand text-bright p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-bright/70">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Shield size={14} /> Coverage and cost
                      </span>
                      <span className="border border-bright/30 px-1.5 py-0.5 text-[11px]">
                        Synthetic estimate
                      </span>
                    </div>
                    <div className="text-base font-black">{note.coverage.payer}</div>
                    <div className="text-xs text-bright/80">✓ {note.coverage.plan_status}</div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-bright/20">
                      <div>
                        <span className="text-xs text-bright/70 block">Copay</span>
                        <span className="text-xl font-light font-numeral">
                          {note.coverage.copay !== null && note.coverage.copay !== undefined
                            ? `$${note.coverage.copay}`
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-bright/70 block">Deductible</span>
                        <span className="text-xl font-light font-numeral">
                          {note.coverage.deductible_remaining !== undefined
                            ? `$${note.coverage.deductible_remaining}`
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-bright/70 block">Visit</span>
                        <span className="text-xl font-light font-numeral">
                          ${note.coverage.estimated_visit_cost?.min}–${note.coverage.estimated_visit_cost?.max}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs italic text-bright/80 pt-1 leading-snug">
                      "{note.coverage.spoken_summary}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 4: Visits (Past Visits for same patient) */}
          <div className="flex gap-4 pb-6 border-b border-line">
            <div className="w-13 h-13 shrink-0 bg-ink/5 text-ink flex items-center justify-center">
              <Calendar size={22} />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="text-xs font-semibold text-body">Prior visits on record</div>
              {pastVisits.length > 0 ? (
                <div className="divide-y divide-line border border-line bg-bright">
                  {pastVisits.map((v) => (
                    <div key={v.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-ink">{formatVisitDate(v.created_at)}</span>
                        <span className="text-faint">{v.appointment_type || 'Intake visit'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {v.risk_level && <RiskBadge level={v.risk_level} />}
                        {v.note_status && <StatusChip status={v.note_status} />}
                        {v.note_id && (
                          <Link
                            to={`/dashboard/note/${v.note_id}`}
                            className="font-bold text-brand hover:underline ml-1"
                          >
                            Open note &rarr;
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-faint">First visit on record.</p>
              )}
            </div>
          </div>

          {/* Row 5: Reported (Symptoms & Goals Grid) */}
          <div className="flex gap-4 pb-6 border-b border-line">
            <div className="w-13 h-13 shrink-0 bg-brand/10 text-brand flex items-center justify-center">
              <Activity size={22} />
            </div>
            <div className="flex-1 space-y-4 min-w-0">
              {/* Reported Symptoms */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-body">Patient-reported symptoms</div>
                {note.symptoms_reported && note.symptoms_reported.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
                    {note.symptoms_reported.map((symp, idx) => (
                      <div key={idx} className="bg-panel p-3 flex items-start gap-2.5">
                        <Activity size={15} className="text-brand shrink-0 mt-0.5" />
                        <span className="text-xs text-ink font-medium leading-snug">{symp}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs italic text-faint">
                    Not enough information was provided during intake.
                  </span>
                )}
              </div>

              {/* Patient Goals */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-body">Patient goals</div>
                {note.patient_goals && note.patient_goals.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
                    {note.patient_goals.map((goal, idx) => (
                      <div key={idx} className="bg-panel p-3 flex items-start gap-2.5">
                        <Check size={15} className="text-positive shrink-0 mt-0.5" />
                        <span className="text-xs text-ink font-medium leading-snug">{goal}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs italic text-faint">
                    Not enough information was provided during intake.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row 6: Deep Research (ResearchPanel) */}
          <div className="flex gap-4 pb-6 border-b border-line">
            <div className="w-13 h-13 shrink-0 bg-brand/10 text-brand flex items-center justify-center">
              <Sparkles size={22} />
            </div>
            <div className="flex-1 space-y-4 min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-body">Deep research draft</div>
              </div>

              {/* Care Level Spectrum (Always Shown) */}
              <div className="bg-bright border border-line p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-body">Care level spectrum</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {note.risk_flags && note.risk_flags.length > 0 ? (
                      note.risk_flags.slice(0, 2).map((rf, i) => (
                        <span key={i} className="px-2 py-0.5 text-[11px] bg-caution/15 text-caution font-medium">
                          {rf}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-0.5 text-[11px] bg-ink/5 text-faint font-medium">
                        No acute risk signals
                      </span>
                    )}
                  </div>
                </div>

                {/* 5-bar spectrum */}
                <div className="grid grid-cols-5 gap-2 items-end pt-2 h-24 border-b border-line pb-3">
                  {[
                    { id: 'self_monitor', label: 'Self-monitor' },
                    { id: 'telehealth', label: 'Telehealth' },
                    { id: 'primary_care', label: 'Primary care' },
                    { id: 'urgent_care', label: 'Urgent care' },
                    { id: 'emergency_room', label: 'Emergency room' },
                  ].map((level) => {
                    const isRec =
                      recLevel === level.id ||
                      (recLevel === 'self_care' && level.id === 'self_monitor');
                    const barHeight = isRec ? 'h-16' : 'h-8';
                    const barBg = isRec ? 'bg-brand' : 'bg-line';
                    const textWeight = isRec ? 'font-bold text-brand' : 'font-medium text-faint';

                    return (
                      <div key={level.id} className="flex flex-col items-center justify-end h-full">
                        {isRec && (
                          <span className="text-[10px] font-bold text-brand mb-1">
                            Recommended
                          </span>
                        )}
                        <div className={`w-full ${barHeight} ${barBg} transition-all duration-300`} />
                        <span className={`text-[11px] ${textWeight} text-center mt-1 leading-tight`}>
                          {level.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Research States */}
              {researchState === 'idle' && (
                <div className="p-4 bg-panel border border-line text-xs text-body flex items-center justify-between gap-4">
                  <p>
                    Generate a research draft for this visit: what the symptoms could involve, care options with estimated costs, and questions to ask. We only run this when you ask.
                  </p>
                  <Btn
                    variant="secondary"
                    onClick={handleRunResearch}
                    icon={Sparkles}
                    className="shrink-0 py-2 px-4 text-xs"
                  >
                    Run Deep Research
                  </Btn>
                </div>
              )}

              {researchState === 'loading' && (
                <div className="p-6 bg-bright border border-line flex items-center justify-center gap-3 text-xs text-body">
                  <Spinner size="sm" />
                  <span>Researching these symptoms…</span>
                </div>
              )}

              {researchState === 'error' && (
                <div className="p-4 bg-danger/10 border-l-4 border-l-danger flex items-center justify-between text-xs text-danger">
                  <span>Couldn't run research right now. Your provider review is unaffected.</span>
                  <button
                    onClick={handleRunResearch}
                    className="font-bold underline hover:text-danger/80 cursor-pointer ml-3"
                  >
                    Try again
                  </button>
                </div>
              )}

              {researchState === 'done' && researchResult && (
                <div className="space-y-4 pt-2">
                  {/* What this could involve */}
                  <div className="p-4 bg-bright border border-line space-y-1.5">
                    <div className="text-xs font-semibold text-body">What this could involve</div>
                    <p className="text-xs text-body leading-relaxed">
                      {researchResult.patient_explainer}
                    </p>
                  </div>

                  {/* For provider review */}
                  <div className="p-4 bg-panel border border-line space-y-2">
                    <div className="text-xs font-semibold text-body">For provider review</div>
                    <ul className="space-y-1.5 text-xs text-body">
                      {researchResult.provider_considerations.map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-brand mt-1.5 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Care options & estimated cost Table */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-body">Care options and estimated cost</div>
                    <div className="overflow-x-auto border border-line bg-bright">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-line bg-line/20 text-faint">
                            <th className="p-2.5 font-semibold">Option</th>
                            <th className="p-2.5 font-semibold">Fit</th>
                            <th className="p-2.5 font-semibold">Est. cost</th>
                            <th className="p-2.5 font-semibold">Why</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {researchResult.care_options.map((opt, idx) => {
                            const isRec =
                              recLevel === opt.level ||
                              (recLevel === 'self_care' && opt.level === 'self_monitor');

                            const fitBadge =
                              opt.fit === 'high' ? (
                                <span className="px-2 py-0.5 bg-positive/15 text-positive font-bold text-[11px]">
                                  High fit
                                </span>
                              ) : opt.fit === 'medium' ? (
                                <span className="px-2 py-0.5 bg-caution/15 text-caution font-bold text-[11px]">
                                  Medium fit
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-ink/5 text-faint font-medium text-[11px]">
                                  Low fit
                                </span>
                              );

                            const levelLabel = opt.level.replace('_', ' ');

                            return (
                              <tr
                                key={idx}
                                className={isRec ? 'bg-brand-light/40 font-medium' : 'hover:bg-panel'}
                              >
                                <td className="p-2.5 font-bold capitalize text-ink">
                                  <div className="flex items-center gap-1.5">
                                    <span>{levelLabel}</span>
                                    {isRec && (
                                      <span className="px-1.5 py-0.2 bg-brand text-bright text-[10px] font-bold">
                                        Recommended
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2.5">{fitBadge}</td>
                                <td className="p-2.5 font-bold text-ink whitespace-nowrap">
                                  {opt.est_cost}
                                </td>
                                <td className="p-2.5 text-body leading-snug">{opt.why}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Questions to ask your doctor */}
                  <div className="p-4 bg-bright border border-line space-y-2">
                    <div className="text-xs font-semibold text-body">Questions to ask your doctor</div>
                    <ul className="space-y-1.5 text-xs text-body">
                      {researchResult.questions_to_ask.map((q, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-bold text-brand shrink-0">
                            {String(i + 1).padStart(2, '0')}.
                          </span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Red flags to watch */}
                  <div className="p-4 bg-danger/10 border-l-4 border-l-danger space-y-2">
                    <div className="text-xs font-bold text-danger">Red flags to watch</div>
                    <ul className="space-y-1 text-xs text-danger/90">
                      {researchResult.red_flags_to_watch.map((rf, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span>⚠</span>
                          <span>{rf}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Research Footer */}
                  <div className="text-[11px] text-faint italic pt-1">
                    AI-generated research draft — reviewed by your provider. Not medical advice.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 7: SOAP Section */}
          <div className="flex gap-4 pb-6 border-b border-line">
            <div className="w-13 h-13 shrink-0 bg-ink/5 text-ink flex items-center justify-center">
              <Edit3 size={22} />
            </div>
            <div className="flex-1 space-y-4 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-body">SOAP note draft</h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-bold text-brand hover:underline cursor-pointer"
                >
                  {isEditing ? 'Cancel editing' : 'Edit SOAP note'}
                </button>
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    rows={20}
                    className="w-full p-4 font-mono text-xs bg-bright border border-line text-ink outline-none focus:border-brand"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border border-line text-xs font-semibold hover:bg-bright"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={isSaving}
                      className="px-4 py-2 bg-positive text-bright text-xs font-bold hover:bg-positive/90"
                    >
                      Save and approve
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* S */}
                  <div className="p-3.5 bg-bright border border-line">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 bg-brand/10 text-brand font-black text-xs flex items-center justify-center shrink-0">
                        S
                      </div>
                      <span className="text-xs font-bold text-ink">Subjective</span>
                    </div>
                    <p className="text-xs text-body leading-relaxed whitespace-pre-line pl-10">
                      {note.soap_subjective || 'Not available.'}
                    </p>
                  </div>

                  {/* O */}
                  <div className="p-3.5 bg-bright border border-line">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 bg-line text-faint font-black text-xs flex items-center justify-center shrink-0">
                        O
                      </div>
                      <span className="text-xs font-bold text-ink">Objective</span>
                    </div>
                    <p className="text-xs text-body leading-relaxed pl-10">
                      {note.soap_objective || 'Not available.'}
                    </p>
                  </div>

                  {/* A */}
                  <div className="p-3.5 bg-caution/5 border border-caution/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 bg-caution/15 text-caution font-black text-xs flex items-center justify-center shrink-0">
                        A
                      </div>
                      <span className="text-xs font-bold text-ink">Assessment</span>
                    </div>
                    <p className="text-xs text-body leading-relaxed pl-10">
                      {note.soap_assessment || 'Not available.'}
                    </p>
                  </div>

                  {/* P */}
                  <div className="p-3.5 bg-positive/5 border border-positive/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 bg-positive/15 text-positive font-black text-xs flex items-center justify-center shrink-0">
                        P
                      </div>
                      <span className="text-xs font-bold text-ink">Plan</span>
                    </div>
                    <p className="text-xs text-body leading-relaxed pl-10">
                      {note.soap_plan || 'Not available.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 8: Suggested Questions & Follow-ups */}
          <div className="flex gap-4 pb-6 border-b border-line">
            <div className="w-13 h-13 shrink-0 bg-brand/10 text-brand flex items-center justify-center">
              <HelpCircle size={22} />
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-body flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-brand" />
                  <span>Suggested provider questions</span>
                </div>
                <ul className="space-y-1.5 text-xs text-body">
                  {note.suggested_questions?.length ? (
                    note.suggested_questions.map((q, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="font-bold text-brand shrink-0">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <span>{q}</span>
                      </li>
                    ))
                  ) : (
                    <span className="italic text-faint">None provided.</span>
                  )}
                </ul>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-body flex items-center gap-1.5">
                  <CheckSquare size={14} className="text-positive" />
                  <span>Follow-up actions</span>
                </div>
                <ul className="space-y-1.5 text-xs text-body">
                  {note.follow_up_actions?.length ? (
                    note.follow_up_actions.map((act, idx) => (
                      <li key={idx} className="flex gap-2 items-start">
                        <span className="text-positive mt-0.5">&rarr;</span>
                        <span>{act}</span>
                      </li>
                    ))
                  ) : (
                    <span className="italic text-faint">None provided.</span>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Row 9: Full Transcript Block */}
          <div className="flex gap-4">
            <div className="w-13 h-13 shrink-0 bg-ink/5 text-ink flex items-center justify-center">
              <Volume2 size={22} />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-body">Full transcript</span>
                <button
                  onClick={handleToggleTranscript}
                  className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 size={13} />
                  <span>{showTranscript ? 'Hide transcript' : 'Show transcript'}</span>
                </button>
              </div>

              {showTranscript && (
                <pre className="p-4 bg-bright border border-line text-xs font-mono max-h-80 overflow-y-auto whitespace-pre-wrap text-ink">
                  {transcriptText}
                </pre>
              )}
            </div>
          </div>
        </div>
      </main>

      <CoverageBot />
    </div>
  );
}
