"""Offline tests for deterministic support validation."""

import pytest

from aml_grounded_agent.domain import (
    build_offline_assessment,
    detect_typology_signals,
    new_investigation_context,
    validate_risk_assessment,
)

REQUIRED_TOOLS = {
    "get_case_profile",
    "list_case_transactions",
    "list_case_invoices",
    "run_typology_checks",
}


def test_detect_typology_signals_identifies_felix_only() -> None:
    context = new_investigation_context()

    signals = detect_typology_signals(context.case)

    assert [signal.finding_type for signal in signals] == [
        "STRUCTURING_SIGNAL",
        "RAPID_MOVEMENT_SIGNAL",
    ]
    assert {signal.subject_id for signal in signals} == {"FELIX"}
    assert signals[0].subject_name == "Felix Flowers"
    assert signals[0].cash_credit_total_usd == 28_400
    assert signals[1].outbound_wire_usd == 27_900
    assert signals[1].movement_ratio_percent == 98.2


def test_offline_assessment_passes_all_support_checks() -> None:
    context = new_investigation_context()
    assessment = build_offline_assessment(context)

    checks = validate_risk_assessment(
        assessment,
        REQUIRED_TOOLS,
        context,
        REQUIRED_TOOLS,
    )

    assert all(checks.values())
    assert assessment.primary_subject == "Felix Flowers"
    assert assessment.red_herring_subject == "Larry Suds"
    assert assessment.drafting_authorized is False
    assert assessment.filing_decision == "NOT_DETERMINED"


@pytest.mark.parametrize(
    ("mutation", "expected_failure"),
    [
        (
            lambda assessment: setattr(
                assessment.findings[0],
                "cash_credit_total_usd",
                50_000,
            ),
            "material_claims_supported",
        ),
        (
            lambda assessment: setattr(
                assessment.findings[0],
                "evidence_ids",
                ["TXN-999"],
            ),
            "valid_citations",
        ),
    ],
)
def test_validator_rejects_unsupported_findings(
    mutation,
    expected_failure: str,
) -> None:
    context = new_investigation_context()
    assessment = build_offline_assessment(context)
    mutation(assessment)

    with pytest.raises(ValueError, match=expected_failure):
        validate_risk_assessment(
            assessment,
            REQUIRED_TOOLS,
            context,
            REQUIRED_TOOLS,
        )


def test_validator_requires_deterministic_tool_call() -> None:
    context = new_investigation_context()
    assessment = build_offline_assessment(context)

    with pytest.raises(ValueError, match="required_tools"):
        validate_risk_assessment(
            assessment,
            REQUIRED_TOOLS - {"run_typology_checks"},
            context,
            REQUIRED_TOOLS,
        )


def test_larry_is_cash_heavy_but_does_not_trigger_demo_signals() -> None:
    context = new_investigation_context()
    larry = next(
        suspect for suspect in context.case.suspects if suspect.id == "LARRY"
    )

    assert sum(
        transaction.amount
        for transaction in larry.transactions
        if transaction.direction == "CREDIT"
    ) == 6_940
    assert all(
        signal.subject_id != "LARRY"
        for signal in detect_typology_signals(context.case)
    )
