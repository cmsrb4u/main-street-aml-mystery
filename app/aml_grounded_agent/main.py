"""AgentCore HTTP runtime for the evidence-grounded synthetic AML analysis."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

from agents import (
    Agent,
    ModelSettings,
    RunConfig,
    RunContextWrapper,
    Runner,
    function_tool,
    set_default_openai_api,
    set_default_openai_client,
)
from agents.items import ToolCallItem
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from openai import AsyncOpenAI
from openai.providers import bedrock
from openai.types.shared import Reasoning

from aml_grounded_agent.domain import (
    InvestigationCase,
    InvestigationContext,
    RiskAssessment,
    build_offline_assessment,
    detect_typology_signals,
    new_investigation_context,
    validate_risk_assessment,
)

AWS_REGION = os.getenv("AWS_REGION", "us-east-2")
MODEL_ID = os.getenv("BEDROCK_MODEL", "openai.gpt-5.6-sol")
RUN_ANALYSIS_DEMO = (
    os.getenv("RUN_ANALYSIS_DEMO", "false").casefold() == "true"
)
MAX_PROMPT_LENGTH = 2_000
REQUIRED_ANALYSIS_TOOLS = {
    "get_case_profile",
    "list_case_transactions",
    "list_case_invoices",
    "run_typology_checks",
}

app = BedrockAgentCoreApp()
log = app.logger


def require_known_case(
    wrapper: RunContextWrapper[InvestigationContext],
    case_id: str,
) -> InvestigationCase:
    """Return the request's case, rejecting cross-case access."""

    case = wrapper.context.case
    if case_id != case.case_id:
        raise ValueError(f"Unknown case in this request context: {case_id}")
    return case


@function_tool(failure_error_function=None)
def get_case_profile(
    wrapper: RunContextWrapper[InvestigationContext],
    case_id: str,
) -> str:
    """Return the synthetic profile and alert context for one case."""

    case = require_known_case(wrapper, case_id)
    return json.dumps(
        {
            "case_id": case.case_id,
            "title": case.title,
            "investigator": case.investigator,
            "alert_reason": case.alert_reason,
            "suspects": [
                suspect.model_dump(exclude={"transactions", "invoices"})
                for suspect in case.suspects
            ],
        }
    )


@function_tool(failure_error_function=None)
def list_case_transactions(
    wrapper: RunContextWrapper[InvestigationContext],
    case_id: str,
) -> str:
    """Return all synthetic transactions and their evidence identifiers."""

    case = require_known_case(wrapper, case_id)
    return json.dumps(
        [
            {
                "subject_id": suspect.id,
                "subject_name": suspect.owner_name,
                "business_name": suspect.business_name,
                **transaction.model_dump(),
            }
            for suspect in case.suspects
            for transaction in suspect.transactions
        ]
    )


@function_tool(failure_error_function=None)
def list_case_invoices(
    wrapper: RunContextWrapper[InvestigationContext],
    case_id: str,
) -> str:
    """Return all synthetic invoices and their verification status."""

    case = require_known_case(wrapper, case_id)
    return json.dumps(
        [
            {
                "subject_id": suspect.id,
                "subject_name": suspect.owner_name,
                "business_name": suspect.business_name,
                **invoice.model_dump(),
            }
            for suspect in case.suspects
            for invoice in suspect.invoices
        ]
    )


@function_tool(failure_error_function=None)
def run_typology_checks(
    wrapper: RunContextWrapper[InvestigationContext],
    case_id: str,
) -> str:
    """Return transparent demo signals and their calculated support."""

    case = require_known_case(wrapper, case_id)
    return json.dumps(
        [signal.model_dump() for signal in detect_typology_signals(case)]
    )


MODEL_SETTINGS = ModelSettings(
    reasoning=Reasoning(effort="medium"),
    store=False,
)

analysis_agent = Agent[InvestigationContext](
    name="Synthetic AML Analysis Agent",
    model=MODEL_ID,
    model_settings=MODEL_SETTINGS,
    output_type=RiskAssessment,
    tools=[
        get_case_profile,
        list_case_transactions,
        list_case_invoices,
        run_typology_checks,
    ],
    instructions=(
        "Compare all four business owners in exactly one synthetic AML case. "
        "Call get_case_profile, list_case_transactions, list_case_invoices, "
        "and run_typology_checks. Select the primary subject only from the "
        "deterministic signals, and identify Larry Suds as the narrative red "
        "herring because his records do not trigger those checks. Copy the "
        "deterministic tool's subject fields, evidence IDs, and computed "
        "values into the matching structured finding fields. Use invoices "
        "only as corroborating context or an information gap. Treat signals "
        "as prompts for qualified review, not proof of intent or wrongdoing. "
        "Set drafting_authorized to false and filing_decision to "
        "NOT_DETERMINED. Do not draft or file a SAR, change case state, "
        "approve your own work, or claim that filing is required. Return "
        "only the RiskAssessment schema."
    ),
)


@lru_cache(maxsize=1)
def configure_bedrock_client() -> AsyncOpenAI:
    """Configure the Agents SDK to use Bedrock's Responses endpoint."""

    set_default_openai_api("responses")
    client = AsyncOpenAI(provider=bedrock(region=AWS_REGION))
    set_default_openai_client(client, use_for_tracing=False)
    return client


def invocation_prompt(payload: dict[str, Any], case_id: str) -> str:
    """Validate caller input and produce a bounded analysis request."""

    prompt = payload.get("prompt", "Analyze the synthetic AML case.")
    if not isinstance(prompt, str):
        raise ValueError("prompt must be a string")
    prompt = prompt.strip()
    if not prompt:
        raise ValueError("prompt must not be empty")
    if len(prompt) > MAX_PROMPT_LENGTH:
        raise ValueError(
            f"prompt must be at most {MAX_PROMPT_LENGTH} characters"
        )
    return (
        f"Analyze synthetic case {case_id}. "
        f"Caller context: {prompt}"
    )


async def run_analysis(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the configured path and return only validated structured output."""

    context = new_investigation_context()
    prompt = invocation_prompt(payload, context.case.case_id)

    if RUN_ANALYSIS_DEMO:
        configure_bedrock_client()
        result = await Runner.run(
            analysis_agent,
            prompt,
            context=context,
            max_turns=8,
            run_config=RunConfig(
                tracing_disabled=True,
                workflow_name="Validated synthetic AML analysis",
            ),
        )
        assessment = result.final_output
        tool_calls = {
            item.raw_item.name
            for item in result.new_items
            if isinstance(item, ToolCallItem)
        }
        source = "bedrock_agent"
    else:
        assessment = build_offline_assessment(context)
        tool_calls = set(REQUIRED_ANALYSIS_TOOLS)
        source = "offline_fixture"

    checks = validate_risk_assessment(
        assessment,
        tool_calls,
        context,
        REQUIRED_ANALYSIS_TOOLS,
    )
    return {
        "source": source,
        "model": MODEL_ID if RUN_ANALYSIS_DEMO else None,
        "case": context.case.model_dump(mode="json"),
        "assessment": assessment.model_dump(mode="json"),
        "validation": checks,
        "notice": (
            "Synthetic learning asset only. A qualified human must decide "
            "disposition; this service does not draft or file a SAR."
        ),
    }


@app.entrypoint
async def invoke(payload: dict[str, Any], context: object) -> dict[str, Any]:
    """Handle one isolated AgentCore Runtime invocation."""

    del context
    log.info("Running evidence-grounded synthetic AML analysis")
    return await run_analysis(payload)


if __name__ == "__main__":
    app.run()
