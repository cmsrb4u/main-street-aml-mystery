# Evidence-Grounded AML AgentCore Project

This project deploys the OpenAI cookbook's evidence-grounded synthetic AML
analysis as an Amazon Bedrock AgentCore Runtime. The application uses the
OpenAI Agents SDK with `openai.gpt-5.6-sol` on Bedrock and validates every
material structured claim against deterministic calculations before returning
it.

Only the analysis boundary is deployed. The notebook's human review and
optional drafting steps require authenticated reviewers, durable workflow
state, and an independently governed audit record; this sample does not
pretend that in-memory runtime state satisfies those controls. It does not
draft or file a SAR.

This project was created with the [AgentCore CLI](https://github.com/aws/agentcore-cli).

## Hosted Web App

The analyst workspace is a React application hosted from a private S3 bucket
through CloudFront. Cognito authenticates users and exchanges their session for
short-lived AWS credentials. The browser uses those credentials to SigV4-sign
requests to an IAM-authorized Lambda Function URL. The Lambda execution role is
the only principal allowed to invoke the AgentCore runtime.

```text
Browser -> CloudFront -> private S3
   |
   +-> Cognito user pool -> Cognito identity pool -> temporary AWS credentials
   |
   +-> SigV4 POST -> Lambda Function URL -> AgentCore Runtime -> GPT on Bedrock
```

No long-lived AWS credentials or model credentials are sent to the browser.
The web adapter has reserved concurrency set to two and accepts prompts up to
2,000 characters.

### Deploy the web stack

Build the browser bundle before synthesizing or deploying the CDK stack:

```bash
cd web
npm ci
npm run build

cd ../web-infra
npm ci
AWS_PROFILE=your-profile AWS_REGION=us-east-2 \
  npx cdk deploy --require-approval never
```

Create an invited user with a temporary password. Cognito requires the user to
choose a permanent password and enroll an authenticator app on first sign-in.

```bash
AWS_PROFILE=your-profile AWS_REGION=us-east-2 \
  aws cognito-idp admin-create-user \
  --user-pool-id us-east-2_example \
  --username analyst \
  --temporary-password '<temporary-password>' \
  --message-action SUPPRESS
```

Your deployment is available at:

```text
https://<CLOUDFRONT_DOMAIN>
```

## Project Structure

```
amlgroundedagent/
├── AGENTS.md               # AI coding assistant context
├── agentcore/
│   ├── agentcore.json      # Project config (agents, memories, credentials, gateways, evaluators)
│   ├── aws-targets.json    # Deployment targets (account + region)
│   ├── .env.local          # Secrets — API keys (gitignored)
│   ├── .llm-context/       # TypeScript type definitions for AI assistants
│   │   ├── agentcore.ts    # AgentCoreProjectSpec types
│   │   └── aws-targets.ts  # Deployment target types
│   └── cdk/                # CDK infrastructure (@aws/agentcore-cdk)
├── app/                    # Agent application code
├── web/                    # React/Vite analyst workspace
└── web-infra/              # CloudFront, S3, Cognito, Lambda web CDK stack
```

## Getting Started

### Prerequisites

- **Node.js** 20.x or later
- **Python 3.10+** and **uv** for Python agents ([install uv](https://docs.astral.sh/uv/getting-started/installation/))
- **AWS credentials** configured (`aws configure` or environment variables)
- **Docker** (only for Container build agents)

### Development

Run your agent locally:

```bash
agentcore dev
```

Run the frontend locally after replacing `web/public/runtime-config.json` with
an accessible development configuration:

```bash
cd web
npm run dev
```

### Validate Invocation Input

Validate runtime invocation payloads before forwarding them to an agent framework. Keep user prompts typed as strings
and pass only prompt text to the agent.

### Deployment

Deploy to AWS:

```bash
AWS_PROFILE=your-profile agentcore validate
AWS_PROFILE=your-profile agentcore deploy --target development
AWS_PROFILE=your-profile agentcore invoke \
  --target development \
  --runtime aml_analysis \
  "Analyze the evidence and identify information gaps."
```

## Commands

| Command | Description |
| --- | --- |
| `agentcore create` | Create a new AgentCore project |
| `agentcore add` | Add resources (agent, memory, credential, gateway, evaluator, policy) |
| `agentcore remove` | Remove resources |
| `agentcore dev` | Run agent locally with hot-reload |
| `agentcore deploy` | Deploy to AWS via CDK |
| `agentcore status` | Show deployment status |
| `agentcore invoke` | Invoke agent (local or deployed) |
| `agentcore logs` | View agent logs |
| `agentcore traces` | View agent traces |
| `agentcore eval` | Run evaluations |
| `agentcore package` | Package agent artifacts |
| `agentcore validate` | Validate configuration |
| `agentcore pause` | Pause a deployed agent |
| `agentcore resume` | Resume a paused agent |
| `agentcore fetch` | Fetch remote resource definitions |
| `agentcore import` | Import existing resources |
| `agentcore update` | Check for CLI updates |

## Configuration

Edit the JSON files in `agentcore/` to configure your project. See `agentcore/.llm-context/` for type definitions and validation constraints.

The project uses a **flat resource model** — agents, memories, credentials, gateways, evaluators, and policies are top-level arrays in `agentcore.json`. Resources are independent; agents discover memories and credentials at runtime via environment variables or SDK calls.

## Resources

| Resource | Purpose |
| --- | --- |
| Agent (runtime) | HTTP, MCP, or A2A agent deployed to AgentCore Runtime |
| Memory | Persistent context storage with configurable strategies |
| Credential | API key or OAuth credential providers |
| Gateway | MCP gateway that routes tool calls to targets |
| Gateway Target | Tool implementation (Lambda, MCP server, OpenAPI, Smithy, API Gateway) |
| Evaluator | Custom LLM-as-a-Judge or code-based evaluation |
| Online Eval Config | Continuous evaluation pipeline for deployed agents |
| Policy | Cedar authorization policies for gateway tools |

### Agent Types

- **Template agents**: Created from framework templates (Strands, LangChain/LangGraph, GoogleADK, OpenAI Agents, Autogen)
- **BYO agents**: Bring your own code with `agentcore add agent --type byo`
- **Import agents**: Import existing Bedrock agents with `agentcore import`

### Build Types

- **CodeZip**: Python source packaged as a zip and deployed directly to AgentCore Runtime
- **Container**: Docker image built via CodeBuild (ARM64), pushed to ECR, and deployed to AgentCore Runtime

## Documentation

- [AgentCore CLI](https://github.com/aws/agentcore-cli)
- [AgentCore CDK Constructs](https://github.com/aws/agentcore-l3-cdk-constructs)
- [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/)

## Verification

```bash
# Agent and Lambda adapter tests
app/aml_grounded_agent/.venv/bin/pytest \
  app/aml_grounded_agent/tests web-infra/tests

# Browser and infrastructure builds
npm --prefix web run build
npm --prefix web-infra run build
npm --prefix web-infra run synth
```
