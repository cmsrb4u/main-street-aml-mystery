import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleUserRound,
  Flower2,
  Landmark,
  LoaderCircle,
  LogOut,
  Play,
  Search,
  ShieldCheck,
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
    alibi:
      'I sell flowers. Of course I receive cash. Love is expensive—and panic-buying roses is my business model.',
  },
  {
    id: 'MARIO',
    owner: 'Mario Wrench',
    business: 'Pipe Dreams Plumbing',
    alibi:
      'That $12,000 purchase was professional plumbing equipment. The heated cup holder was essential.',
  },
  {
    id: 'LARRY',
    owner: 'Larry Suds',
    business: 'Suds & Buds Laundromat',
    alibi:
      'I run a laundromat. I launder clothes, not money. Frankly, this investigation feels targeted.',
  },
  {
    id: 'TONY',
    owner: 'Tony Salsa',
    business: 'Taco Emergency',
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
}: {
  suspect: (typeof SUSPECTS)[number];
}) {
  return (
    <article className="suspect-card">
      <div className="suspect-icon">
        <SuspectIcon id={suspect.id} />
      </div>
      <div>
        <span>{suspect.business}</span>
        <h3>{suspect.owner}</h3>
      </div>
      <p>“{suspect.alibi}”</p>
    </article>
  );
}

function EmptyResult() {
  return (
    <div className="mystery-intro">
      <section className="intro-hero">
        <span className="section-label">Synthetic AML mystery</span>
        <h1>Who Laundered It?</h1>
        <p>
          Four Main Street owners have convincing explanations. Let transaction
          patterns and invoice support—not stereotypes—decide which trail needs
          qualified review.
        </p>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <span className="section-label">The lineup</span>
            <h2>Four owners, one suspicious trail</h2>
          </div>
          <span className="status-badge">
            <Search aria-hidden="true" />
            Evidence hidden until analysis
          </span>
        </div>
        <div className="suspect-grid">
          {SUSPECTS.map((suspect) => (
            <SuspectCard key={suspect.id} suspect={suspect} />
          ))}
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
            <Landmark aria-hidden="true" />
          </span>
          <div>
            <strong>Main Street AML Mystery</strong>
            <span>Who Laundered It?</span>
          </div>
        </div>
        <div className="user-menu">
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
            <span className="section-label">Active case</span>
            <h1>SYNTH-AML-005</h1>
            <span className="synthetic-badge">Synthetic mystery</span>
          </div>
          <dl className="case-facts">
            <div>
              <dt>Investigator</dt>
              <dd>Detective Dan Ledger</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>Main Street</dd>
            </div>
            <div>
              <dt>Lineup</dt>
              <dd>Four business owners</dd>
            </div>
            <div>
              <dt>Question</dt>
              <dd>Whose evidence produces a suspicious money trail?</dd>
            </div>
          </dl>

          <div className="mini-lineup">
            {SUSPECTS.map((suspect) => (
              <div key={suspect.id}>
                <span className="suspect-icon compact">
                  <SuspectIcon id={suspect.id} />
                </span>
                <span>
                  <strong>{suspect.owner}</strong>
                  <small>{suspect.business}</small>
                </span>
              </div>
            ))}
          </div>

          <div className="prompt-area">
            <label htmlFor="analysis-prompt">Detective Dan’s instruction</label>
            <textarea
              id="analysis-prompt"
              maxLength={2000}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="prompt-meta">
              <span>{prompt.length}/2000</span>
              <span>Read-only</span>
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
            <Check aria-hidden="true" />
            <p>
              Synthetic learning asset. Signals support qualified review—not a
              finding of guilt.
            </p>
          </div>
        </aside>

        <section className="result-pane" aria-live="polite">
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>{error}</span>
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
          {result ? <Results result={result} /> : <EmptyResult />}
        </section>
      </main>
    </div>
  );
}
