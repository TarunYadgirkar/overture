import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Check, Building, ShieldCheck } from 'lucide-react';
import { EPIC_SYSTEMS, EPIC_FHIR_MOCK } from '../data/epic-mock';
import { EpicSystem, EpicImportState, MedCardData } from '../types';
import { Spinner, Btn } from './primitives';

export interface ConnectRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName?: string;
}

export function ConnectRecordsModal({ isOpen, onClose, patientName }: ConnectRecordsModalProps) {
  const [step, setStep] = useState<'select' | 'connecting' | 'success'>('select');
  const [search, setSearch] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<EpicSystem | null>(null);
  const [progress, setProgress] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Reset state on modal open
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSearch('');
      setSelectedSystem(null);
      setProgress(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle connecting progress timer (0 -> 100% over 2s)
  useEffect(() => {
    if (step !== 'connecting' || !selectedSystem) return;

    const startTime = Date.now();
    const duration = 2000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(interval);

        // Save imported record to localStorage
        const effectiveName = patientName?.trim() || EPIC_FHIR_MOCK.patient.name;
        const recordClone = JSON.parse(JSON.stringify(EPIC_FHIR_MOCK));
        recordClone.patient.name = effectiveName;

        const importState: EpicImportState = {
          connected: true,
          systemId: selectedSystem.id,
          systemName: selectedSystem.name,
          importedAt: new Date().toISOString(),
          record: recordClone,
        };

        localStorage.setItem('overture-epic-import', JSON.stringify(importState));

        // Also merge and dedupe into MedCard
        try {
          const rawCard = localStorage.getItem('overture-medcard');
          const currentCard: MedCardData = rawCard
            ? JSON.parse(rawCard)
            : { medications: [], allergies: [], conditions: [], lastUpdated: new Date().toLocaleDateString() };

          const newMeds = recordClone.medications.map((m: any) => `${m.name} — ${m.frequency}`);
          const newAllergies = recordClone.allergies.map((a: any) => `${a.substance} (${a.reaction})`);
          const newConditions = recordClone.conditions.map((c: any) => `${c.name} (${c.icd10})`);

          const dedupe = (existing: string[], incoming: string[]) => {
            const set = new Set(existing.map((s) => s.toLowerCase()));
            const merged = [...existing];
            for (const item of incoming) {
              if (!set.has(item.toLowerCase())) {
                set.add(item.toLowerCase());
                merged.push(item);
              }
            }
            return merged;
          };

          const updatedCard: MedCardData = {
            medications: dedupe(currentCard.medications, newMeds),
            allergies: dedupe(currentCard.allergies, newAllergies),
            conditions: dedupe(currentCard.conditions, newConditions),
            lastUpdated: new Date().toLocaleDateString(),
          };

          localStorage.setItem('overture-medcard', JSON.stringify(updatedCard));
        } catch {
          // Ignore storage parsing issues
        }

        // Dispatch window event
        window.dispatchEvent(new CustomEvent('overture:records-changed'));
        setStep('success');
      }
    }, 40);

    return () => clearInterval(interval);
  }, [step, selectedSystem, patientName]);

  if (!isOpen) return null;

  const filteredSystems = EPIC_SYSTEMS.filter((sys) =>
    sys.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelectSystem = (sys: EpicSystem) => {
    setSelectedSystem(sys);
    setStep('connecting');
  };

  const handleScrimClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleScrimClick}
      className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-panel border-2 border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Step 1: Select Health System */}
        {step === 'select' && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-line flex items-start justify-between bg-bright">
              <div className="space-y-1">
                <div className="text-xs font-bold text-brand flex items-center gap-1.5">
                  <Building size={14} />
                  <span>Epic MyChart connection</span>
                </div>
                <h2 className="text-xl font-black text-ink">Connect health records</h2>
                <p className="text-xs text-body">
                  Select your health system to securely link your chart.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 border border-line text-faint hover:text-ink hover:bg-panel flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search input */}
            <div className="p-4 border-b border-line bg-surface">
              <div className="flex items-center gap-2 border border-line bg-bright px-3 py-2">
                <Search size={16} className="text-faint shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search health systems…"
                  className="w-full text-xs font-medium text-ink outline-none bg-transparent"
                />
              </div>
            </div>

            {/* List of systems */}
            <div className="flex-1 overflow-y-auto divide-y divide-line max-h-72 p-2">
              {filteredSystems.length > 0 ? (
                filteredSystems.map((sys) => (
                  <button
                    key={sys.id}
                    onClick={() => handleSelectSystem(sys)}
                    className="w-full p-3 text-left hover:bg-bright flex items-center justify-between group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{sys.logo}</span>
                      <span className="text-xs font-bold text-ink group-hover:text-brand">
                        {sys.name}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-faint group-hover:text-ink">
                      Connect &rarr;
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-faint">
                  No health systems match "{search}".
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-line bg-bright flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-line text-xs font-bold hover:bg-panel text-ink cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Connecting Animation */}
        {step === 'connecting' && selectedSystem && (
          <div className="p-8 text-center space-y-6 flex flex-col items-center justify-center my-auto">
            <div className="w-16 h-16 bg-brand/10 text-brand flex items-center justify-center">
              <Spinner size="lg" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-brand flex items-center justify-center gap-1.5">
                <ShieldCheck size={14} />
                <span>SMART on FHIR authorization</span>
              </div>
              <h3 className="text-xl font-black text-ink">
                Connecting to {selectedSystem.name}
              </h3>
              <p className="text-xs text-body">
                Your records stay private to this visit.
              </p>
            </div>

            {/* Progress bar (0 -> 100% over 2s) */}
            <div className="w-full max-w-xs space-y-1.5">
              <div className="w-full h-2 bg-line overflow-hidden">
                <div
                  className="h-full bg-brand transition-all duration-75"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-faint">
                <span>Authorizing FHIR bundle…</span>
                <span>{progress}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && selectedSystem && (
          <div className="p-8 text-center space-y-6 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-positive text-bright flex items-center justify-center shadow-md">
              <Check size={36} />
            </div>

            <div className="space-y-2 max-w-sm">
              <h3 className="text-2xl font-black text-ink">
                Records imported from {selectedSystem.name}
              </h3>
              <p className="text-xs text-body leading-relaxed">
                2 medications · 1 allergy · 2 conditions · 5 test results · 3 immunizations · 2 recent visits
              </p>
            </div>

            <div className="w-full space-y-2 pt-2">
              <Btn
                variant="primary"
                onClick={() => {
                  onClose();
                  navigate('/records');
                }}
                className="w-full"
              >
                View imported records &rarr;
              </Btn>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-xs font-bold text-faint hover:text-ink cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
