import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  X,
  Shield,
  Badge,
  Sparkles,
  RotateCcw,
  RefreshCw,
  Mic,
  Video,
  Stethoscope,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { CareLevel, CoverageSummary } from '../types';
import { checkEligibility } from '../services/eligibility';

interface CoverageBotMessage {
  id: string;
  sender: 'bot' | 'user';
  text?: string;
  coverage?: CoverageSummary;
  isWarning?: boolean;
}

export function CoverageBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'insurer' | 'memberId' | 'careLevel' | 'result'>('insurer');
  const [selectedPayer, setSelectedPayer] = useState<{ key: string; name: string; demoId: string }>({
    key: 'UHC',
    name: 'UnitedHealthcare',
    demoId: 'UHC202649',
  });
  const [memberIdInput, setMemberIdInput] = useState('UHC202649');
  const [messages, setMessages] = useState<CoverageBotMessage[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const resetFlow = () => {
    setStep('insurer');
    setSelectedPayer({ key: 'UHC', name: 'UnitedHealthcare', demoId: 'UHC202649' });
    setMemberIdInput('UHC202649');
    setMessages([
      {
        id: '1',
        sender: 'bot',
        text: 'Hi — I can check what a visit will cost you. Estimates only, not a guarantee of coverage.',
      },
      {
        id: '2',
        sender: 'bot',
        text: "Who's your insurer?",
      },
    ]);
  };

  useEffect(() => {
    if (isOpen) {
      resetFlow();
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectInsurer = (payer: { key: string; name: string; demoId: string }) => {
    setSelectedPayer(payer);
    setMemberIdInput(payer.demoId);
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), sender: 'user', text: payer.name },
      { id: (Date.now() + 1).toString(), sender: 'bot', text: "What's your member ID?" },
    ]);
    setStep('memberId');
  };

  const handleSubmitMemberId = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const idToUse = memberIdInput.trim() || selectedPayer.demoId;
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), sender: 'user', text: `ID: ${idToUse}` },
      { id: (Date.now() + 1).toString(), sender: 'bot', text: 'What kind of visit do you need?' },
    ]);
    setStep('careLevel');
  };

  const handleSelectCareLevel = async (level: CareLevel, label: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), sender: 'user', text: label },
    ]);
    setIsChecking(true);

    setTimeout(() => {
      const summary = checkEligibility({
        careLevel: level,
        payerKey: selectedPayer.key,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          sender: 'bot',
          coverage: summary,
        },
        {
          id: (Date.now() + 3).toString(),
          sender: 'bot',
          text: `“${summary.spoken_summary}”`,
        },
      ]);
      setIsChecking(false);
      setStep('result');
    }, 450);
  };

  return (
    <>
      {/* Floating launcher */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-7 right-7 z-40 bg-ink hover:bg-hover-grad text-bright px-5 py-3.5 shadow-2xl flex items-center gap-2.5 transition-all transform hover:-translate-y-0.5 cursor-pointer font-bold text-sm select-none"
        >
          <MessageSquare size={18} />
          <span>Ask about coverage</span>
        </button>
      )}

      {/* Slide-over scrim and panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-ink/40 transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Coverage assistant"
              className="w-screen max-w-md bg-panel border-l border-line shadow-2xl flex flex-col justify-between"
            >
              {/* Header */}
              <div className="p-4 bg-bright border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand flex items-center justify-center text-bright">
                    <Shield size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-ink leading-tight">
                      Coverage assistant
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-faint">
                      <span>Synthetic estimate</span>
                      <span className="border border-caution text-caution px-1.5 py-0.2">
                        Test mode
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-faint hover:text-ink hover:bg-panel cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    {msg.text && (
                      <div
                        className={`p-3 text-sm max-w-[85%] leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-ink text-bright font-medium'
                            : 'bg-bright border border-line text-ink'
                        }`}
                      >
                        {msg.text}
                      </div>
                    )}

                    {msg.coverage && (
                      <div className="w-full bg-brand text-bright p-4 border border-brand-dark space-y-3 mt-1">
                        <div className="flex items-center justify-between text-xs text-bright/70">
                          <span className="font-bold flex items-center gap-1.5">
                            <Shield size={14} /> Coverage check
                          </span>
                          <span className="border border-bright/30 px-1.5 py-0.5">
                            Synthetic estimate
                          </span>
                        </div>
                        <div>
                          <div className="text-lg font-black">{msg.coverage.payer}</div>
                          <div className="text-xs text-bright/80 font-medium">
                            ✓ {msg.coverage.plan_status}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-bright/20">
                          <div>
                            <span className="text-xs text-bright/70 block">
                              {msg.coverage.copay !== null ? 'Copay' : 'Visit est.'}
                            </span>
                            <span className="text-2xl font-light font-numeral">
                              {msg.coverage.copay !== null
                                ? `$${msg.coverage.copay}`
                                : `$${msg.coverage.estimated_visit_cost.min}–$${msg.coverage.estimated_visit_cost.max}`}
                            </span>
                          </div>
                          {msg.coverage.deductible_remaining !== undefined && (
                            <div>
                              <span className="text-xs text-bright/70 block">Deduct. left</span>
                              <span className="text-2xl font-light font-numeral">
                                ${msg.coverage.deductible_remaining}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isChecking && (
                  <div className="flex items-center gap-2 p-3 bg-bright border border-line text-sm text-faint">
                    <span className="w-2 h-2 bg-brand animate-pulse inline-block" />
                    <span>Checking plan rates…</span>
                  </div>
                )}
              </div>

              {/* Action Controls based on current step */}
              <div className="p-4 bg-bright border-t border-line space-y-3">
                {step === 'insurer' && (
                  <div className="space-y-2">
                    <span className="text-xs text-faint block">Select an insurer:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'UHC', name: 'UnitedHealthcare', demoId: 'UHC202649' },
                        { key: 'CIGNA', name: 'Cigna', demoId: '23456789100' },
                        { key: 'AETNA', name: 'Aetna', demoId: 'AETNA12345' },
                        { key: 'MEDICARE', name: 'Medicare', demoId: 'CMS12345678' },
                      ].map((payer) => (
                        <button
                          key={payer.key}
                          onClick={() => handleSelectInsurer(payer)}
                          className="p-2.5 text-xs font-bold border border-line bg-panel hover:bg-ink hover:text-bright text-ink text-left transition-colors cursor-pointer"
                        >
                          {payer.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 'memberId' && (
                  <form onSubmit={handleSubmitMemberId} className="space-y-2.5">
                    <div className="flex border border-line bg-bright">
                      <div className="w-10 h-10 flex items-center justify-center bg-panel border-r border-line text-body">
                        <Badge size={16} />
                      </div>
                      <input
                        type="text"
                        value={memberIdInput}
                        onChange={(e) => setMemberIdInput(e.target.value)}
                        placeholder={selectedPayer.demoId}
                        className="flex-1 px-3 text-sm text-ink outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMemberIdInput(selectedPayer.demoId)}
                        className="flex-1 py-2 px-3 text-xs font-semibold border border-brand text-brand hover:bg-brand hover:text-bright flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Sparkles size={13} />
                        <span>Use demo ID</span>
                      </button>
                      <button
                        type="submit"
                        className="py-2 px-5 text-xs font-bold bg-ink text-bright hover:bg-hover-grad cursor-pointer"
                      >
                        Continue
                      </button>
                    </div>
                  </form>
                )}

                {step === 'careLevel' && (
                  <div className="space-y-2">
                    <span className="text-xs text-faint block">Select visit acuity:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { level: 'telehealth' as CareLevel, label: 'Telehealth', icon: Video },
                        { level: 'primary_care' as CareLevel, label: 'Primary care', icon: Stethoscope },
                        { level: 'urgent_care' as CareLevel, label: 'Urgent care', icon: Building2 },
                        { level: 'emergency_room' as CareLevel, label: 'Emergency room', icon: AlertTriangle },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.level}
                            onClick={() => handleSelectCareLevel(item.level, item.label)}
                            className="p-3 text-xs font-bold border border-line bg-panel hover:bg-ink hover:text-bright text-ink flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Icon size={15} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === 'result' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        onClick={() => setStep('careLevel')}
                        className="py-1.5 px-3 border border-line hover:bg-panel font-semibold text-ink flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw size={13} /> Another visit type
                      </button>
                      <button
                        onClick={() => setStep('insurer')}
                        className="py-1.5 px-3 border border-line hover:bg-panel font-semibold text-ink flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw size={13} /> Different insurer
                      </button>
                    </div>
                    <Link
                      to="/intake"
                      onClick={() => setIsOpen(false)}
                      className="w-full py-2.5 bg-ink text-bright hover:bg-hover-grad font-bold text-xs flex items-center justify-center gap-2 mt-2"
                    >
                      <Mic size={14} /> Start voice check-in
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
