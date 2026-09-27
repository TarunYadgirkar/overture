import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, Stethoscope, Check } from 'lucide-react';
import { NoteStatus, RiskLevel } from '../types';

// ==========================================
// Nav Component
// ==========================================
export interface NavProps {
  variant?: 'patient' | 'provider';
  rightSlot?: React.ReactNode;
}

export function Nav({ variant = 'patient', rightSlot }: NavProps) {
  return (
    <nav className="bg-bright border-b border-line px-6 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 group">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-brand inline-block" />
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ background: 'linear-gradient(135deg, #b8862b, #a8342b)' }}
          />
        </div>
        <span className="text-xl font-black tracking-tight text-ink">
          Overture
        </span>
      </Link>

      <div className="flex items-center gap-4 text-sm">
        {rightSlot ? (
          rightSlot
        ) : variant === 'provider' ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-positive">
              <span className="w-2 h-2 bg-positive animate-pulse inline-block" />
              <span>Live</span>
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-line">
              <div className="w-7 h-7 bg-ink flex items-center justify-center text-bright">
                <Stethoscope size={15} />
              </div>
              <span className="font-bold text-ink">Dr. Chen</span>
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

// ==========================================
// Button (Btn) Component
// ==========================================
export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'dangerSoft';
  loading?: boolean;
  loadingLabel?: string;
  icon?: LucideIcon;
  asLink?: string;
}

export function Btn({
  variant = 'primary',
  loading = false,
  loadingLabel,
  icon: Icon,
  disabled,
  children,
  className = '',
  ...rest
}: BtnProps) {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed select-none';

  let variantClasses = '';
  if (variant === 'primary') {
    variantClasses = disabled
      ? 'bg-line text-faint'
      : 'bg-ink text-bright hover:bg-hover-grad active:opacity-90';
  } else if (variant === 'secondary') {
    variantClasses = disabled
      ? 'border border-line text-faint bg-transparent'
      : 'border border-[rgba(23,22,26,0.4)] text-ink bg-transparent hover:bg-ink hover:text-bright';
  } else if (variant === 'dangerSoft') {
    variantClasses = disabled
      ? 'border border-line text-faint bg-transparent'
      : 'border border-danger/50 text-danger bg-transparent hover:bg-danger hover:text-bright';
  }

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner size="sm" />
          <span>{loadingLabel || 'Loading…'}</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={16} />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}

// ==========================================
// Spinner Component (rotating square)
// ==========================================
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-3.5 h-3.5 border-2' : size === 'lg' ? 'w-8 h-8 border-3' : 'w-5 h-5 border-2';
  return (
    <div
      className={`inline-block ${dim} border-[rgba(23,22,26,0.15)] border-t-brand animate-spin`}
      style={{ borderRadius: 0 }}
      role="status"
      aria-label="Loading"
    />
  );
}

// ==========================================
// SectionCard Component
// ==========================================
export interface SectionCardProps {
  title?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, badge, children, className = '' }: SectionCardProps) {
  return (
    <div className={`bg-panel border border-line p-5 space-y-3 ${className}`}>
      {(title || badge) && (
        <div className="flex items-center justify-between pb-2 border-b border-line">
          {title && <h3 className="text-base font-extrabold text-ink">{title}</h3>}
          {badge && <div>{badge}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

// ==========================================
// StatusChip Component
// ==========================================
export interface StatusChipProps {
  status?: NoteStatus | 'processing' | 'pending' | string;
  className?: string;
}

export function StatusChip({ status, className = '' }: StatusChipProps) {
  if (status === 'urgent_review') {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-danger text-bright ${className}`}>
        Urgent review
      </span>
    );
  }
  if (status === 'ai_draft') {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-brand/10 text-brand ${className}`}>
        AI draft
      </span>
    );
  }
  if (status === 'reviewed') {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-positive/10 text-positive ${className}`}>
        Reviewed
      </span>
    );
  }
  if (status === 'processing') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-line text-faint ${className}`}>
        <Spinner size="sm" />
        <span>Processing</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium border border-line text-faint ${className}`}>
      Pending
    </span>
  );
}

// ==========================================
// RiskBadge Component
// ==========================================
export interface RiskBadgeProps {
  level?: RiskLevel;
  className?: string;
}

export function RiskBadge({ level = 'none', className = '' }: RiskBadgeProps) {
  if (level === 'high') {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold bg-danger text-bright ${className}`}>
        High risk
      </span>
    );
  }
  if (level === 'medium') {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-caution/15 text-caution ${className}`}>
        Medium risk
      </span>
    );
  }
  if (level === 'low') {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-positive/10 text-positive ${className}`}>
        Low risk
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium bg-ink/5 text-faint ${className}`}>
      No risk
    </span>
  );
}

// ==========================================
// BulletList Component
// ==========================================
export interface BulletListProps {
  items: string[];
  emptyText?: string;
  bulletColor?: 'brand' | 'danger' | 'caution' | 'positive';
}

export function BulletList({ items, emptyText = 'None recorded.', bulletColor = 'brand' }: BulletListProps) {
  if (!items || items.length === 0) {
    return <p className="text-sm italic text-faint">{emptyText}</p>;
  }

  const colorClass =
    bulletColor === 'danger'
      ? 'bg-danger'
      : bulletColor === 'caution'
      ? 'bg-caution'
      : bulletColor === 'positive'
      ? 'bg-positive'
      : 'bg-brand';

  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2.5 text-sm text-body">
          <span className={`w-1.5 h-1.5 mt-1.5 shrink-0 ${colorClass}`} />
          <span className="leading-snug">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ==========================================
// StatCard Component
// ==========================================
export interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  topColor?: 'brand' | 'caution' | 'danger' | 'positive';
  iconColor?: string;
}

export function StatCard({ label, value, icon: Icon, topColor, iconColor }: StatCardProps) {
  const borderTop = topColor
    ? topColor === 'danger'
      ? 'border-t-4 border-t-danger'
      : topColor === 'caution'
      ? 'border-t-4 border-t-caution'
      : topColor === 'positive'
      ? 'border-t-4 border-t-positive'
      : 'border-t-4 border-t-brand'
    : '';

  return (
    <div className={`bg-panel border border-line p-5 flex flex-col justify-between ${borderTop}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-faint">{label}</span>
        <Icon size={20} className={iconColor || 'text-faint'} />
      </div>
      <div className="text-4xl font-light font-numeral text-ink mt-3">
        {value}
      </div>
    </div>
  );
}

// ==========================================
// StepProgress Component (4 segments)
// ==========================================
export interface StepProgressProps {
  currentStep: 'form' | 'consent' | 'calling' | 'complete';
  onStepClick?: (step: 'form' | 'consent' | 'calling' | 'complete') => void;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  const steps: Array<{ id: 'form' | 'consent' | 'calling' | 'complete'; label: string }> = [
    { id: 'form', label: 'Form' },
    { id: 'consent', label: 'Consent' },
    { id: 'calling', label: 'Check-in' },
    { id: 'complete', label: 'Done' },
  ];

  const order = ['form', 'consent', 'calling', 'complete'];
  const currentIndex = order.indexOf(currentStep);

  return (
    <div className="grid grid-cols-4 gap-px bg-line border border-line">
      {steps.map((s, idx) => {
        const isActive = s.id === currentStep;
        const isDone = currentIndex > idx;

        let bgClass = 'bg-panel text-faint';
        if (isActive) {
          bgClass = 'bg-ink text-bright';
        } else if (isDone) {
          bgClass = 'bg-bright text-ink';
        }

        return (
          <div
            key={s.id}
            className={`py-3 px-3 flex items-center justify-center gap-2 text-xs font-semibold select-none ${bgClass}`}
          >
            {isDone ? (
              <Check size={14} className="text-positive shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 bg-current shrink-0" />
            )}
            <span>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// EmptyState Component
// ==========================================
export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-panel border border-line p-10 text-center flex flex-col items-center justify-center space-y-3">
      <div className="w-12 h-12 bg-line/40 flex items-center justify-center text-faint">
        <Icon size={24} />
      </div>
      <h4 className="text-base font-bold text-ink">{title}</h4>
      {description && <p className="text-sm text-body max-w-sm">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

// ==========================================
// IconSquareInputRow Component
// ==========================================
export interface IconSquareInputRowProps {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  iconDark?: boolean;
}

export function IconSquareInputRow({ icon: Icon, label, children, iconDark = false }: IconSquareInputRowProps) {
  return (
    <div className="flex border border-line bg-bright">
      <div
        className={`w-13 h-13 shrink-0 flex items-center justify-center border-r border-line ${
          iconDark ? 'bg-ink text-bright' : 'bg-panel text-body'
        }`}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1 px-4 py-2 flex flex-col justify-center min-w-0">
        <label className="text-xs font-medium text-faint block">{label}</label>
        {children}
      </div>
    </div>
  );
}
