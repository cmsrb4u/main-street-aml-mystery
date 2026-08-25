"""IAM-authenticated web adapter for the AgentCore AML runtime."""

from __future__ import annotations

import base64
import json
import logging
import os
import uuid
from functools import lru_cache
from typing import Any

import boto3

AGENT_RUNTIME_ARN = os.environ["AGENT_RUNTIME_ARN"]
FRONTEND_ORIGIN = os.environ["FRONTEND_ORIGIN"]
MAX_PROMPT_LENGTH = 2_000

log = logging.getLogger()
log.setLevel(logging.INFO)


@lru_cache(maxsize=1)
def agentcore_client() -> Any:
    """Return the execution-environment AgentCore client."""

    return boto3.client("bedrock-agentcore")


def api_response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    """Build a bounded Function URL response."""

    return {
        "statusCode": status_code,
        "headers": {
            "content-type": "application/json",
            "cache-control": "no-store",
        },
        "body": json.dumps(body),
    }


def parse_prompt(event: dict[str, Any]) -> str:
    """Parse and validate the caller's JSON prompt."""

    raw_body = event.get("body")
    if not isinstance(raw_body, str):
        raise ValueError("Request body must be JSON.")
    if event.get("isBase64Encoded"):
        try:
            raw_body = base64.b64decode(raw_body, validate=True).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as error:
            raise ValueError("Request body encoding is invalid.") from error
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise ValueError("Request body must be valid JSON.") from error
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")

    prompt = payload.get("prompt")
    if not isinstance(prompt, str):
        raise ValueError("prompt must be a string.")
    prompt = prompt.strip()
    if not prompt:
        raise ValueError("prompt must not be empty.")
    if len(prompt) > MAX_PROMPT_LENGTH:
        raise ValueError(
            f"prompt must be at most {MAX_PROMPT_LENGTH} characters."
        )
    return prompt


def decode_runtime_response(response: dict[str, Any]) -> dict[str, Any]:
    """Read and validate the AgentCore buffered response."""

    status_code = response.get("statusCode", 502)
    if not isinstance(status_code, int) or status_code >= 400:
        raise RuntimeError("AgentCore runtime returned an unsuccessful response.")
    stream = response.get("response")
    if stream is None or not hasattr(stream, "read"):
        raise RuntimeError("AgentCore runtime response body is unavailable.")
    body = stream.read()
    if isinstance(body, bytes):
        body = body.decode("utf-8")
    try:
        payload = json.loads(body)
    except (TypeError, json.JSONDecodeError) as error:
        raise RuntimeError("AgentCore runtime returned invalid JSON.") from error
    if not isinstance(payload, dict):
        raise RuntimeError("AgentCore runtime returned an invalid payload.")
    return payload


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Invoke the isolated AML runtime for one authenticated web request."""

    request_id = getattr(context, "aws_request_id", "unknown")
    try:
        prompt = parse_prompt(event)
    except ValueError as error:
        return api_response(400, {"message": str(error), "requestId": request_id})

    try:
        response = agentcore_client().invoke_agent_runtime(
            agentRuntimeArn=AGENT_RUNTIME_ARN,
            runtimeSessionId=f"aml-web-{uuid.uuid4()}",
            contentType="application/json",
            accept="application/json",
            payload=json.dumps({"prompt": prompt}).encode("utf-8"),
        )
        payload = decode_runtime_response(response)
        payload["requestId"] = request_id
        return api_response(200, payload)
    except Exception:
        log.exception("AgentCore invocation failed", extra={"requestId": request_id})
        return api_response(
            502,
            {
                "message": "The analysis service could not complete the request.",
                "requestId": request_id,
            },
        )
