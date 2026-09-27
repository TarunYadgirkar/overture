import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { Nav, Btn, Spinner } from '../components/primitives';
import { SymptomEntry } from '../types';
import { addSymptom, listSymptoms, deleteSymptom } from '../services/recordStore';

export function SeverityMark({ severity }: { severity: number }) {
  const sizePx = Math.round(9 + ((severity - 1) / 9) * 17); // 9px at 1 to 26px at 10
  const colorClass =
    severity <= 3 ? 'bg-positive' : severity <= 6 ? 'bg-caution' : 'bg-danger';

  return (
    <div
      className="flex items-center justify-center shrink-0 w-7 h-7"
      aria-label={`Severity ${severity} out of 10`}
      title={`Severity ${severity} out of 10`}
    >
      <div
        className={`${colorClass} transition-all duration-150`}
        style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
      />
    </div>
  );
}

interface DayGroup {
  dayKey: string;
  dayLabel: string;
  items: SymptomEntry[];
}

export function TimelinePage() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState(4);
  const todayStr = new Date().toISOString().split('T')[0];
  const [onset, setOnset] = useState(todayStr);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Deleting item ID confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSymptoms = async (pId: string) => {
    try {
      const list = await listSymptoms(pId);
      // Sort newest first by onset or recorded_at
      list.sort((a, b) => {
        const timeA = new Date(a.onset || a.recorded_at || 0).getTime();
        const timeB = new Date(b.onset || b.recorded_at || 0).getTime();
        return timeB - timeA;
      });
      setSymptoms(list);
    } catch (err) {
      console.error('Failed to load symptoms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedId = localStorage.getItem('overture-patient-id');
    setPatientId(storedId);
    if (storedId) {
      loadSymptoms(storedId);
    } else {
      setLoading(false);
    }
  }, []);

  const handleAddSymptom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !patientId) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const onsetIso = onset ? `${onset}T12:00:00.000Z` : new Date().toISOString();
      await addSymptom(patientId, {
        text: text.trim(),
        severity,
        onset: onsetIso,
        tags: [],
      });

      setText('');
      setSeverity(4);
      setOnset(todayStr);
      await loadSymptoms(patientId);
    } catch (err) {
      console.error('Save symptom error:', err);
      setSaveError('That did not save. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async (symptomId: string) => {
    if (!patientId) return;
    setDeleteError(null);
    setDeletingId(null);

    // Optimistic delete
    const previousSymptoms = [...symptoms];
    setSymptoms((prev) => prev.filter((s) => s.id !== symptomId));

    try {
      await deleteSymptom(symptomId);
    } catch (err) {
      console.error('Delete symptom error:', err);
      // Rollback on error
      setSymptoms(previousSymptoms);
      setDeleteError('That entry could not be deleted. It is still on your timeline.');
    }
  };

  // Group symptoms by date (newest day first)
  const groupedDays: DayGroup[] = [];
  const dayMap = new Map<string, SymptomEntry[]>();

  for (const s of symptoms) {
    const rawDate = (s.onset || s.recorded_at || todayStr).split('T')[0];
    if (!dayMap.has(rawDate)) {
      dayMap.set(rawDate, []);
    }
    dayMap.get(rawDate)!.push(s);
  }

  // Sort day keys descending
  const sortedDayKeys = Array.from(dayMap.keys()).sort((a, b) => (b > a ? 1 : -1));

  for (const dayKey of sortedDayKeys) {
    let dayLabel = dayKey;
    try {
      const d = new Date(dayKey + 'T12:00:00');
      dayLabel = d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    } catch {}

    groupedDays.push({
      dayKey,
      dayLabel,
      items: dayMap.get(dayKey) || [],
    });
  }

  const formatOnsetDetail = (s: SymptomEntry) => {
    try {
      const dateStr = (s.onset || s.recorded_at || '').split('T')[0];
      return dateStr;
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Nav
        rightSlot={
          <Link to="/" className="text-xs font-bold text-ink hover:underline">
            Home
          </Link>
        }
      />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="space-y-1.5">
          <h1 className="text-3xl font-black text-ink">Symptom timeline</h1>
          <p className="text-sm text-body leading-relaxed">
            Log how you feel between visits. Each entry is saved to your medical record, so your doctor sees it and the voice agent can bring it up at your next check-in.
          </p>
        </div>

        {/* No Patient ID State */}
        {!patientId ? (
          <div className="bg-panel border border-line p-8 text-center space-y-4">
            <p className="text-sm text-body">
              Your timeline starts with your first check-in, which creates your record.
            </p>
            <div>
              <Link
                to="/intake"
                className="inline-flex items-center gap-2 px-6 py-3 bg-ink hover:bg-hover-grad text-bright text-xs font-bold transition-colors"
              >
                <span>Start a voice check-in</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Form */}
            <div className="bg-panel border border-line p-6 space-y-5">
              {saveError && (
                <div className="p-3 bg-danger/10 border-l-4 border-l-danger text-xs text-danger">
                  {saveError}
                </div>
              )}

              <form onSubmit={handleAddSymptom} className="space-y-4">
                {/* Field 1: What are you feeling? */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-ink block">
                    What are you feeling?
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={400}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Dull headache behind my right eye"
                    className="w-full text-xs font-medium text-ink p-3 border border-line bg-bright outline-none focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  {/* Field 2: How strong is it? with SeverityMark square */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-ink block">
                      How strong is it?
                    </label>
                    <div className="flex items-center gap-3 p-2 bg-bright border border-line">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={severity}
                        onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                        className="flex-1 accent-brand cursor-pointer"
                        aria-label={`Severity ${severity} out of 10`}
                      />
                      <SeverityMark severity={severity} />
                    </div>
                  </div>

                  {/* Field 3: When did it start? */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-ink block">
                      When did it start?
                    </label>
                    <input
                      type="date"
                      max={todayStr}
                      value={onset}
                      onChange={(e) => setOnset(e.target.value)}
                      className="w-full text-xs text-ink p-2.5 border border-line bg-bright outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Btn
                    variant="primary"
                    loading={isSaving}
                    loadingLabel="Saving…"
                    icon={Plus}
                    className="w-full sm:w-auto"
                  >
                    Add to timeline
                  </Btn>
                </div>
              </form>
            </div>

            {/* Delete Error Notification */}
            {deleteError && (
              <div className="p-3 bg-danger/10 border-l-4 border-l-danger text-xs text-danger">
                {deleteError}
              </div>
            )}

            {/* Logged Symptoms Feed */}
            {loading ? (
              <div className="p-10 text-center space-y-2">
                <Spinner size="md" />
                <p className="text-xs text-faint">Loading symptom history…</p>
              </div>
            ) : symptoms.length === 0 ? (
              <div className="bg-panel border border-line p-8 text-center text-xs text-body">
                Nothing logged yet. Your first entry will appear here with the day it started.
              </div>
            ) : (
              <div className="space-y-6">
                {groupedDays.map((group) => (
                  <div key={group.dayKey} className="space-y-2">
                    {/* Sticky Day Heading */}
                    <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-xs py-1.5 border-b border-line">
                      <h2 className="text-xs font-bold text-body tracking-tight">
                        {group.dayLabel}
                      </h2>
                    </div>

                    {/* Day Rows */}
                    <div className="space-y-2 pt-1">
                      {group.items.map((s) => (
                        <div
                          key={s.id}
                          className="group relative p-3.5 bg-bright border border-line flex items-center justify-between gap-3 hover:border-brand/40 transition-colors"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <SeverityMark severity={s.severity} />
                            <div className="min-w-0 space-y-0.5">
                              <div className="text-xs font-bold text-ink leading-snug">
                                {s.text}
                              </div>
                              <div className="text-[11px] text-faint">
                                Started {formatOnsetDetail(s)}
                              </div>
                            </div>
                          </div>

                          {/* Delete Action with inline confirm */}
                          <div className="shrink-0">
                            {deletingId === s.id ? (
                              <div className="flex items-center gap-1.5 p-1 bg-surface border border-line text-xs">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDelete(s.id)}
                                  className="px-2 py-0.5 bg-danger text-bright text-[11px] font-bold hover:bg-danger/90 cursor-pointer"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingId(null)}
                                  className="px-2 py-0.5 border border-line text-ink text-[11px] font-semibold hover:bg-bright cursor-pointer"
                                >
                                  Keep
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeletingId(s.id)}
                                aria-label="Delete entry"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-faint hover:text-danger hover:bg-surface border border-transparent hover:border-line cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
