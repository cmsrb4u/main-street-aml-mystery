export interface RuntimeConfig {
  apiEndpoint: string;
  region: string;
  signingService: 'lambda';
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
}

export interface Finding {
  finding_type: 'STRUCTURING_SIGNAL' | 'RAPID_MOVEMENT_SIGNAL';
  subject_id: string;
  subject_name: string;
  business_name: string;
  evidence_ids: string[];
  cash_credit_count: number;
  cash_credit_total_usd: number;
  outbound_wire_usd: number | null;
  movement_ratio_percent: number | null;
  title: string;
  explanation: string;
}

export interface Assessment {
  case_id: string;
  primary_subject_id: string;
  primary_subject: string;
  red_herring_subject: string;
  assessment_posture:
    | 'ROUTINE_REVIEW'
    | 'ENHANCED_REVIEW'
    | 'ESCALATE_FOR_QUALIFIED_REVIEW';
  executive_summary: string;
  findings: Finding[];
  information_gaps: string[];
  recommended_next_steps: string[];
  drafting_authorized: false;
  filing_decision: 'NOT_DETERMINED';
}

export interface Transaction {
  id: string;
  timestamp: string;
  direction: 'CREDIT' | 'DEBIT';
  channel: 'CASH' | 'WIRE';
  amount: number;
  currency: string;
  counterparty: string;
  country_code: string;
  memo: string;
}

export interface Invoice {
  id: string;
  issued_at: string;
  counterparty: string;
  amount: number;
  currency: string;
  description: string;
  linked_transaction_id: string | null;
  verification_status: 'MATCHED' | 'MISMATCH' | 'PENDING';
}

export interface SuspectBusiness {
  id: string;
  owner_name: string;
  business_name: string;
  stated_business: string;
  alibi: string;
  transactions: Transaction[];
  invoices: Invoice[];
}

export interface InvestigationCase {
  case_id: string;
  title: string;
  investigator: string;
  alert_reason: string;
  suspects: SuspectBusiness[];
}

export interface AnalysisResponse {
  source: 'bedrock_agent' | 'offline_fixture';
  model: string | null;
  case: InvestigationCase;
  assessment: Assessment;
  validation: Record<string, boolean>;
  notice: string;
  requestId?: string;
}
