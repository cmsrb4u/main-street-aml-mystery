"""Offline tests for the Lambda web adapter."""

from __future__ import annotations

import importlib.util
import io
import json
import os
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

os.environ.setdefault("AGENT_RUNTIME_ARN", "arn:aws:bedrock-agentcore:test")
os.environ.setdefault("FRONTEND_ORIGIN", "https://example.test")

HANDLER_PATH = Path(__file__).parents[1] / "lambda" / "handler.py"
SPEC = importlib.util.spec_from_file_location("web_handler", HANDLER_PATH)
assert SPEC and SPEC.loader
handler_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(handler_module)


class FakeClient:
    def __init__(self, response: dict[str, Any] | None = None) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    def invoke_agent_runtime(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        if self.response is None:
            raise RuntimeError("upstream unavailable")
        return self.response


def event(prompt: Any) -> dict[str, Any]:
    return {"body": json.dumps({"prompt": prompt}), "isBase64Encoded": False}


def response_payload(response: dict[str, Any]) -> dict[str, Any]:
    return json.loads(response["body"])


def test_parse_prompt_rejects_invalid_inputs() -> None:
    with pytest.raises(ValueError, match="must be a string"):
        handler_module.parse_prompt(event(3))
    with pytest.raises(ValueError, match="must not be empty"):
        handler_module.parse_prompt(event("   "))
    with pytest.raises(ValueError, match="at most"):
        handler_module.parse_prompt(event("x" * 2001))


def test_handler_invokes_runtime_and_returns_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runtime_payload = {
        "assessment": {"case_id": "SYNTH-AML-001"},
        "validation": {"case_identity": True},
    }
    client = FakeClient(
        {
            "statusCode": 200,
            "response": io.BytesIO(json.dumps(runtime_payload).encode()),
        }
    )
    monkeypatch.setattr(handler_module, "agentcore_client", lambda: client)

    result = handler_module.handler(
        event(" Analyze the evidence. "),
        SimpleNamespace(aws_request_id="request-123"),
    )

    assert result["statusCode"] == 200
    assert response_payload(result)["requestId"] == "request-123"
    assert "access-control-allow-origin" not in result["headers"]
    invocation = client.calls[0]
    assert json.loads(invocation["payload"]) == {
        "prompt": "Analyze the evidence."
    }
    assert invocation["agentRuntimeArn"] == (
        "arn:aws:bedrock-agentcore:test"
    )
    assert invocation["runtimeSessionId"].startswith("aml-web-")


def test_handler_returns_safe_upstream_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        handler_module,
        "agentcore_client",
        lambda: FakeClient(),
    )

    result = handler_module.handler(
        event("Analyze."),
        SimpleNamespace(aws_request_id="request-456"),
    )

    assert result["statusCode"] == 502
    assert response_payload(result) == {
        "message": "The analysis service could not complete the request.",
        "requestId": "request-456",
    }


def test_handler_returns_validation_error_without_invoking_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeClient()
    monkeypatch.setattr(handler_module, "agentcore_client", lambda: client)

    result = handler_module.handler(
        event(""),
        SimpleNamespace(aws_request_id="request-789"),
    )

    assert result["statusCode"] == 400
    assert client.calls == []
