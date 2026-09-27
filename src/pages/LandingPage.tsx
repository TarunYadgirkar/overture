import { Link } from 'react-router-dom';
import {
  Mic,
  Activity,
  CreditCard,
  History,
  FileCheck2,
  User,
  Stethoscope,
  ArrowRight,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { VoiceOrb } from '../components/VoiceOrb';
import { CoverageBot } from '../components/CoverageBot';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-[#e6ddca] to-[#e8d2c6] text-ink flex flex-col font-sans">
      {/* Top Bar */}
      <header className="px-6 sm:px-11 py-4 border-b border-line flex items-center justify-between bg-bright/80 backdrop-blur-xs">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-brand inline-block" />
            <span
              className="w-3.5 h-3.5 rounded-full inline-block"
              style={{ background: 'linear-gradient(135deg, #b8862b, #a8342b)' }}
            />
          </div>
          <span className="text-xl font-black tracking-tight text-ink">
            Overture
          </span>
        </Link>
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-faint">
          <span className="w-2 h-2 bg-positive inline-block" />
          <span>Clinical check-in system</span>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_460px] min-h-[calc(100vh-65px)]">
        {/* Left Column */}
        <div className="p-6 sm:p-11 lg:border-r border-line flex flex-col justify-between space-y-8">
          <div className="space-y-6">
            {/* Kicker */}
            <div className="inline-flex items-center gap-2 text-xs font-bold text-danger">
              <Activity size={15} />
              <span>Voice-first pre-visit intake</span>
            </div>

            {/* H1 */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] leading-[0.98] text-ink max-w-xl text-balance">
              The visit starts before the doctor walks in.
            </h1>

            {/* Subhead */}
            <p className="text-base text-body max-w-lg leading-relaxed">
              Three minutes of talking becomes a real FHIR record, a live coverage answer, and a draft SOAP note waiting for the provider.
            </p>

            {/* Pipeline Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line">
              {[
                { icon: Mic, label: 'Talk', descriptor: 'voice' },
                { icon: FileCheck2, label: 'Charted', descriptor: 'FHIR record' },
                { icon: CreditCard, label: 'Costed', descriptor: 'coverage' },
                { icon: History, label: 'Recalled', descriptor: 'history' },
              ].map((tile) => {
                const Icon = tile.icon;
                return (
                  <div
                    key={tile.label}
                    className="p-4 bg-panel hover:bg-ink hover:text-bright transition-colors duration-150 flex flex-col justify-between space-y-2 group cursor-default"
                  >
                    <Icon size={20} className="text-brand group-hover:text-bright" />
                    <div>
                      <div className="text-sm font-bold text-ink group-hover:text-bright">
                        {tile.label}
                      </div>
                      <div className="text-xs text-faint group-hover:text-bright/70">
                        {tile.descriptor}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTAs */}
          <div className="space-y-4 mt-auto pt-6 border-t border-line">
            {/* Primary 2-column CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Patient CTA */}
              <Link
                to="/intake"
                className="relative p-6 bg-bright border border-line flex flex-col justify-between h-36 hover:bg-caution/10 transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-md border-b-5 hover:border-b-caution"
              >
                <div className="flex items-center justify-between">
                  <User size={30} className="text-danger" />
                  <ArrowRight size={20} className="text-faint group-hover:text-ink group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <div className="text-2xl font-black text-ink">I'm a patient</div>
                  <div className="text-xs text-body font-medium mt-0.5">~3 min · voice only</div>
                </div>
              </Link>

              {/* Provider CTA */}
              <Link
                to="/dashboard"
                className="relative p-6 bg-bright border border-line flex flex-col justify-between h-36 hover:bg-brand/10 transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-md border-b-5 hover:border-b-brand"
              >
                <div className="flex items-center justify-between">
                  <Stethoscope size={30} className="text-brand" />
                  <ArrowRight size={20} className="text-faint group-hover:text-ink group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <div className="text-2xl font-black text-ink">I'm a provider</div>
                  <div className="text-xs text-body font-medium mt-0.5">Review the queue</div>
                </div>
              </Link>
            </div>

            {/* Secondary link grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
              <Link
                to="/medcard"
                className="p-4 bg-panel hover:bg-ink hover:text-bright transition-colors duration-150 flex items-center justify-between group"
              >
                <span className="text-sm font-bold">My Med Card</span>
                <ArrowRight size={16} className="text-faint group-hover:text-bright" />
              </Link>
              <Link
                to="/records"
                className="p-4 bg-panel hover:bg-ink hover:text-bright transition-colors duration-150 flex items-center justify-between group"
              >
                <span className="text-sm font-bold">My health records</span>
                <ArrowRight size={16} className="text-faint group-hover:text-bright" />
              </Link>
              <Link
                to="/timeline"
                className="sm:col-span-2 p-4 bg-panel hover:bg-ink hover:text-bright transition-colors duration-150 flex items-center justify-between group border-t border-line sm:border-t-0"
              >
                <span className="text-sm font-bold">Log a symptom on my timeline</span>
                <ArrowRight size={16} className="text-faint group-hover:text-bright" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (Visual Stage) */}
        <div className="flex flex-col bg-ink text-bright justify-between border-t lg:border-t-0 border-line">
          {/* Dark Stage with VoiceOrb */}
          <div className="relative aspect-square w-full flex items-center justify-center bg-gradient-to-br from-ink via-[#3a1f1c] to-[#6b2f22] overflow-hidden">
            {/* Viewfinder corner ticks */}
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-bright/40 pointer-events-none" />
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-bright/40 pointer-events-none" />
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-bright/40 pointer-events-none" />
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-bright/40 pointer-events-none" />

            <VoiceOrb size={220} mode="sim" hoverInteractive={true} />
          </div>

          {/* Info rows */}
          <div className="divide-y divide-line/30 bg-panel/60 backdrop-blur-xs text-ink">
            <div className="px-6 py-4 flex items-center gap-3 text-sm font-medium">
              <Mic size={18} className="text-brand shrink-0" />
              <span>~3 min · voice only</span>
            </div>
            <div className="px-6 py-4 flex items-center gap-3 text-sm font-medium">
              <FileText size={18} className="text-brand shrink-0" />
              <span>Charted your visit as you speak</span>
            </div>
            <div className="px-6 py-4 flex items-center gap-3 text-sm font-medium">
              <CreditCard size={18} className="text-brand shrink-0" />
              <span>Coverage answered live</span>
            </div>
          </div>

          {/* Safety Footer Disclaimer */}
          <div className="p-4 bg-ink/90 border-t border-line/30 text-xs text-bright/80 flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger shrink-0" />
            <div>
              <span>Not a clinician. Synthetic data only. </span>
              <strong className="text-danger font-bold">Emergency 911. Crisis 988.</strong>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Coverage Assistant */}
      <CoverageBot />
    </div>
  );
}
