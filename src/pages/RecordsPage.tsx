import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Building,
  RotateCcw,
  Calendar,
  Activity,
  Pill,
  Heart,
  ShieldAlert,
  Syringe,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Nav, Btn } from '../components/primitives';
import { ConnectRecordsModal } from '../components/ConnectRecordsModal';
import { EPIC_FHIR_MOCK } from '../data/epic-mock';
import { EpicImportState, LabFlag } from '../types';

export function RecordsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'timeline';
  const [importState, setImportState] = useState<EpicImportState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const loadState = () => {
    try {
      const raw = localStorage.getItem('overture-epic-import');
      if (raw) {
        setImportState(JSON.parse(raw));
      } else {
        setImportState(null);
      }
    } catch {
      setImportState(null);
    }
  };

  useEffect(() => {
    loadState();
    const handleChanged = () => loadState();
    window.addEventListener('overture:records-changed', handleChanged);
    return () => window.removeEventListener('overture:records-changed', handleChanged);
  }, []);

  const handleTabChange = (tabId: string) => {
    setSearchParams(tabId === 'timeline' ? {} : { tab: tabId });
  };

  const handleLoadSample = () => {
    const recordClone = JSON.parse(JSON.stringify(EPIC_FHIR_MOCK));
    const newState: EpicImportState = {
      connected: true,
      systemId: 'sutter',
      systemName: 'Sutter Health',
      importedAt: new Date().toISOString(),
      record: recordClone,
    };
    localStorage.setItem('overture-epic-import', JSON.stringify(newState));
    window.dispatchEvent(new CustomEvent('overture:records-changed'));
    setImportState(newState);
  };

  const handleDisconnect = () => {
    localStorage.removeItem('overture-epic-import');
    window.dispatchEvent(new CustomEvent('overture:records-changed'));
    setImportState(null);
    setIsDisconnecting(false);
  };

  const formatImportDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString();
    } catch {
      return '';
    }
  };

  const getLabFlagBadge = (flag: LabFlag) => {
    switch (flag) {
      case 'HIGH':
        return <span className="px-2 py-0.5 bg-danger text-bright text-[10px] font-bold">High</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 bg-danger text-bright text-[10px] font-bold">Low</span>;
      case 'HIGH_NORMAL':
        return (
          <span className="px-2 py-0.5 bg-caution/20 text-caution text-[10px] font-bold">
            High normal
          </span>
        );
      case 'BORDERLINE':
        return (
          <span className="px-2 py-0.5 bg-caution/20 text-caution text-[10px] font-bold">
            Borderline
          </span>
        );
      case 'ELEVATED':
        return (
          <span className="px-2 py-0.5 bg-caution/20 text-caution text-[10px] font-bold">
            Elevated
          </span>
        );
      default:
        return <span className="px-2 py-0.5 bg-positive/15 text-positive text-[10px] font-bold">Normal</span>;
    }
  };

  const tabs = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'tests', label: 'Test Results' },
    { id: 'meds', label: 'Medications' },
    { id: 'allergies', label: 'Allergies' },
    { id: 'conditions', label: 'Conditions' },
    { id: 'immunizations', label: 'Immunizations' },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Nav
        rightSlot={
          <Link to="/" className="text-xs font-bold text-ink hover:underline">
            Home
          </Link>
        }
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-6">
        {/* Empty State */}
        {!importState ? (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="space-y-1">
              <span className="text-xs font-bold text-brand">Health records</span>
              <h1 className="text-3xl font-black text-ink">No records yet</h1>
              <p className="text-sm text-body">
                Connect your health records to give Overture the context it needs before your visit.
              </p>
            </div>

            <div className="bg-panel border border-line p-8 space-y-6">
              <div className="space-y-4">
                <div className="p-5 bg-bright border border-line space-y-3">
                  <span className="text-xs font-bold text-body block">From your health system</span>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full py-3.5 px-4 bg-ink hover:bg-hover-grad text-bright text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Building size={16} />
                    <span>Import from Epic MyChart</span>
                  </button>
                </div>

                <div className="p-5 bg-bright border border-line space-y-2">
                  <span className="text-xs font-bold text-body block">Explore with sample data</span>
                  <button
                    onClick={handleLoadSample}
                    className="w-full py-3 px-4 border border-line hover:bg-panel text-ink text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Activity size={15} />
                    <span>Load example data (Sutter Health / Maya Patel)</span>
                  </button>
                  <p className="text-xs text-faint">
                    Loads a sample patient record to explore the experience.
                  </p>
                </div>
              </div>
            </div>

            {/* Safety Footer */}
            <div className="text-xs text-faint pt-4 border-t border-line text-center">
              Overture is a pre-visit check-in tool, not a diagnosis system. In an emergency call 911, or 988 for mental health crises.
            </div>
          </div>
        ) : (
          /* Loaded State */
          <div className="space-y-6">
            {/* Centered Header */}
            <div className="bg-panel border border-line p-6 text-center space-y-2">
              <span className="text-xs font-bold text-brand">Connected health record</span>
              <h1 className="text-3xl font-black text-ink">{importState.record.patient.name}</h1>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-body">
                <span>DOB {importState.record.patient.dob}</span>
                <span>·</span>
                <span>MRN {importState.record.patient.mrn}</span>
                <span>·</span>
                <span>Imported from {importState.systemName} on {formatImportDate(importState.importedAt)}</span>
              </div>
              <p className="text-xs text-faint">{importState.record.patient.facility}</p>
            </div>

            {/* 6-Tile Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-px bg-line border border-line text-center">
              {[
                { label: 'Test Results', count: importState.record.labResults.length, tab: 'tests' },
                { label: 'Medications', count: importState.record.medications.length, tab: 'meds' },
                { label: 'Allergies', count: importState.record.allergies.length, tab: 'allergies' },
                { label: 'Conditions', count: importState.record.conditions.length, tab: 'conditions' },
                { label: 'Immunizations', count: importState.record.immunizations.length, tab: 'immunizations' },
                { label: 'Visits', count: importState.record.recentEncounters.length + importState.record.upcomingVisits.length, tab: 'timeline' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleTabChange(item.tab)}
                  className={`p-3 space-y-1 transition-colors cursor-pointer ${
                    activeTab === item.tab ? 'bg-ink text-bright' : 'bg-panel hover:bg-bright text-ink'
                  }`}
                >
                  <div className="text-2xl font-light font-numeral">{item.count}</div>
                  <span className="text-[11px] block truncate opacity-80">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Navigation Pills */}
            <div className="flex flex-wrap gap-1 border-b border-line pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-ink text-bright'
                      : 'border border-line bg-panel text-body hover:bg-bright hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Sections */}
            <div className="space-y-6">
              {/* Chart Timeline */}
              {activeTab === 'timeline' && (
                <div className="bg-panel border border-line p-6 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                      <Clock size={16} className="text-brand" />
                      <span>Chronological feed of all FHIR items</span>
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] text-faint">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-brand" /> Visit
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-positive" /> Lab
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-caution" /> Condition / Med
                      </span>
                    </div>
                  </div>

                  <div className="space-y-6 pl-2">
                    {/* Upcoming Visits */}
                    {importState.record.upcomingVisits.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-brand block">Upcoming</span>
                        <div className="space-y-2 border-l-2 border-brand pl-4">
                          {importState.record.upcomingVisits.map((uv, idx) => (
                            <div key={idx} className="p-3 bg-bright border border-line text-xs space-y-0.5">
                              <div className="font-bold text-ink flex items-center justify-between">
                                <span>{uv.type}</span>
                                <span className="text-brand">{uv.date}</span>
                              </div>
                              <div className="text-faint">{uv.provider}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Timeline */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-body block">May 2026</span>
                      <div className="space-y-2 border-l-2 border-line pl-4">
                        {importState.record.recentEncounters
                          .filter((e) => e.date.startsWith('2026-05'))
                          .map((e, idx) => (
                            <div key={idx} className="p-3 bg-bright border border-line text-xs space-y-0.5">
                              <div className="font-bold text-ink flex items-center justify-between">
                                <span>{e.type}</span>
                                <span className="text-faint">{e.date}</span>
                              </div>
                              <div className="text-faint">{e.provider} · {e.facility}</div>
                            </div>
                          ))}
                        {importState.record.labResults.map((lr, idx) => (
                          <div key={idx} className="p-3 bg-bright border border-line text-xs flex items-center justify-between">
                            <div>
                              <div className="font-bold text-ink">{lr.name}</div>
                              <div className="text-faint">{lr.reference}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-ink">{lr.value}</span>
                              {getLabFlagBadge(lr.flag)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-body block">February 2026</span>
                      <div className="space-y-2 border-l-2 border-line pl-4">
                        {importState.record.recentEncounters
                          .filter((e) => e.date.startsWith('2026-02'))
                          .map((e, idx) => (
                            <div key={idx} className="p-3 bg-bright border border-line text-xs space-y-0.5">
                              <div className="font-bold text-ink flex items-center justify-between">
                                <span>{e.type}</span>
                                <span className="text-faint">{e.date}</span>
                              </div>
                              <div className="text-faint">{e.provider} · {e.facility}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tests Tab */}
              {activeTab === 'tests' && (
                <div className="bg-panel border border-line p-5 space-y-3">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                    <Activity size={16} className="text-positive" />
                    <span>Test results & reference ranges</span>
                  </h3>
                  <div className="space-y-2">
                    {importState.record.labResults.map((lr, idx) => {
                      const isAbnormal = lr.flag === 'HIGH' || lr.flag === 'LOW' || lr.flag === 'BORDERLINE' || lr.flag === 'HIGH_NORMAL' || lr.flag === 'ELEVATED';
                      return (
                        <div
                          key={idx}
                          className={`p-3.5 border text-xs flex items-center justify-between ${
                            isAbnormal ? 'bg-caution/5 border-caution/40' : 'bg-bright border-line'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-ink flex items-center gap-2">
                              <span>{lr.name}</span>
                              {isAbnormal && (
                                <span className="text-[10px] text-caution font-bold">Abnormal</span>
                              )}
                            </div>
                            <div className="text-faint">Date: {lr.date} · Ref: {lr.reference}</div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-ink text-sm">{lr.value}</span>
                            {getLabFlagBadge(lr.flag)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Medications Tab */}
              {activeTab === 'meds' && (
                <div className="bg-panel border border-line p-5 space-y-3">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                    <Pill size={16} className="text-brand" />
                    <span>Medications (active vs historic)</span>
                  </h3>
                  <div className="space-y-2">
                    {importState.record.medications.map((m, idx) => (
                      <div key={idx} className="p-3.5 bg-bright border border-line text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-ink text-sm">{m.name}</div>
                          <span className="px-2 py-0.5 bg-positive/15 text-positive text-[10px] font-bold">
                            Active
                          </span>
                        </div>
                        <div className="text-body font-medium">Sig: {m.frequency}</div>
                        <div className="text-faint">
                          Prescriber: {m.prescriber} · Started: {m.started}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allergies Tab */}
              {activeTab === 'allergies' && (
                <div className="bg-panel border border-line p-5 space-y-3">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                    <ShieldAlert size={16} className="text-danger" />
                    <span>Allergies</span>
                  </h3>
                  <div className="space-y-2">
                    {importState.record.allergies.map((a, idx) => (
                      <div key={idx} className="p-3.5 bg-bright border border-line text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-danger text-sm">{a.substance}</div>
                          <span className="px-2 py-0.5 bg-danger/15 text-danger text-[10px] font-bold">
                            {a.severity}
                          </span>
                        </div>
                        <div className="text-faint">
                          Reaction: {a.reaction} · Recorded: {a.recorded}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conditions Tab */}
              {activeTab === 'conditions' && (
                <div className="bg-panel border border-line p-5 space-y-3">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                    <Heart size={16} className="text-caution" />
                    <span>Conditions</span>
                  </h3>
                  <div className="space-y-2">
                    {importState.record.conditions.map((c, idx) => (
                      <div key={idx} className="p-3.5 bg-bright border border-line text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-ink text-sm">{c.name}</div>
                          <span className="px-2 py-0.5 bg-brand/15 text-brand text-[10px] font-bold">
                            {c.status}
                          </span>
                        </div>
                        <div className="text-faint">
                          ICD-10: {c.icd10} · Onset: {c.diagnosed}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Immunizations Tab */}
              {activeTab === 'immunizations' && (
                <div className="bg-panel border border-line p-5 space-y-3">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                    <Syringe size={16} className="text-brand-dark" />
                    <span>Immunizations</span>
                  </h3>
                  <div className="space-y-2">
                    {importState.record.immunizations.map((im, idx) => (
                      <div key={idx} className="p-3.5 bg-bright border border-line text-xs flex items-center justify-between">
                        <span className="font-bold text-ink">{im.name}</span>
                        <span className="text-faint">{im.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions & Disconnect */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-line">
              <Btn
                variant="primary"
                onClick={() => (window.location.href = '#/intake')}
                icon={ArrowRight}
                className="w-full sm:w-auto"
              >
                Start voice check-in
              </Btn>

              {/* Disconnect with inline confirmation */}
              <div>
                {isDisconnecting ? (
                  <div className="flex items-center gap-2 p-2 bg-bright border border-line text-xs">
                    <span className="font-bold text-ink">Disconnect {importState.systemName}?</span>
                    <button
                      onClick={handleDisconnect}
                      className="px-2.5 py-1 bg-danger text-bright font-bold cursor-pointer hover:bg-danger/90"
                    >
                      Disconnect
                    </button>
                    <button
                      onClick={() => setIsDisconnecting(false)}
                      className="px-2.5 py-1 border border-line text-ink font-semibold hover:bg-panel cursor-pointer"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsDisconnecting(true)}
                    className="text-xs font-semibold text-faint hover:text-danger flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Disconnect {importState.systemName}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Connect Modal */}
      <ConnectRecordsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
