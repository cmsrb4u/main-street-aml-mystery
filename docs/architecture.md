# System architecture

## Runtime architecture

```mermaid
flowchart LR
    Analyst["Analyst"]

    subgraph Delivery["Web delivery"]
        CloudFront["Amazon CloudFront"]
        S3["Private Amazon S3 bucket<br/>React bundle and runtime-config.json"]
        Browser["React and Vite application<br/>Root, App, analyzeCase"]
    end

    subgraph Authentication["Authentication and authorization"]
        UserPool["Amazon Cognito user pool<br/>username or email and password"]
        IdentityPool["Amazon Cognito identity pool"]
        BrowserRole["IAM AuthenticatedUserRole<br/>short-lived credentials"]
    end

    subgraph WebAPI["Authenticated web API"]
        FunctionURL["AWS Lambda Function URL<br/>AWS_IAM authorization"]
        Proxy["AgentProxy Lambda<br/>handler and parse_prompt"]
        ProxyLogs["Amazon CloudWatch Logs<br/>one-week retention"]
    end

    subgraph Analysis["Evidence-grounded analysis"]
        AgentCore["Amazon Bedrock AgentCore Runtime<br/>invoke and run_analysis"]
        Runner["OpenAI Agents SDK<br/>Runner.run"]
        Bedrock["Amazon Bedrock Responses model<br/>openai.gpt-5.6-sol"]
        Tools["Read-only function tools<br/>profile, transactions, invoices, typology checks"]
        CaseData["Request-scoped synthetic case<br/>four businesses"]
        Validator["validate_risk_assessment<br/>deterministic support checks"]
    end

    Analyst --> Browser
    Browser -->|HTTPS| CloudFront
    CloudFront -->|origin access control| S3
    S3 -->|application assets and runtime config| Browser

    Browser -->|SRP sign-in| UserPool
    UserPool -->|identity token| IdentityPool
    IdentityPool -->|assume role with web identity| BrowserRole
    BrowserRole -->|temporary AWS credentials| Browser

    Browser -->|SigV4-signed POST| FunctionURL
    FunctionURL --> Proxy
    Proxy --> ProxyLogs
    Proxy -->|InvokeAgentRuntime| AgentCore
    AgentCore --> Runner
    Runner <--> Bedrock
    Runner --> Tools
    Tools --> CaseData
    CaseData --> Validator
    Runner --> Validator
    Validator -->|validated JSON| AgentCore
    AgentCore --> Proxy
    Proxy --> Browser
```

## Request sequence and error paths

```mermaid
sequenceDiagram
    actor Analyst
    participant Browser as React app
    participant UserPool as Cognito user pool
    participant IdentityPool as Cognito identity pool
    participant FunctionURL as Lambda Function URL
    participant Proxy as AgentProxy handler
    participant Runtime as AgentCore invoke
    participant Runner as OpenAI Agents Runner
    participant Bedrock as Bedrock Responses model
    participant Domain as Read-only domain tools
    participant Validator as validate_risk_assessment

    Browser->>Browser: Fetch runtime-config.json
    Analyst->>Browser: Sign in with username and password
    Browser->>UserPool: Authenticate with user SRP
    UserPool-->>Browser: User pool tokens
    Browser->>IdentityPool: Exchange authenticated identity
    IdentityPool-->>Browser: Short-lived AWS credentials

    Analyst->>Browser: Begin evidence scan
    Browser->>Browser: analyzeCase fetches session and signs request
    Browser->>FunctionURL: SigV4 POST with JSON prompt
    FunctionURL->>Proxy: IAM-authorized invocation

    alt Prompt is invalid, blank, or longer than 2000 characters
        Proxy-->>Browser: HTTP 400 with bounded validation message
    else Prompt is valid
        Proxy->>Runtime: invoke_agent_runtime with isolated session ID
        Runtime->>Runtime: new_investigation_context and invocation_prompt
        Runtime->>Runner: Runner.run with max_turns 8

        loop Model and tool turns
            Runner->>Bedrock: Responses request
            Bedrock-->>Runner: Tool call or structured final output
            opt Model requests evidence
                Runner->>Domain: get_case_profile, list_case_transactions,<br/>list_case_invoices, or run_typology_checks
                Domain-->>Runner: Request-scoped JSON evidence
            end
        end

        Runtime->>Validator: Candidate assessment, tool calls, and case context
        alt Any deterministic validation check fails
            Validator-->>Runtime: Reject with ValueError
            Runtime-->>Proxy: Unsuccessful runtime response
            Proxy-->>Browser: HTTP 502 with safe generic message and request ID
        else Every validation check passes
            Validator-->>Runtime: Six passed control results
            Runtime-->>Proxy: Assessment, case, validation, and notice
            Proxy-->>Browser: HTTP 200 with request ID
            Browser-->>Analyst: Evidence comparison, findings, gaps, and controls
        end
    end
```

## Security and state boundaries

- The S3 bucket is private and is read through CloudFront origin access control.
- The Cognito user pool allows invited-user sign-in; self-service sign-up and
  MFA are disabled in the current CDK configuration.
- The browser receives short-lived credentials from the Cognito identity pool.
  It does not receive long-lived AWS or model credentials.
- The Lambda Function URL requires IAM authorization. The browser role is
  limited to invoking that function URL.
- The Lambda execution role is limited to the configured AgentCore runtime.
- Each analysis uses a new `runtimeSessionId` and rebuilds the synthetic case.
  There is no application database, durable case state, AgentCore memory,
  knowledge base, or gateway in the current configuration.
- Model output is not returned until deterministic support validation passes.

## Code references

- [`web/src/main.tsx`](../web/src/main.tsx) — runtime configuration and Cognito
  authenticator.
- [`web/src/api.ts`](../web/src/api.ts) — temporary credential retrieval and
  SigV4 request signing.
- [`web-infra/lib/aml-web-stack.ts`](../web-infra/lib/aml-web-stack.ts) — web
  hosting, Cognito, IAM, Lambda, and deployment resources.
- [`web-infra/lambda/handler.py`](../web-infra/lambda/handler.py) — prompt
  validation, AgentCore invocation, and safe HTTP errors.
- [`app/aml_grounded_agent/main.py`](../app/aml_grounded_agent/main.py) —
  AgentCore entry point, agent tools, model runner, and response boundary.
- [`app/aml_grounded_agent/aml_grounded_agent/domain.py`](../app/aml_grounded_agent/aml_grounded_agent/domain.py)
  — synthetic evidence, deterministic signals, and output validation.
