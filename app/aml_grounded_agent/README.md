# Evidence-Grounded AML Agent

This AgentCore Runtime package adapts the OpenAI cookbook's synthetic AML
analysis example into an HTTP agent. It uses the OpenAI Agents SDK with
`openai.gpt-5.6-sol` on Amazon Bedrock, then recomputes every material claim
before returning the structured assessment.

The deployed runtime accepts a `prompt` string. It compares four synthetic
Main Street businesses in case `SYNTH-AML-005`, grounding the Felix Flowers
reveal and Larry Suds red herring in transactions and invoice support. It
cannot authorize drafting or make a filing decision.

## Local tests

```bash
uv sync --dev
uv run pytest
```

With `RUN_ANALYSIS_DEMO` unset or false, the package uses the cookbook's labeled
offline fixture and makes no AWS or model call.

## AgentCore

From the `amlgroundedagent` project root:

```bash
AWS_PROFILE=isengard agentcore validate
AWS_PROFILE=isengard agentcore deploy --target isengard
AWS_PROFILE=isengard agentcore invoke \
  --target isengard \
  --runtime aml_analysis \
  "Analyze the evidence and identify information gaps."
```

The deployment sets `RUN_ANALYSIS_DEMO=true`, so runtime invocations use
Bedrock. Model access and charges apply.
