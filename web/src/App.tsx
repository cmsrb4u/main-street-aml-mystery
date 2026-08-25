import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Database,
  FileSearch,
  Fingerprint,
  Flower2,
  Landmark,
  Layers3,
  LoaderCircle,
  LogOut,
  Play,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  WashingMachine,
  Wrench,
  X,
} from 'lucide-react';

import { analyzeCase } from './api';
import type {
  AnalysisResponse,
  Finding,
  RuntimeConfig,
  SuspectBusiness,
} from './types';

const DEFAULT_PROMPT =
  'Compare all four owners, inspect their transactions and invoices, identify the strongest evidence-backed subject, and explain why the obvious suspect may be a red herring.';

const SUSPECTS = [
  {
    id: 'FELIX',
    owner: 'Felix Flowers',
    business: 'Petal Pushers',
    category: 'Retail florist',
    accent: 'rose',
    alibi:
      'I sell flowers. Of course I receive cash. Love is expensive—and panic-buying roses is my business model.',
  },
  {
    id: 'MARIO',
    owner: 'Mario Wrench',
    business: 'Pipe Dreams Plumbing',
    category: 'Trade services',
    accent: 'blue',
    alibi:
      'That $12,000 purchase was professional plumbing equipment. The heated cup holder was essential.',
  },
  {
    id: 'LARRY',
    owner: 'Larry Suds',
    business: 'Suds & Buds Laundromat',
    category: 'Cash-intensive service',
    accent: 'violet',
    alibi:
      'I run a laundromat. I launder clothes, not money. Frankly, this investigation feels targeted.',
  },
  {
    id: 'TONY',
    owner: 'Tony Salsa',
    business: 'Taco Emergency',
    category: 'Quick-service restaurant',
    accent: 'orange',
    alibi:
      "Midnight deposits are normal. Taco emergencies don't follow banking hours.",
  },
] as const;

interface AppProps {
  config: RuntimeConfig;
  username: string;
  signOut: () => void;
}

function formatUsd(value: number | null): string {
  if (value === null) return 'Not applicable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function labelFor(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function SuspectIcon({ id }: { id: string }) {
  if (id === 'FELIX') return <Flower2 aria-hidden="true" />;
  if (id === 'MARIO') return <Wrench aria-hidden="true" />;
  if (id === 'LARRY') return <WashingMachine aria-hidden="true" />;
  return <UtensilsCrossed aria-hidden="true" />;
}

function FindingPanel({ finding }: { finding: Finding }) {
  return (
    <article className="finding-panel">
      <div className="finding-header">
        <div>
          <span className="finding-type">{labelFor(finding.finding_type)}</span>
          <h3>{finding.title}</h3>
          <span className="finding-subject">{finding.business_name}</span>
        </div>
        <span className="evidence-count">
          {finding.evidence_ids.length} evidence items
        </span>
      </div>
      <p>{finding.explanation}</p>
      <dl className="finding-metrics">
        <div>
          <dt>Cash credits</dt>
          <dd>{finding.cash_credit_count}</dd>
        </div>
        <div>
          <dt>Cash total</dt>
          <dd>{formatUsd(finding.cash_credit_total_usd)}</dd>
        </div>
        <div>
          <dt>Outbound wire</dt>
          <dd>{formatUsd(finding.outbound_wire_usd)}</dd>
        </div>
        <div>
          <dt>Movement ratio</dt>
          <dd>
            {finding.movement_ratio_percent === null
              ? 'Not applicable'
              : `${finding.movement_ratio_percent}%`}
          </dd>
        </div>
      </dl>
      <div className="evidence-row">
        {finding.evidence_ids.map((id) => (
          <span key={id}>{id}</span>
        ))}
      </div>
    </article>
  );
}

function SuspectCard({
  suspect,
  index,
}: {
  suspect: (typeof SUSPECTS)[number];
  index: number;
}) {
  return (
    <article className={`suspect-card tone-${suspect.accent}`}>
      <div className="suspect-card-topline">
        <span className="suspect-number">0{index + 1}</span>
        <span className="review-state">
          <span aria-hidden="true" />
          Awaiting review
        </span>
      </div>
      <div className="suspect-identity">
        <div className="suspect-icon">
          <SuspectIcon id={suspect.id} />
        </div>
        <div>
          <span>{suspect.business}</span>
          <h3>{suspect.owner}</h3>
          <small>{suspect.category}</small>
        </div>
      </div>
      <blockquote>“{suspect.alibi}”</blockquote>
      <div className="suspect-card-footer">
        <span>Open profile</span>
        <ChevronRight aria-hidden="true" />
      </div>
    </article>
  );
}

function EmptyResult({
  isRunning,
  runAnalysis,
}: {
  isRunning: boolean;
  runAnalysis: () => void;
}) {
  return (
    <div className="mystery-intro">
      <section className="intro-hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="live-dot" aria-hidden="true" />
            Case file open
            <span className="hero-kicker-divider" />
            SYNTH-AML-005
          </div>
          <span className="section-label">Synthetic AML mystery</span>
          <h1>
            Who <em>laundered</em> it?
          </h1>
          <p>
            Four Main Street owners. Four convincing stories. One money trail
            that does not add up. Let evidence—not appearances—lead the review.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="hero-primary-button"
              disabled={isRunning}
              onClick={runAnalysis}
            >
              {isRunning ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : (
                <Radar aria-hidden="true" />
              )}
              {isRunning ? 'Inspecting evidence' : 'Begin evidence scan'}
            </button>
            <span className="agent-ready">
              <BadgeCheck aria-hidden="true" />
              Grounded agent ready
            </span>
          </div>
          <dl className="hero-stats">
            <div>
              <dt>Subjects</dt>
              <dd>04</dd>
            </div>
            <div>
              <dt>Evidence types</dt>
              <dd>02</dd>
            </div>
            <div>
              <dt>Decision</dt>
              <dd>Human</dd>
            </div>
          </dl>
        </div>

        <div className="hero-dossier" aria-hidden="true">
          <div className="dossier-glow" />
          <div className="dossier-card dossier-card-back">
            <span>Evidence index</span>
            <Database />
          </div>
          <div className="dossier-card dossier-card-middle">
            <span>Transaction trail</span>
            <Activity />
          </div>
          <div className="dossier-card dossier-card-front">
            <div className="dossier-label">
              <Fingerprint />
              <span>Confidential case brief</span>
            </div>
            <strong>SYNTH<br />AML–005</strong>
            <div className="dossier-lines">
              <span />
              <span />
              <span />
            </div>
            <div className="dossier-stamp">Synthetic</div>
          </div>
        </div>
      </section>

      <section className="protocol-strip" aria-label="Investigation workflow">
        <div className="protocol-step active">
          <span>01</span>
          <div>
            <strong>Meet the lineup</strong>
            <small>Review the business stories</small>
          </div>
        </div>
        <ChevronRight aria-hidden="true" />
        <div className="protocol-step">
          <span>02</span>
          <div>
            <strong>Inspect the trail</strong>
            <small>Compare transactions and invoices</small>
          </div>
        </div>
        <ChevronRight aria-hidden="true" />
        <div className="protocol-step">
          <span>03</span>
          <div>
            <strong>Ground the decision</strong>
            <small>Escalate for qualified review</small>
          </div>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <span className="section-label">Persons of interest</span>
            <h2>The Main Street lineup</h2>
          </div>
          <span className="status-badge">
            <Layers3 aria-hidden="true" />
            Four linked business profiles
          </span>
        </div>
        <div className="suspect-grid">
          {SUSPECTS.map((suspect, index) => (
            <SuspectCard key={suspect.id} suspect={suspect} index={index} />
          ))}
        </div>
      </section>

      <section className="method-note">
        <div className="method-icon">
          <ShieldCheck aria-hidden="true" />
        </div>
        <div>
          <span className="section-label">Investigation standard</span>
          <h2>Follow the evidence, challenge the obvious answer.</h2>
          <p>
            The agent compares transaction velocity, cash behavior, outbound
            movement, and invoice support. Names, occupations, and intuition
            are never treated as proof.
          </p>
        </div>
        <div className="method-control">
          <span>Control posture</span>
          <strong>Evidence grounded</strong>
          <small>Human decision required</small>
        </div>
      </section>
    </div>
  );
}

function evidenceSummary(suspect: SuspectBusiness) {
  const cashCredits = suspect.transactions.filter(
    (transaction) =>
      transaction.direction === 'CREDIT' && transaction.channel === 'CASH',
  );
  const wires = suspect.transactions.filter(
    (transaction) =>
      transaction.direction === 'DEBIT' && transaction.channel === 'WIRE',
  );
  const invoiceStatuses = new Set(
    suspect.invoices.map((invoice) => invoice.verification_status),
  );

  return {
    cashCount: cashCredits.length,
    cashTotal: cashCredits.reduce(
      (total, transaction) => total + transaction.amount,
      0,
    ),
    largestWire:
      wires.length === 0
        ? null
        : Math.max(...wires.map((transaction) => transaction.amount)),
    invoiceStatus: invoiceStatuses.has('MISMATCH')
      ? 'Mismatch'
      : invoiceStatuses.has('PENDING')
        ? 'Pending support'
        : 'Matched',
  };
}

function EvidenceComparison({ result }: { result: AnalysisResponse }) {
  return (
    <section className="evidence-section">
      <div className="section-heading">
        <div>
          <span className="section-label">Comparative evidence</span>
          <h2>What the agent inspected</h2>
        </div>
        <span className="status-badge">
          <ShieldCheck aria-hidden="true" />
          Synthetic records
        </span>
      </div>
      <div className="evidence-grid">
        {result.case.suspects.map((suspect) => {
          const summary = evidenceSummary(suspect);
          const isPrimary =
            suspect.id === result.assessment.primary_subject_id;
          const isRedHerring =
            suspect.owner_name === result.assessment.red_herring_subject;

          return (
            <article
              className={`evidence-card${isPrimary ? ' primary' : ''}`}
              key={suspect.id}
            >
              <div className="evidence-card-heading">
                <span className="suspect-icon compact">
                  <SuspectIcon id={suspect.id} />
                </span>
                <div>
                  <strong>{suspect.owner_name}</strong>
                  <span>{suspect.business_name}</span>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Cash activity</dt>
                  <dd>
                    {summary.cashCount} credits · {formatUsd(summary.cashTotal)}
                  </dd>
                </div>
                <div>
                  <dt>Largest wire</dt>
                  <dd>{formatUsd(summary.largestWire)}</dd>
                </div>
                <div>
                  <dt>Invoice support</dt>
                  <dd>{summary.invoiceStatus}</dd>
                </div>
              </dl>
              <span
                className={`evidence-verdict${isPrimary ? ' flagged' : ''}`}
              >
                {isPrimary
                  ? 'Escalate for review'
                  : isRedHerring
                    ? 'Red herring — no demo signal'
                    : 'No demo signal'}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Results({ result }: { result: AnalysisResponse }) {
  const checksPassed = Object.values(result.validation).filter(Boolean).length;
  const checkCount = Object.keys(result.validation).length;

  return (
    <div className="results">
      <section className="verdict-banner">
        <div className="verdict-icon">
          <Flower2 aria-hidden="true" />
        </div>
        <div>
          <span className="section-label">The evidence-backed reveal</span>
          <h1>{result.assessment.primary_subject}</h1>
          <p>
            Owner of Petal Pushers. Larry Suds was the obvious suspect—but the
            deterministic transaction checks point elsewhere.
          </p>
        </div>
        <div className="red-herring">
          <span>Red herring</span>
          <strong>{result.assessment.red_herring_subject}</strong>
        </div>
      </section>

      <section className="summary-band">
        <div>
          <span className="section-label">Assessment</span>
          <h2>{labelFor(result.assessment.assessment_posture)}</h2>
          <p>{result.assessment.executive_summary}</p>
        </div>
        <div className="summary-meta">
          <div>
            <span>Model</span>
            <strong>{result.model ?? 'Deterministic fixture'}</strong>
          </div>
          <div>
            <span>Validation</span>
            <strong>
              {checksPassed}/{checkCount} passed
            </strong>
          </div>
        </div>
      </section>

      <EvidenceComparison result={result} />

      <section className="result-section">
        <div className="section-heading">
          <div>
            <span className="section-label">Grounded review</span>
            <h2>Why Felix was flagged</h2>
          </div>
          <span className="status-badge">
            <ShieldCheck aria-hidden="true" />
            Evidence validated
          </span>
        </div>
        <div className="finding-list">
          {result.assessment.findings.map((finding) => (
            <FindingPanel key={finding.finding_type} finding={finding} />
          ))}
        </div>
      </section>

      <section className="two-column-section">
        <div>
          <span className="section-label">Open questions</span>
          <h2>Information gaps</h2>
          <ul className="action-list gap-list">
            {result.assessment.information_gaps.map((gap) => (
              <li key={gap}>
                <AlertTriangle aria-hidden="true" />
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="section-label">Human workflow</span>
          <h2>Recommended next steps</h2>
          <ul className="action-list">
            {result.assessment.recommended_next_steps.map((step) => (
              <li key={step}>
                <ArrowRight aria-hidden="true" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="validation-section">
        <div className="section-heading">
          <div>
            <span className="section-label">Control results</span>
            <h2>Validation checks</h2>
          </div>
          <span className="decision-label">
            Filing: {labelFor(result.assessment.filing_decision)}
          </span>
        </div>
        <div className="validation-grid">
          {Object.entries(result.validation).map(([name, passed]) => (
            <div className="validation-item" key={name}>
              {passed ? (
                <CheckCircle2 aria-hidden="true" />
              ) : (
                <X aria-hidden="true" />
              )}
              <span>{labelFor(name)}</span>
              <strong>{passed ? 'Passed' : 'Failed'}</strong>
            </div>
          ))}
        </div>
        <p className="notice">{result.notice}</p>
      </section>
    </div>
  );
}

export default function App({ config, username, signOut }: AppProps) {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runAnalysis() {
    setError(null);
    setIsRunning(true);
    try {
      setResult(await analyzeCase(config, prompt));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The analysis request failed.',
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Fingerprint aria-hidden="true" />
          </span>
          <div>
            <strong>Main Street AML Mystery</strong>
            <span>Evidence intelligence workspace</span>
          </div>
        </div>
        <div className="topbar-case">
          <span className="topbar-pulse" aria-hidden="true" />
          <span>Case workspace</span>
          <strong>SYNTH-AML-005</strong>
        </div>
        <div className="user-menu">
          <span className="secure-session">
            <ShieldCheck aria-hidden="true" />
            Secure session
          </span>
          <CircleUserRound aria-hidden="true" />
          <span>{username}</span>
          <button type="button" className="icon-button" onClick={signOut}>
            <LogOut aria-hidden="true" />
            <span className="sr-only">Sign out</span>
            <span className="tooltip">Sign out</span>
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="case-sidebar">
          <div className="case-title">
            <div>
              <span className="section-label">Active investigation</span>
              <h1>SYNTH-AML-005</h1>
            </div>
            <span className="synthetic-badge">
              <Sparkles aria-hidden="true" />
              Synthetic
            </span>
          </div>
          <dl className="case-facts">
            <div>
              <dt><CircleUserRound aria-hidden="true" /> Investigator</dt>
              <dd>Detective Dan Ledger</dd>
            </div>
            <div>
              <dt><Landmark aria-hidden="true" /> Location</dt>
              <dd>Main Street</dd>
            </div>
            <div>
              <dt><FileSearch aria-hidden="true" /> Review scope</dt>
              <dd>Four business owners</dd>
            </div>
            <div>
              <dt><Clock3 aria-hidden="true" /> Case status</dt>
              <dd>Ready for evidence scan</dd>
            </div>
          </dl>

          <div className="sidebar-section-heading">
            <span>Subject lineup</span>
            <small>4 profiles</small>
          </div>
          <div className="mini-lineup">
            {SUSPECTS.map((suspect, index) => (
              <div key={suspect.id} className={`tone-${suspect.accent}`}>
                <span className="lineup-index">0{index + 1}</span>
                <span className="suspect-icon compact">
                  <SuspectIcon id={suspect.id} />
                </span>
                <span>
                  <strong>{suspect.owner}</strong>
                  <small>{suspect.business}</small>
                </span>
                <span className="lineup-state" aria-label="Awaiting review" />
              </div>
            ))}
          </div>

          <div className="prompt-area">
            <div className="prompt-heading">
              <span className="prompt-heading-icon">
                <Sparkles aria-hidden="true" />
              </span>
              <div>
                <label htmlFor="analysis-prompt">Agent investigation brief</label>
                <small>Set the focus for this evidence review</small>
              </div>
            </div>
            <textarea
              id="analysis-prompt"
              maxLength={2000}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="prompt-meta">
              <span>{prompt.length}/2000</span>
              <span>Editable briefing</span>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={isRunning || !prompt.trim()}
              onClick={runAnalysis}
            >
              {isRunning ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              {isRunning ? 'Inspecting evidence' : 'Reveal the money trail'}
            </button>
          </div>

          <div className="guardrail-note">
            <ShieldCheck aria-hidden="true" />
            <p>
              <strong>Human-in-the-loop control</strong>
              Synthetic signals support qualified review—not a finding of
              guilt.
            </p>
          </div>
        </aside>

        <section className="result-pane" aria-live="polite">
          {error && (
            <div className="error-banner" role="alert">
              <span className="error-icon">
                <AlertTriangle aria-hidden="true" />
              </span>
              <div className="error-copy">
                <strong>The evidence service did not respond</strong>
                <span>
                  {error} Your case is unchanged; check the connection and try
                  the scan again.
                </span>
              </div>
              <button
                type="button"
                className="error-retry"
                disabled={isRunning}
                onClick={runAnalysis}
              >
                <RefreshCw aria-hidden="true" />
                Retry scan
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => setError(null)}
              >
                <X aria-hidden="true" />
                <span className="sr-only">Dismiss error</span>
              </button>
            </div>
          )}
          {result ? (
            <Results result={result} />
          ) : (
            <EmptyResult isRunning={isRunning} runAnalysis={runAnalysis} />
          )}
        </section>
      </main>
    </div>
  );
}
