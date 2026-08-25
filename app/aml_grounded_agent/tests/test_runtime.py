"""Offline tests for the AgentCore invocation boundary."""

import asyncio
import inspect

import pytest

import main


def test_offline_runtime_returns_validated_assessment() -> None:
    result = asyncio.run(main.run_analysis({"prompt": "Analyze the evidence."}))

    assert result["source"] == "offline_fixture"
    assert result["model"] is None
    assert result["assessment"]["case_id"] == "SYNTH-AML-005"
    assert result["assessment"]["primary_subject"] == "Felix Flowers"
    assert result["assessment"]["red_herring_subject"] == "Larry Suds"
    assert len(result["case"]["suspects"]) == 4
    assert all(result["validation"].values())


def test_agentcore_handler_uses_context_parameter_name() -> None:
    assert list(inspect.signature(main.invoke).parameters) == [
        "payload",
        "context",
    ]


@pytest.mark.parametrize("prompt", [None, 123, [], {}])
def test_runtime_rejects_non_string_prompt(prompt) -> None:
    with pytest.raises(ValueError, match="prompt must be a string"):
        main.invocation_prompt({"prompt": prompt}, "SYNTH-AML-005")


def test_runtime_rejects_blank_prompt() -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        main.invocation_prompt({"prompt": "   "}, "SYNTH-AML-005")


def test_runtime_rejects_oversized_prompt() -> None:
    with pytest.raises(ValueError, match="at most"):
        main.invocation_prompt(
            {"prompt": "x" * (main.MAX_PROMPT_LENGTH + 1)},
            "SYNTH-AML-005",
        )
