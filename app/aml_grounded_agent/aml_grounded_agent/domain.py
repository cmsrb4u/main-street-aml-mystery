"""Deterministic evidence and validation logic for the synthetic AML mystery."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DEMO_CASH_AMOUNT_MIN = 9_000
DEMO_CASH_AMOUNT_MAX = 10_000
DEMO_RAPID_MOVEMENT_RATIO = 0.90
DEMO_REQUIRED_CASH_CREDITS = 3
RED_HERRING_SUBJECT = "Larry Suds"


class Transaction(BaseModel):
    """One synthetic transaction used as evidence."""

    id: str
    timestamp: str
    direction: Literal["CREDIT", "DEBIT"]
    channel: Literal["CASH", "WIRE"]
    amount: int = Field(gt=0)
    currency: str
    counterparty: str
    country_code: str
    memo: str


class Invoice(BaseModel):
    """One synthetic invoice or supporting business record."""

    id: str
    issued_at: str
    counterparty: str
    amount: int = Field(gt=0)
    currency: str
    description: str
    linked_transaction_id: str | None
    verification_status: Literal["MATCHED", "MISMATCH", "PENDING"]


class SuspectBusiness(BaseModel):
    """One Main Street owner and the evidence associated with his business."""

    id: str
    owner_name: str
    business_name: str
    stated_business: str
    alibi: str
    transactions: list[Transaction]
    invoices: list[Invoice]


class InvestigationCase(BaseModel):
    """Synthetic comparative case containing four business owners."""

    case_id: str
    title: str
    investigator: str
    alert_reason: str
    suspects: list[SuspectBusiness] = Field(min_length=4, max_length=4)


class TypologySignal(BaseModel):
    """A deterministic signal and the exact facts supporting it."""

    finding_type: Literal["STRUCTURING_SIGNAL", "RAPID_MOVEMENT_SIGNAL"]
    subject_id: str
    subject_name: str
    business_name: str
    evidence_ids: list[str] = Field(min_length=1)
    cash_credit_count: int = Field(ge=0)
    cash_credit_total_usd: int = Field(ge=0)
    outbound_wire_usd: int | None
    movement_ratio_percent: float | None


class Finding(TypologySignal):
    """A model-authored explanation bound to deterministic support fields."""

    title: str
    explanation: str


class RiskAssessment(BaseModel):
    """Structured comparative analysis proposal returned by the model."""

    case_id: str
    primary_subject_id: str
    primary_subject: str
    red_herring_subject: str
    assessment_posture: Literal[
        "ROUTINE_REVIEW",
        "ENHANCED_REVIEW",
        "ESCALATE_FOR_QUALIFIED_REVIEW",
    ]
    executive_summary: str
    findings: list[Finding] = Field(min_length=2, max_length=2)
    information_gaps: list[str] = Field(min_length=1)
    recommended_next_steps: list[str] = Field(min_length=1)
    drafting_authorized: Literal[False]
    filing_decision: Literal["NOT_DETERMINED"]


class InvestigationContext(BaseModel):
    """Request-scoped tenant and case data available to read-only tools."""

    tenant_id: str
    case: InvestigationCase


def build_synthetic_case() -> InvestigationCase:
    """Create the five-character Main Street synthetic mystery."""

    return InvestigationCase(
        case_id="SYNTH-AML-005",
        title="Who Laundered It? — Main Street Mystery",
        investigator="Detective Dan Ledger",
        alert_reason=(
            "Compare cash activity, outbound payments, and invoice support "
            "across four apparently legitimate Main Street businesses."
        ),
        suspects=[
            SuspectBusiness(
                id="FELIX",
                owner_name="Felix Flowers",
                business_name="Petal Pushers",
                stated_business="Retail florist and event arrangements",
                alibi=(
                    "I sell flowers. Of course I receive cash. Love is "
                    "expensive—and panic-buying roses is my business model."
                ),
                transactions=[
                    Transaction(
                        id="TXN-FLX-001",
                        timestamp="2026-08-18T09:12:00Z",
                        direction="CREDIT",
                        channel="CASH",
                        amount=9200,
                        currency="USD",
                        counterparty="Unidentified cash batch A",
                        country_code="US",
                        memo="Counter deposit without customer detail",
                    ),
                    Transaction(
                        id="TXN-FLX-002",
                        timestamp="2026-08-18T11:08:00Z",
                        direction="CREDIT",
                        channel="CASH",
                        amount=9500,
                        currency="USD",
                        counterparty="Unidentified cash batch B",
                        country_code="US",
                        memo="Counter deposit without customer detail",
                    ),
                    Transaction(
                        id="TXN-FLX-003",
                        timestamp="2026-08-18T13:46:00Z",
                        direction="CREDIT",
                        channel="CASH",
                        amount=9700,
                        currency="USD",
                        counterparty="Unidentified cash batch C",
                        country_code="US",
                        memo="Counter deposit without customer detail",
                    ),
                    Transaction(
                        id="TXN-FLX-004",
                        timestamp="2026-08-18T16:02:00Z",
                        direction="DEBIT",
                        channel="WIRE",
                        amount=27900,
                        currency="USD",
                        counterparty="Verdant Export Consulting",
                        country_code="NL",
                        memo="Imported floral inventory",
                    ),
                ],
                invoices=[
                    Invoice(
                        id="INV-FLX-101",
                        issued_at="2026-08-18T08:00:00Z",
                        counterparty="Various walk-in customers",
                        amount=9200,
                        currency="USD",
                        description="Aggregated retail flower sales",
                        linked_transaction_id="TXN-FLX-001",
                        verification_status="PENDING",
                    ),
                    Invoice(
                        id="INV-FLX-102",
                        issued_at="2026-08-18T08:10:00Z",
                        counterparty="Various event customers",
                        amount=9500,
                        currency="USD",
                        description="Aggregated event deposits",
                        linked_transaction_id="TXN-FLX-002",
                        verification_status="PENDING",
                    ),
                    Invoice(
                        id="INV-FLX-103",
                        issued_at="2026-08-18T08:20:00Z",
                        counterparty="Various corporate customers",
                        amount=9700,
                        currency="USD",
                        description="Aggregated corporate arrangements",
                        linked_transaction_id="TXN-FLX-003",
                        verification_status="PENDING",
                    ),
                    Invoice(
                        id="INV-FLX-104",
                        issued_at="2026-08-17T14:30:00Z",
                        counterparty="Verdant Export Consulting",
                        amount=14250,
                        currency="USD",
                        description="Bulk imported peonies",
                        linked_transaction_id="TXN-FLX-004",
                        verification_status="MISMATCH",
                    ),
                ],
            ),
            SuspectBusiness(
                id="MARIO",
                owner_name="Mario Wrench",
                business_name="Pipe Dreams Plumbing",
                stated_business="Residential and commercial plumbing",
                alibi=(
                    "That $12,000 purchase was professional plumbing "
                    "equipment. The heated cup holder was essential."
                ),
                transactions=[
                    Transaction(
                        id="TXN-MAR-001",
                        timestamp="2026-08-15T10:05:00Z",
                        direction="CREDIT",
                        channel="CASH",
                        amount=3800,
                        currency="USD",
                        counterparty="Residential service receipts",
                        country_code="US",
                        memo="Weekly cash service receipts",
                    ),
                    Transaction(
                        id="TXN-MAR-002",
                        timestamp="2026-08-16T15:30:00Z",
                        direction="CREDIT",
                        channel="CASH",
                        amount=6200,
                        currency="USD",
                        counterparty="Commercial repair receipts",
                        country_code="US",
                        memo="Documented repair receipts",
                    ),
                    Transaction(
                        id="TXN-MAR-003",
                        timestamp="2026-08-19T14:20:00Z",
                        direction="DEBIT",
                        channel="WIRE",
                        amount=12000,
                        currency="USD",
                        counterparty="WrenchWorks Equipment",
                        country_code="US",
                        memo="Professional plumbing equipment",
                    ),
                ],
                invoices=[
                    Invoice(
                        id="INV-MAR-201",
                        issued_at="2026-08-19T09:15:00Z",
                        counterparty="WrenchWorks Equipment",
                        amount=12000,
                        currency="USD",
                        description=(
                            "Pipe inspection rig, hydro-jet unit, and heated "
                            "service-vehicle cup holder"
                        ),
                        linked_transaction_id="TXN-MAR-003",
                        verification_status="MATCHED",
                    )
                ],
            ),
            SuspectBusiness(
                id="LARRY",
                owner_name="Larry Suds",
                business_name="Suds & Buds Laundromat",
                stated_business="Coin laundry and wash-and-fold service",
                alibi=(
                    "I run a laundromat. I launder clothes, not money. "
                    "Frankly, this investigation feels targeted."
                ),
                transactions=[
                    Transaction(
                        id="TXN-LAR-001",
                        timestamp="2026-08-17T18:05:00Z",
                        direction="CREDIT",
                        channel="CASH",
                        amount=2350,
                        currency="USD",
                        counterparty="Coin machine collection",
                        country_code="US",
                        memo="Monday machine collection",
                    ),
                    Transaction(
                        id="TXN-LAR-002",
                        timestamp="2026-08-18T18:10:00Z",
                        direction="CREDIT",
                        channel="CASH",
                        amount=2110,
                        currency="USD",
                        counterparty="Coin machine collection",
                        country_code="US",
                        memo="Tuesday machine collection",
                    ),
                    Transaction(
                        id="TXN-LAR-003",
                        timestamp="2026-08-19T18:02:00Z",
                        direction="CREDIT",
                        channel="CASH",
                        amount=2480,
                        currency="USD",
                        counterparty="Coin and wash-fold receipts",
                        country_code="US",
                        memo="Wednesday reconciled receipts",
                    ),
                    Transaction(
                        id="TXN-LAR-004",
                        timestamp="2026-08-20T12:25:00Z",
                        direction="DEBIT",
                        channel="WIRE",
                        amount=3400,
                        currency="USD",
                        counterparty="Main Street Utilities",
                        country_code="US",
                        memo="Monthly water and electricity bill",
                    ),
                ],
                invoices=[
                    Invoice(
                        id="INV-LAR-301",
                        issued_at="2026-08-20T08:30:00Z",
                        counterparty="Main Street Utilities",
                        amount=3400,
                        currency="USD",
                        description="Water and electricity service",
                        linked_transaction_id="TXN-LAR-004",
                        verification_status="MATCHED",
                    )
                ],
            ),
            SuspectBusiness(
                id="TONY",
                owner_name="Tony Salsa",
                business_name="Taco Emergency",
                stated_business="Late-night restaurant and delivery",
                alibi=(
                    "Midnight deposits are normal. Taco emergencies don't "
                    "follow banking hours."
                ),
                transactions=[
                    Transaction(
                        id="TXN-TON-001",
                        timestamp="2026-08-16T00:22:00Z",
                        direction="CREDIT",
                        channel="CASH",
                        amount=6400,
                        currency="USD",
                        counterparty="Weekend register receipts",
                        country_code="US",
                        memo="Late-night deposit matched to POS closeout",
                    ),
                    Transaction(
                        id="TXN-TON-002",
                        timestamp="2026-08-20T00:41:00Z",
                        direction="CREDIT",
                        channel="CASH",
                        amount=7200,
                        currency="USD",
                        counterparty="Weeknight register receipts",
                        country_code="US",
                        memo="Late-night deposit matched to POS closeout",
                    ),
                    Transaction(
                        id="TXN-TON-003",
                        timestamp="2026-08-20T13:10:00Z",
                        direction="DEBIT",
                        channel="WIRE",
                        amount=11000,
                        currency="USD",
                        counterparty="Abuela Foods Distribution",
                        country_code="US",
                        memo="Food and beverage inventory",
                    ),
                ],
                invoices=[
                    Invoice(
                        id="INV-TON-401",
                        issued_at="2026-08-20T07:45:00Z",
                        counterparty="Abuela Foods Distribution",
                        amount=11000,
                        currency="USD",
                        description="Produce, tortillas, meat, and beverages",
                        linked_transaction_id="TXN-TON-003",
                        verification_status="MATCHED",
                    )
                ],
            ),
        ],
    )


def new_investigation_context() -> InvestigationContext:
    """Create isolated state for one invocation."""

    return InvestigationContext(
        tenant_id="SYNTHETIC-TENANT-001",
        case=build_synthetic_case(),
    )


def parse_transaction_timestamp(value: str) -> datetime:
    """Parse the case's RFC 3339 timestamps."""

    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def detect_typology_signals(case: InvestigationCase) -> list[TypologySignal]:
    """Apply transparent demonstration checks to every suspect business."""

    signals: list[TypologySignal] = []
    for suspect in case.suspects:
        cash_credits = [
            transaction
            for transaction in suspect.transactions
            if transaction.direction == "CREDIT"
            and transaction.channel == "CASH"
            and DEMO_CASH_AMOUNT_MIN
            <= transaction.amount
            < DEMO_CASH_AMOUNT_MAX
        ]
        if len(cash_credits) < DEMO_REQUIRED_CASH_CREDITS:
            continue

        activity_dates = {
            parse_transaction_timestamp(item.timestamp).date()
            for item in cash_credits
        }
        currencies = {item.currency for item in cash_credits}
        if len(activity_dates) != 1 or len(currencies) != 1:
            continue

        cash_total = sum(item.amount for item in cash_credits)
        latest_cash_timestamp = max(
            parse_transaction_timestamp(item.timestamp) for item in cash_credits
        )
        rapid_wires = [
            transaction
            for transaction in suspect.transactions
            if transaction.direction == "DEBIT"
            and transaction.channel == "WIRE"
            and transaction.currency in currencies
            and parse_transaction_timestamp(transaction.timestamp).date()
            in activity_dates
            and parse_transaction_timestamp(transaction.timestamp)
            > latest_cash_timestamp
            and transaction.amount >= cash_total * DEMO_RAPID_MOVEMENT_RATIO
        ]

        cash_ids = [item.id for item in cash_credits]
        common = {
            "subject_id": suspect.id,
            "subject_name": suspect.owner_name,
            "business_name": suspect.business_name,
            "cash_credit_count": len(cash_credits),
            "cash_credit_total_usd": cash_total,
        }
        signals.append(
            TypologySignal(
                finding_type="STRUCTURING_SIGNAL",
                evidence_ids=cash_ids,
                outbound_wire_usd=None,
                movement_ratio_percent=None,
                **common,
            )
        )
        if rapid_wires:
            wire = rapid_wires[0]
            signals.append(
                TypologySignal(
                    finding_type="RAPID_MOVEMENT_SIGNAL",
                    evidence_ids=[*cash_ids, wire.id],
                    outbound_wire_usd=wire.amount,
                    movement_ratio_percent=round(
                        wire.amount / cash_total * 100,
                        1,
                    ),
                    **common,
                )
            )
    return signals


def build_offline_assessment(
    context: InvestigationContext,
) -> RiskAssessment:
    """Build the labeled, deterministic no-model fixture."""

    findings = []
    for signal in detect_typology_signals(context.case):
        if signal.finding_type == "STRUCTURING_SIGNAL":
            title = f"{signal.subject_name}: clustered cash deposits"
            explanation = (
                f"{signal.subject_name} made three same-day cash deposits "
                "within the demonstration range; the supporting customer "
                "records remain pending."
            )
        else:
            title = f"{signal.subject_name}: rapid outbound movement"
            explanation = (
                f"{signal.subject_name} moved most of the clustered cash to "
                "an overseas counterparty later that day, while the linked "
                "invoice amount does not match the wire."
            )
        findings.append(
            Finding(
                **signal.model_dump(),
                title=title,
                explanation=explanation,
            )
        )

    return RiskAssessment(
        case_id=context.case.case_id,
        primary_subject_id="FELIX",
        primary_subject="Felix Flowers",
        red_herring_subject=RED_HERRING_SUBJECT,
        assessment_posture="ESCALATE_FOR_QUALIFIED_REVIEW",
        executive_summary=(
            "Felix Flowers is the only owner whose evidence produces both "
            "clustered same-day cash deposits and rapid outbound movement. "
            "Larry Suds has conspicuous cash activity, but his smaller daily "
            "collections and matched utility payment do not trigger the "
            "demonstration checks."
        ),
        findings=findings,
        information_gaps=[
            "Customer-level receipts for Felix's three aggregated cash batches.",
            "Ownership and business purpose of Verdant Export Consulting.",
            "Explanation for the mismatch between Felix's invoice and wire.",
        ],
        recommended_next_steps=[
            "Obtain Felix's POS records and event contracts for the deposit date.",
            "Verify the overseas vendor and reconcile the full wire amount.",
            "Keep Larry's activity in routine review unless new evidence emerges.",
        ],
        drafting_authorized=False,
        filing_decision="NOT_DETERMINED",
    )


def validate_risk_assessment(
    candidate: RiskAssessment,
    observed_tool_calls: set[str],
    context: InvestigationContext,
    required_tools: set[str],
) -> dict[str, bool]:
    """Recompute evidence support and reject unsupported material claims."""

    expected_signals = detect_typology_signals(context.case)
    expected = {
        signal.finding_type: signal
        for signal in expected_signals
    }
    signal_subjects = {
        signal.subject_id: signal.subject_name for signal in expected_signals
    }
    valid_evidence_ids = {
        evidence_id
        for suspect in context.case.suspects
        for evidence_id in [
            *[item.id for item in suspect.transactions],
            *[item.id for item in suspect.invoices],
        ]
    }
    observed = {
        finding.finding_type: finding for finding in candidate.findings
    }
    unique_finding_types = len(observed) == len(candidate.findings)
    valid_citations = all(
        finding.evidence_ids
        and set(finding.evidence_ids).issubset(valid_evidence_ids)
        for finding in candidate.findings
    )

    supported_claims = unique_finding_types and set(observed) == set(expected)
    if supported_claims:
        for finding_type, expected_support in expected.items():
            finding = observed[finding_type]
            supported_claims = supported_claims and (
                finding.subject_id == expected_support.subject_id
                and finding.subject_name == expected_support.subject_name
                and finding.business_name == expected_support.business_name
                and set(finding.evidence_ids)
                == set(expected_support.evidence_ids)
                and finding.cash_credit_count
                == expected_support.cash_credit_count
                and finding.cash_credit_total_usd
                == expected_support.cash_credit_total_usd
                and finding.outbound_wire_usd
                == expected_support.outbound_wire_usd
                and (
                    finding.movement_ratio_percent is None
                    and expected_support.movement_ratio_percent is None
                    or finding.movement_ratio_percent is not None
                    and expected_support.movement_ratio_percent is not None
                    and math.isclose(
                        finding.movement_ratio_percent,
                        expected_support.movement_ratio_percent,
                        abs_tol=0.1,
                    )
                )
            )

    expected_subject_id, expected_subject_name = next(iter(signal_subjects.items()))
    checks = {
        "case_identity": candidate.case_id == context.case.case_id,
        "required_tools": required_tools.issubset(observed_tool_calls),
        "valid_citations": valid_citations,
        "material_claims_supported": supported_claims,
        "subject_selection": (
            len(signal_subjects) == 1
            and candidate.primary_subject_id == expected_subject_id
            and candidate.primary_subject == expected_subject_name
            and candidate.red_herring_subject == RED_HERRING_SUBJECT
        ),
        "structured_authority_denied": (
            candidate.drafting_authorized is False
            and candidate.filing_decision == "NOT_DETERMINED"
        ),
    }
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise ValueError("Assessment validation failed: " + ", ".join(failed))
    return checks
