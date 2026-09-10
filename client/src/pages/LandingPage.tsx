import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, GitBranch, ArrowRight, Layers } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-canvas text-ink font-sans overflow-y-auto text-xs selection:bg-lime/40">
      {/* Top Marketing Navigation Header */}
      <header className="border-b border-borderWarm bg-surface/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-olive flex items-center justify-center font-black text-white shadow-sm">
              TMP
            </div>
            <div>
              <span className="font-black text-base tracking-tight text-ink">TMP</span>
              <span className="editorial-eyebrow text-[9px] block text-ink/60 -mt-1">[ OPERATING SYSTEM ]</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8 font-bold text-ink/75 text-xs">
            <a href="#features" className="hover:text-olive transition-colors">Architecture</a>
            <a href="#engineering" className="hover:text-olive transition-colors">Engineering</a>
            <a href="#ai" className="hover:text-olive transition-colors">Intelligence</a>
            <a href="#pricing" className="hover:text-olive transition-colors">Editions</a>
          </nav>

          <div className="flex items-center space-x-3">
            <Link to="/login" className="btn-pill-secondary py-2 px-4 text-xs font-bold">
              Sign In
            </Link>
            <Link
              to="/signup"
              className="btn-pill-primary py-2 px-5 text-xs font-bold shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 px-6 max-w-5xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-surface border border-borderWarm rounded-full text-ink font-bold text-[11px] shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-olive" />
          <span className="editorial-eyebrow text-[10px]">[ ENGINEERING OPERATING SYSTEM ]</span>
        </div>

        <h1 className="editorial-headline text-4xl sm:text-6xl font-black text-ink leading-tight tracking-tight">
          Run your team with clarity.
        </h1>

        <p className="text-sm md:text-base text-ink/70 max-w-2xl mx-auto leading-relaxed font-sans">
          The modern operating system for high-velocity engineering teams. Unified work telemetry, WIP-limited Kanban, GitHub code events, and permission-aware AI.
        </p>

        <div className="flex justify-center items-center gap-3 pt-4">
          <Link
            to="/signup"
            className="btn-pill-primary flex items-center space-x-2 py-3 px-6 text-sm font-bold shadow-md"
          >
            <span>Open Operating Console</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="btn-pill-secondary py-3 px-6 text-sm font-bold"
          >
            Team Sign In
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-20 px-6 max-w-6xl mx-auto space-y-10 border-t border-borderWarm">
        <div className="text-center space-y-2">
          <div className="editorial-eyebrow mb-1">[ CAPABILITIES ]</div>
          <h2 className="editorial-headline text-2xl md:text-3xl font-black text-ink">Built for Engineering Discipline</h2>
          <p className="text-xs text-ink/65 max-w-xl mx-auto">Engineered from first principles for delivery transparency, empirical metrics, and private governance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="panel-cream p-6 space-y-3">
            <div className="p-2.5 bg-lime/30 border border-borderWarm rounded-2xl w-fit text-olive">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-ink uppercase tracking-wider">DevOps Work Hierarchy</h3>
            <p className="text-ink/70 text-xs leading-relaxed">Epics, Features, Stories, Tasks, Bugs, Subtasks, Backlogs, WIP-limited Kanban boards, and sprint cycles.</p>
          </div>

          <div className="panel-cream p-6 space-y-3">
            <div className="p-2.5 bg-lime/30 border border-borderWarm rounded-2xl w-fit text-olive">
              <GitBranch className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-ink uppercase tracking-wider">Git & Cloud Sync</h3>
            <p className="text-ink/70 text-xs leading-relaxed">Auto-link branches, commits, pull requests, Google Meet video conferences, and calendar schedules.</p>
          </div>

          <div className="panel-cream p-6 space-y-3">
            <div className="p-2.5 bg-lime/30 border border-borderWarm rounded-2xl w-fit text-olive">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-ink uppercase tracking-wider">Telemetry AI Copilot</h3>
            <p className="text-ink/70 text-xs leading-relaxed">Permission-grounded AI Copilot for project risk analysis, team capacity inspection, and confirmed task creation.</p>
          </div>
        </div>
      </section>

      {/* Pricing Grid */}
      <section id="pricing" className="py-20 px-6 max-w-6xl mx-auto space-y-10 border-t border-borderWarm">
        <div className="text-center space-y-2">
          <div className="editorial-eyebrow mb-1">[ COMMERCIAL TIERS ]</div>
          <h2 className="editorial-headline text-2xl md:text-3xl font-black text-ink">Transparent Commercial Pricing</h2>
          <p className="text-xs text-ink/65">Flat, honest engineering tiers. Zero hidden seats.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-cream p-6 space-y-4">
            <div className="font-black text-ink uppercase tracking-wider text-xs">Starter</div>
            <div className="text-3xl font-black text-ink">$0 <span className="text-xs font-normal text-ink/60">/ forever</span></div>
            <p className="text-xs text-ink/65">Up to 5 team members & 3 active projects.</p>
            <Link to="/signup" className="btn-pill-secondary block text-center w-full py-2.5 font-bold text-xs">Get Started</Link>
          </div>

          <div className="panel-cream p-6 space-y-4 border-2 border-olive relative shadow-md">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-olive text-white font-bold text-[10px] rounded-full uppercase tracking-wider">RECOMMENDED</span>
            <div className="font-black text-ink uppercase tracking-wider text-xs">Engineering Team</div>
            <div className="text-3xl font-black text-olive">$15 <span className="text-xs font-normal text-ink/60">/ member / mo</span></div>
            <p className="text-xs text-ink/65">Up to 25 members, unlimited projects, AI Copilot, Git telemetry.</p>
            <Link to="/signup" className="btn-pill-primary block text-center w-full py-2.5 font-bold text-xs shadow-sm">Start Free Trial</Link>
          </div>

          <div className="card-cream p-6 space-y-4">
            <div className="font-black text-ink uppercase tracking-wider text-xs">Enterprise</div>
            <div className="text-3xl font-black text-ink">Custom</div>
            <p className="text-xs text-ink/65">Unlimited members, SSO, strict tenant isolation, dedicated support.</p>
            <Link to="/signup" className="btn-pill-secondary block text-center w-full py-2.5 font-bold text-xs">Contact Sales</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-borderWarm text-center text-ink/50 text-xs font-sans">
        © 2026 TMP Inc. The modern operating system for engineering teams.
      </footer>
    </div>
  );
};

