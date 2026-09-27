import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  FileText,
  Plus,
  Stethoscope,
  Activity,
  FolderOpen,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Pill,
  Heart,
  Syringe,
  ChevronLeft,
  ChevronRight,
  User,
  Check,
} from 'lucide-react';
import { Note, SymptomEntry, PatientRow, EpicImportState, LabFlag } from '../types';
import {
  getPatient,
  getNoteByPatient,
  listSymptoms,
  listPatientRows,
  listAllergies,
} from '../services/recordStore';
import { Nav, StatusChip, RiskBadge, Spinner, Btn } from '../components/primitives';

export interface ChartEvent {
  id: string;
  type: 'visit' | 'note' | 'coverage' | 'risk' | 'symptom' | 'lab' | 'med' | 'allergy' | 'condition';
  title: string;
  subtitle?: string;
  date: string; // ISO or YYYY-MM-DD
  link?: string;
  badge?: React.ReactNode;
  icon: any;
  colorClass: string;
}

export function PatientChartPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<{ id: string; name: string; age_range?: string; appointment_type?: string; created_at?: string } | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([]);
  const [allergies, setAllergies] = useState<Array<{ substance: string; reaction?: string }>>([]);
  const [matchedImport, setMatchedImport] = useState<EpicImportState | null>(null);
  const [allVisitsCount, setAllVisitsCount] = useState(1);
  const [loading, setLoading] = useState(true);

  // View state: 'timeline' | 'calendar'
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');

  // Filter chips (multi-select)
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['all']);

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!patientId) return;
      try {
        const pat = await getPatient(patientId);
        setPatient(pat);

        const n = await getNoteByPatient(patientId);
        setNote(n);

        const s = await listSymptoms(patientId);
        setSymptoms(s);

        const storedAllergies = await listAllergies(patientId);
        setAllergies(storedAllergies);

        // Check if imported health records match this patient's name
        const rawImport = localStorage.getItem('overture-epic-import');
        if (rawImport && pat) {
          const parsed: EpicImportState = JSON.parse(rawImport);
          if (
            parsed?.record?.patient?.name &&
            parsed.record.patient.name.toLowerCase() === pat.name.toLowerCase()
          ) {
            setMatchedImport(parsed);
          }
        }

        // Count patient rows for visit count
        const allRows = await listPatientRows();
        if (pat) {
          const matching = allRows.filter((r) => r.name.toLowerCase() === pat.name.toLowerCase());
          setAllVisitsCount(Math.max(1, matching.length));
        }
      } catch (err) {
        console.error('Failed to load chart:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId]);

  // Calendar Keyboard Navigation
  useEffect(() => {
    if (viewMode !== 'calendar') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const cur = new Date(selectedDate + 'T12:00:00');
        if (e.key === 'ArrowLeft') cur.setDate(cur.getDate() - 1);
        else if (e.key === 'ArrowRight') cur.setDate(cur.getDate() + 1);
        else if (e.key === 'ArrowUp') cur.setDate(cur.getDate() - 7);
        else if (e.key === 'ArrowDown') cur.setDate(cur.getDate() + 7);

        const newDateStr = cur.toISOString().split('T')[0];
        setSelectedDate(newDateStr);
        setCalendarMonth(new Date(cur.getFullYear(), cur.getMonth(), 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, selectedDate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <Nav variant="provider" />
        <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-6">
          <div className="p-12 bg-panel border border-line flex flex-col items-center justify-center space-y-3">
            <Spinner size="lg" />
            <span className="text-xs font-semibold text-faint">Loading patient chart…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <Nav variant="provider" />
        <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-4">
          <div className="p-12 bg-panel border border-line text-center space-y-3">
            <FolderOpen size={32} className="mx-auto text-faint" />
            <h2 className="text-lg font-bold text-ink">Patient not found</h2>
            <Link
              to="/dashboard"
              className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Compile all chart events
  const events: ChartEvent[] = [];

  // Queue Visit
  if (patient.created_at) {
    events.push({
      id: `queue_${patient.id}`,
      type: 'visit',
      title: `Voice check-in · ${patient.appointment_type || 'Sick visit'}`,
      subtitle: 'Pre-visit intake recorded',
      date: patient.created_at,
      icon: Stethoscope,
      colorClass: 'bg-brand text-bright',
    });
  }

  // Note Event
  if (note) {
    events.push({
      id: `note_${note.id}`,
      type: 'note',
      title: 'AI intake note drafted',
      subtitle: `${note.chief_concern} · ${note.risk_level} risk · ${note.care_recommendation?.care_level?.replace('_', ' ') || 'primary care'}`,
      date: note.created_at || new Date().toISOString(),
      link: `/dashboard/note/${note.id}`,
      badge: <StatusChip status={note.status} />,
      icon: FileText,
      colorClass: 'bg-brand text-bright',
    });

    // Coverage check event if present
    if (note.coverage) {
      events.push({
        id: `cov_${note.id}`,
        type: 'coverage',
        title: `Coverage check — ${note.coverage.payer}`,
        subtitle: `${note.coverage.plan_status} · ${note.coverage.copay !== null && note.coverage.copay !== undefined ? `$${note.coverage.copay} copay` : `$${note.coverage.estimated_visit_cost.min}–$${note.coverage.estimated_visit_cost.max}`}`,
        date: note.created_at || new Date().toISOString(),
        icon: Shield,
        colorClass: 'bg-brand text-bright',
      });
    }

    // Risk event if flagged
    if (note.risk_level === 'high' || note.risk_level === 'medium') {
      events.push({
        id: `risk_${note.id}`,
        type: 'risk',
        title: `Risk flagged — ${note.risk_level} risk`,
        subtitle: note.risk_flags.join(', ') || 'Clinical attention flagged during check-in',
        date: note.created_at || new Date().toISOString(),
        icon: AlertTriangle,
        colorClass: note.risk_level === 'high' ? 'bg-danger text-bright' : 'bg-caution text-bright',
      });
    }
  }

  // Logged Symptoms
  for (const symp of symptoms) {
    events.push({
      id: `symp_${symp.id}`,
      type: 'symptom',
      title: `Logged symptom: ${symp.text}`,
      subtitle: `Severity ${symp.severity}/10 · Onset ${symp.onset.split('T')[0]}`,
      date: symp.onset,
      icon: Activity,
      colorClass: symp.severity >= 7 ? 'bg-danger text-bright' : symp.severity >= 4 ? 'bg-caution text-bright' : 'bg-positive text-bright',
    });
  }

  // Name-matched imported chart events
  if (matchedImport) {
    // Encounters
    for (let i = 0; i < matchedImport.record.recentEncounters.length; i++) {
      const enc = matchedImport.record.recentEncounters[i];
      events.push({
        id: `imp_enc_${i}`,
        type: 'visit',
        title: `Past visit · ${enc.type}`,
        subtitle: `${enc.provider} · ${enc.facility}`,
        date: `${enc.date}T10:00:00.000Z`,
        icon: CalendarIcon,
        colorClass: 'bg-ink text-bright',
      });
    }

    // Labs
    for (let i = 0; i < matchedImport.record.labResults.length; i++) {
      const lab = matchedImport.record.labResults[i];
      events.push({
        id: `imp_lab_${i}`,
        type: 'lab',
        title: `Test result: ${lab.name} — ${lab.value}`,
        subtitle: lab.reference,
        date: `${lab.date}T09:00:00.000Z`,
        icon: Activity,
        colorClass: lab.flag === 'HIGH' || lab.flag === 'LOW' ? 'bg-danger text-bright' : 'bg-positive text-bright',
      });
    }

    // Medications
    for (let i = 0; i < matchedImport.record.medications.length; i++) {
      const med = matchedImport.record.medications[i];
      events.push({
        id: `imp_med_${i}`,
        type: 'med',
        title: `Started ${med.name}`,
        subtitle: `${med.frequency} — prescribed by ${med.prescriber}`,
        date: `${med.started}-01T08:00:00.000Z`,
        icon: Pill,
        colorClass: 'bg-brand text-bright',
      });
    }

    // Conditions
    for (let i = 0; i < matchedImport.record.conditions.length; i++) {
      const cond = matchedImport.record.conditions[i];
      events.push({
        id: `imp_cond_${i}`,
        type: 'condition',
        title: `Diagnosed: ${cond.name}`,
        subtitle: `ICD-10 ${cond.icd10} · Status: ${cond.status}`,
        date: `${cond.diagnosed}-01T08:00:00.000Z`,
        icon: Heart,
        colorClass: 'bg-caution text-bright',
      });
    }
  }

  // Sort events chronologically descending
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter events
  const filterTypes = {
    visits: 'visit',
    notes: 'note',
    labs: 'lab',
    meds: 'med',
    allergies: 'allergy',
    conditions: 'condition',
    coverage: 'coverage',
    symptoms: 'symptom',
  };

  const isFilterActive = (filterKey: string) => selectedFilters.includes(filterKey);

  const toggleFilter = (filterKey: string) => {
    if (filterKey === 'all') {
      setSelectedFilters(['all']);
      return;
    }
    const withoutAll = selectedFilters.filter((f) => f !== 'all');
    if (withoutAll.includes(filterKey)) {
      const next = withoutAll.filter((f) => f !== filterKey);
      setSelectedFilters(next.length === 0 ? ['all'] : next);
    } else {
      setSelectedFilters([...withoutAll, filterKey]);
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (selectedFilters.includes('all')) return true;
    return selectedFilters.some((f) => (filterTypes as any)[f] === ev.type);
  });

  // Group filtered events into Timeline sections ("Today · Mon D YYYY", "{Month YYYY}", "Earlier")
  const todayYMD = new Date().toISOString().split('T')[0];
  const timelineGroups: Array<{ label: string; events: ChartEvent[] }> = [];

  const todayEvents = filteredEvents.filter((e) => e.date.startsWith(todayYMD));
  if (todayEvents.length > 0) {
    const label = `Today · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    timelineGroups.push({ label, events: todayEvents });
  }

  const nonTodayEvents = filteredEvents.filter((e) => !e.date.startsWith(todayYMD));
  const monthBuckets: Record<string, ChartEvent[]> = {};

  for (const ev of nonTodayEvents) {
    try {
      const d = new Date(ev.date);
      const mLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!monthBuckets[mLabel]) monthBuckets[mLabel] = [];
      monthBuckets[mLabel].push(ev);
    } catch {
      if (!monthBuckets['Earlier']) monthBuckets['Earlier'] = [];
      monthBuckets['Earlier'].push(ev);
    }
  }

  for (const [mLabel, mEvents] of Object.entries(monthBuckets)) {
    timelineGroups.push({ label: mLabel, events: mEvents });
  }

  // Active allergy list for banners (only matching patient or stored)
  const activeAllergies = [
    ...allergies,
    ...(matchedImport?.record.allergies || []).map((a) => ({
      substance: a.substance,
      reaction: a.reaction,
    })),
  ];

  // Format last seen
  const lastSeenDate = patient.created_at
    ? new Date(patient.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Today';

  // Calendar Helpers
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = Sun

  const daysGrid: Array<{ dateStr: string; dayNum: number; inMonth: boolean }> = [];
  // Leading days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const dateStr = new Date(year, month - 1, d).toISOString().split('T')[0];
    daysGrid.push({ dateStr, dayNum: d, inMonth: false });
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = new Date(year, month, d).toISOString().split('T')[0];
    daysGrid.push({ dateStr, dayNum: d, inMonth: true });
  }
  // Trailing days to fill 35 or 42 cells
  const remaining = 35 - daysGrid.length >= 0 ? 35 - daysGrid.length : 42 - daysGrid.length;
  for (let d = 1; d <= remaining; d++) {
    const dateStr = new Date(year, month + 1, d).toISOString().split('T')[0];
    daysGrid.push({ dateStr, dayNum: d, inMonth: false });
  }

  const selectedDateEvents = events.filter((e) => e.date.startsWith(selectedDate));
  const selectedDateObj = new Date(selectedDate + 'T12:00:00');
  const selectedDateFormatted = selectedDateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Nav
        variant="provider"
        rightSlot={
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link to="/dashboard" className="flex items-center gap-1.5 text-body hover:text-ink">
              <ArrowLeft size={14} />
              <span>Queue</span>
            </Link>
            <div className="flex items-center gap-2 pl-3 border-l border-line font-bold text-ink">
              <div className="w-6 h-6 bg-ink text-bright flex items-center justify-center">
                <Stethoscope size={14} />
              </div>
              <span>Dr. Chen</span>
            </div>
          </div>
        }
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Header Card */}
        <div className="bg-panel border border-line p-6 border-t-4 border-t-brand space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-ink">{patient.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {note?.risk_level && <RiskBadge level={note.risk_level} />}
                {note?.status && <StatusChip status={note.status} />}
                {patient.age_range && (
                  <span className="px-2.5 py-1 bg-bright border border-line text-faint">
                    Age {patient.age_range}
                  </span>
                )}
                <span className="px-2.5 py-1 bg-bright border border-line text-faint">
                  {allVisitsCount} {allVisitsCount === 1 ? 'visit' : 'visits'} on record
                </span>
                <span className="px-2.5 py-1 bg-bright border border-line text-faint">
                  Last seen {lastSeenDate}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/intake"
                className="px-4 py-2 border border-line hover:bg-bright text-xs font-bold text-ink flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>New intake</span>
              </Link>
              {note ? (
                <Link
                  to={`/dashboard/note/${note.id}`}
                  className="px-4 py-2 bg-ink hover:bg-hover-grad text-bright text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Open latest note</span>
                </Link>
              ) : (
                <button
                  disabled
                  className="px-4 py-2 bg-line/40 text-faint text-xs font-semibold cursor-not-allowed"
                >
                  No note yet
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Allergy Banners (Name-matched or stored) */}
        {activeAllergies.length > 0 && (
          <div className="bg-danger/10 border-l-4 border-l-danger p-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldAlert size={18} className="text-danger shrink-0" />
              <span className="font-bold text-danger">Allergy alert:</span>
              <span className="text-ink">
                {activeAllergies.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ')}
              </span>
            </div>
            <span className="text-[11px] text-faint">Documented on chart</span>
          </div>
        )}

        {/* View Toggle & Filter Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line">
          {/* Filter Chips */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              onClick={() => toggleFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                isFilterActive('all')
                  ? 'bg-ink text-bright'
                  : 'border border-line bg-panel text-body hover:bg-bright'
              }`}
            >
              All · {events.length}
            </button>
            {Object.keys(filterTypes).map((filterKey) => {
              const count = events.filter((e) => e.type === (filterTypes as any)[filterKey]).length;
              if (count === 0) return null;
              const active = isFilterActive(filterKey);
              return (
                <button
                  key={filterKey}
                  onClick={() => toggleFilter(filterKey)}
                  className={`px-2.5 py-1 text-xs font-bold capitalize transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand text-bright'
                      : 'border border-line bg-panel text-body hover:bg-bright'
                  }`}
                >
                  {filterKey} · {count}
                </button>
              );
            })}
          </div>

          {/* View Toggle: Timeline vs Calendar */}
          <div className="flex border border-line bg-panel p-0.5 self-start sm:self-auto">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'timeline' ? 'bg-bright text-ink shadow-xs' : 'text-faint hover:text-ink'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'calendar' ? 'bg-bright text-ink shadow-xs' : 'text-faint hover:text-ink'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>

        {/* Empty State when no events exist */}
        {events.length === 0 ? (
          <div className="bg-panel border border-line p-12 text-center space-y-4">
            <FolderOpen size={32} className="mx-auto text-faint" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-ink">No history yet</h3>
              <p className="text-xs text-body">
                Nothing charted for this patient. A voice check-in fills this in automatically.
              </p>
            </div>
            <Link
              to="/intake"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-ink text-bright text-xs font-bold hover:bg-hover-grad"
            >
              <span>Start an intake</span> &rarr;
            </Link>
          </div>
        ) : viewMode === 'timeline' ? (
          /* Timeline View */
          <div className="space-y-6">
            {timelineGroups.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-xs py-1.5 px-2 border-b border-line text-xs font-bold text-body">
                  {group.label}
                </div>

                <div className="divide-y divide-line border border-line bg-panel">
                  {group.events.map((ev) => {
                    const Icon = ev.icon;
                    return (
                      <div
                        key={ev.id}
                        className="p-4 flex items-start justify-between gap-4 hover:bg-bright transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-8 h-8 shrink-0 flex items-center justify-center ${ev.colorClass}`}>
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="text-xs font-bold text-ink flex items-center gap-2">
                              <span>{ev.title}</span>
                              {ev.badge}
                            </div>
                            {ev.subtitle && <p className="text-xs text-body leading-relaxed">{ev.subtitle}</p>}
                            <div className="text-[11px] text-faint">
                              {new Date(ev.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                        </div>

                        {ev.link && (
                          <Link
                            to={ev.link}
                            className="px-3 py-1.5 border border-line text-xs font-bold text-brand hover:bg-panel shrink-0"
                          >
                            Open note &rarr;
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Calendar View */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
            {/* Calendar Grid Card */}
            <div className="bg-panel border border-line p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="text-sm font-bold text-ink">
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const today = new Date();
                      setSelectedDate(today.toISOString().split('T')[0]);
                      setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                    }}
                    className="px-2 py-1 text-xs border border-line text-body font-semibold hover:bg-bright cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                    className="w-7 h-7 border border-line flex items-center justify-center text-faint hover:text-ink hover:bg-bright cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                    className="w-7 h-7 border border-line flex items-center justify-center text-faint hover:text-ink hover:bg-bright cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* 7-column calendar grid */}
              <div className="grid grid-cols-7 gap-px bg-line border border-line text-center text-xs">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="p-2 bg-bright font-bold text-faint text-[11px]">
                    {d}
                  </div>
                ))}

                {daysGrid.map((cell, idx) => {
                  const isToday = cell.dateStr === todayYMD;
                  const isSelected = cell.dateStr === selectedDate;
                  const dayEvents = events.filter((e) => e.date.startsWith(cell.dateStr));

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(cell.dateStr)}
                      className={`h-20 p-1 flex flex-col justify-between text-left transition-colors cursor-pointer ${
                        !cell.inMonth ? 'bg-line/20 opacity-40' : 'bg-panel hover:bg-bright'
                      } ${isSelected ? 'ring-2 ring-brand ring-inset z-10' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 ${
                            isToday ? 'bg-ink text-bright' : 'text-ink'
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                      </div>

                      {/* Event square indicators */}
                      <div className="flex flex-wrap gap-1 mt-auto">
                        {dayEvents.slice(0, 3).map((ev, i) => (
                          <span
                            key={i}
                            title={ev.title}
                            className={`w-2 h-2 ${
                              ev.type === 'risk'
                                ? 'bg-danger'
                                : ev.type === 'note'
                                ? 'bg-brand'
                                : ev.type === 'lab'
                                ? 'bg-positive'
                                : 'bg-ink'
                            }`}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[9px] text-faint font-semibold">
                            +{dayEvents.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right-Side Day Detail Panel */}
            <div className="bg-panel border border-line p-5 space-y-4">
              <div className="pb-2 border-b border-line">
                <div className="text-xs font-bold text-brand">{selectedDateFormatted}</div>
                <div className="text-xs text-faint">
                  {selectedDateEvents.length} {selectedDateEvents.length === 1 ? 'event' : 'events'}
                </div>
              </div>

              {selectedDateEvents.length === 0 ? (
                <div className="py-8 text-center text-xs text-faint space-y-1">
                  <p>Nothing charted on this day.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedDateEvents.map((ev) => (
                    <div key={ev.id} className="p-3 bg-bright border border-line text-xs space-y-1">
                      <div className="font-bold text-ink flex items-center justify-between">
                        <span>{ev.title}</span>
                        {ev.badge}
                      </div>
                      {ev.subtitle && <p className="text-body text-[11px] leading-snug">{ev.subtitle}</p>}
                      {ev.link && (
                        <Link to={ev.link} className="text-brand font-bold hover:underline block pt-1">
                          Open note &rarr;
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-line text-[11px] text-faint text-center">
                Arrow keys move days
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
