import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  AlertTriangle,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Calendar,
  Video,
  Repeat,
  UserPlus,
  HeartPulse,
  Brain,
  FlaskConical,
  Thermometer,
  Stethoscope,
  Inbox,
} from 'lucide-react';
import { PatientRow } from '../types';
import { listPatientRows, deletePatient } from '../services/recordStore';
import { Nav, StatusChip, RiskBadge, Spinner, Btn } from '../components/primitives';

export function DashboardPage() {
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isFirstLoadRef = useRef(true);
  const navigate = useNavigate();

  const loadData = useCallback(async (isInitial = false) => {
    try {
      const data = await listPatientRows();
      setRows(data);
    } catch (err) {
      console.error('Failed to load patient queue:', err);
    } finally {
      if (isInitial) {
        setLoading(false);
        isFirstLoadRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => {
      loadData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const confirmDelete = async (rowId: string) => {
    try {
      await deletePatient(rowId);
      setDeletingId(null);
      await loadData(false);
    } catch (err) {
      console.error('Failed to delete patient:', err);
    }
  };

  // Stats computation
  const totalPatients = rows.length;
  const pendingReview = rows.filter(
    (r) => r.note_status === 'ai_draft' || r.note_status === 'urgent_review',
  ).length;
  const highRiskCount = rows.filter((r) => r.risk_level === 'high').length;
  const urgentCount = rows.filter((r) => r.risk_level === 'high' || r.note_status === 'urgent_review').length;

  const getAppointmentIcon = (type?: string, risk?: string, status?: string) => {
    const t = (type || '').toLowerCase();
    let Icon = Stethoscope;
    if (t.includes('urgent') || t.includes('emergency')) Icon = AlertTriangle;
    else if (t.includes('telehealth') || t.includes('video') || t.includes('virtual')) Icon = Video;
    else if (t.includes('follow')) Icon = Repeat;
    else if (t.includes('new patient') || t.includes('new visit')) Icon = UserPlus;
    else if (t.includes('annual') || t.includes('physical') || t.includes('wellness')) Icon = HeartPulse;
    else if (t.includes('mental') || t.includes('psych')) Icon = Brain;
    else if (t.includes('lab') || t.includes('test')) Icon = FlaskConical;
    else if (t.includes('sick') || t.includes('illness')) Icon = Thermometer;

    let colorClass = 'text-faint';
    if (risk === 'high' || status === 'urgent_review') colorClass = 'text-danger';
    else if (status === 'ai_draft') colorClass = 'text-brand';
    else if (status === 'reviewed') colorClass = 'text-positive';

    return <Icon size={20} className={colorClass} />;
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const m = months[d.getMonth()];
      const day = d.getDate();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${m} ${day} · ${hh}:${mm}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Nav variant="provider" />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-line">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-danger">
              <Users size={14} />
              <span>Auto-refreshes every 5s</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-ink leading-tight">
              Patient intake queue
            </h1>
            <p className="text-sm text-body">
              AI-generated summaries require provider review before clinical use.
            </p>
          </div>

          <Btn
            variant="primary"
            icon={Plus}
            onClick={() => navigate('/intake')}
            className="shrink-0"
          >
            New intake
          </Btn>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border border-line">
          <div className="bg-panel p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-faint block">Patients</span>
              <span className="text-4xl font-light font-numeral text-ink mt-1 block">
                {totalPatients}
              </span>
            </div>
            <Users size={28} className="text-brand opacity-80" />
          </div>

          <div className="bg-panel p-5 border-t-4 border-t-caution flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-caution block">Pending review</span>
              <span className="text-4xl font-light font-numeral text-caution mt-1 block">
                {pendingReview}
              </span>
            </div>
            <Clock size={28} className="text-caution opacity-80" />
          </div>

          <div className="bg-panel p-5 border-t-4 border-t-danger flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-danger block">High risk</span>
              <span className="text-4xl font-light font-numeral text-danger mt-1 block">
                {highRiskCount}
              </span>
            </div>
            <AlertTriangle size={28} className="text-danger opacity-80" />
          </div>
        </div>

        {/* Urgent Banner if high-risk rows present */}
        {urgentCount > 0 && (
          <div className="bg-danger text-bright p-4 flex items-center gap-3 border border-danger shadow-sm">
            <AlertTriangle size={20} className="animate-pulse shrink-0" />
            <span className="text-sm font-bold">
              {urgentCount} {urgentCount === 1 ? 'patient' : 'patients'} flagged for urgent provider review
            </span>
          </div>
        )}

        {/* Queue Table */}
        <div className="bg-panel border border-line">
          {/* Desktop Table Header */}
          <div className="hidden md:grid grid-cols-[48px_1.8fr_1.4fr_1.1fr_0.9fr_88px] gap-3 px-4 py-3 border-b border-line bg-line/20 text-xs font-semibold text-faint items-center">
            <span />
            <span>Patient</span>
            <span>Appointment</span>
            <span>Status</span>
            <span>Risk</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Table Body States */}
          {loading && rows.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
              <Spinner size="md" />
              <span className="text-sm text-faint">Loading patients…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 bg-line/30 flex items-center justify-center text-faint">
                <Inbox size={24} />
              </div>
              <h3 className="text-base font-bold text-ink">No patients yet.</h3>
              <Link
                to="/intake"
                className="text-sm font-semibold text-brand hover:underline inline-flex items-center gap-1"
              >
                <span>Start an intake</span> &rarr;
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {rows.map((row) => {
                const isHighRisk = row.risk_level === 'high';
                const hasNote = Boolean(row.note_id);
                const isConfirmingDelete = deletingId === row.id;

                return (
                  <div
                    key={row.id}
                    className={`transition-colors duration-150 p-4 md:px-4 md:py-3.5 flex flex-col md:grid md:grid-cols-[48px_1.8fr_1.4fr_1.1fr_0.9fr_88px] gap-3 md:items-center ${
                      isHighRisk
                        ? 'border-l-4 border-l-danger bg-danger/5 hover:bg-danger/10'
                        : 'hover:bg-bright'
                    }`}
                  >
                    {/* Col 1: Appointment Icon */}
                    <div className="hidden md:flex items-center justify-center">
                      {getAppointmentIcon(row.appointment_type, row.risk_level, row.note_status)}
                    </div>

                    {/* Col 2: Name + Date */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="md:hidden">
                          {getAppointmentIcon(row.appointment_type, row.risk_level, row.note_status)}
                        </div>
                        <Link
                          to={`/dashboard/patient/${row.id}`}
                          className="font-extrabold text-sm text-ink hover:text-brand truncate"
                        >
                          {row.name}
                        </Link>
                      </div>
                      <span className="text-xs text-faint block mt-0.5">
                        {formatDate(row.created_at)}
                      </span>
                    </div>

                    {/* Col 3: Appointment Type */}
                    <div className="text-xs text-body flex items-center gap-1.5 truncate">
                      <Calendar size={13} className="text-faint shrink-0" />
                      <span className="truncate">{row.appointment_type || 'Voice check-in'}</span>
                    </div>

                    {/* Col 4: Status */}
                    <div>
                      {row.note_status ? (
                        <StatusChip status={row.note_status} />
                      ) : row.call_status === 'completed' ? (
                        <StatusChip status="processing" />
                      ) : (
                        <StatusChip status="pending" />
                      )}
                    </div>

                    {/* Col 5: Risk */}
                    <div>
                      {row.risk_level ? (
                        <RiskBadge level={row.risk_level} />
                      ) : (
                        <span className="text-xs text-faint">&mdash;</span>
                      )}
                    </div>

                    {/* Col 6: Actions or Inline Delete Confirm */}
                    <div className="flex items-center justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-line/40">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-xs text-danger font-semibold hidden lg:inline">
                            Remove?
                          </span>
                          <button
                            onClick={() => confirmDelete(row.id)}
                            className="px-2 py-1 bg-danger hover:bg-danger/90 text-bright font-bold text-xs cursor-pointer"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-1 border border-line bg-bright text-ink hover:bg-panel font-semibold text-xs cursor-pointer"
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <>
                          {hasNote ? (
                            <Link
                              to={`/dashboard/note/${row.note_id}`}
                              title="View note"
                              className="w-9 h-9 bg-ink hover:bg-hover-grad text-bright flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Eye size={16} />
                            </Link>
                          ) : (
                            <div
                              title="Note not ready"
                              className="w-9 h-9 bg-line/40 text-faint flex items-center justify-center cursor-not-allowed"
                            >
                              <EyeOff size={16} />
                            </div>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setDeletingId(row.id);
                            }}
                            title="Remove patient"
                            className="w-9 h-9 border border-line bg-transparent hover:bg-danger hover:text-bright text-faint flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
