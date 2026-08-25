# AML demonstration and validation business logic

The rules below are transparent demonstration rules for a synthetic learning
case. They are not legal thresholds, production transaction-monitoring rules,
or proof of intent.

## Signal detection

```mermaid
flowchart TD
    Start["build_synthetic_case<br/>four suspect businesses"] --> Next["Select next suspect"]
    Next --> CashFilter["Keep transactions where<br/>direction is CREDIT<br/>channel is CASH<br/>9000 <= amount < 10000"]
    CashFilter --> Count{"At least three<br/>qualifying cash credits?"}

    Count -->|No| NoSignal["No demonstration signal"]
    Count -->|Yes| Cohesion{"All qualifying credits<br/>on one date and<br/>in one currency?"}
    Cohesion -->|No| NoSignal
    Cohesion -->|Yes| Total["Compute cash total and<br/>latest cash timestamp"]
    Total --> Structuring["Emit STRUCTURING_SIGNAL<br/>with exact cash evidence IDs"]

    Structuring --> WireSearch["Find a DEBIT WIRE that is<br/>same date and currency,<br/>after the latest cash credit,<br/>and at least 90% of cash total"]
    WireSearch --> Rapid{"Qualifying wire exists?"}
    Rapid -->|No| Complete["Finish this suspect"]
    Rapid -->|Yes| Movement["Emit RAPID_MOVEMENT_SIGNAL<br/>with cash and wire evidence IDs<br/>and movement percentage"]
    Movement --> Complete
    NoSignal --> Complete
    Complete --> More{"More suspects?"}
    More -->|Yes| Next
    More -->|No| Signals["Return deterministic signals"]
```

### Demonstration thresholds

| Check | Rule in `detect_typology_signals` |
| --- | --- |
| Cash amount range | At least USD 9,000 and less than USD 10,000 |
| Cash count | At least three qualifying credits |
| Timing | Qualifying cash credits must occur on one calendar date |
| Currency | Qualifying cash credits must share one currency |
| Rapid outbound movement | A later same-day debit wire in the same currency must be at least 90% of the qualifying cash total |
| Invoice use | Invoices provide corroborating context and information gaps; they do not trigger the two deterministic signals |

For the included fixture, Felix Flowers has qualifying cash credits of
USD 9,200, USD 9,500, and USD 9,700, totaling USD 28,400. A later USD 27,900
wire moves 98.2% of that total, so Felix receives both signals. Larry Suds is
the narrative red herring: his cash activity totals USD 6,940 across smaller
collections and does not enter the demonstration range.

## Agent and deterministic control flow

```mermaid
flowchart TD
    Prompt["Bounded analyst prompt"] --> Context["new_investigation_context<br/>isolated synthetic case"]
    Context --> Agent["Synthetic AML Analysis Agent"]

    Agent --> Profile["get_case_profile"]
    Agent --> Transactions["list_case_transactions"]
    Agent --> Invoices["list_case_invoices"]
    Agent --> Typology["run_typology_checks"]

    Profile --> Candidate["Structured RiskAssessment"]
    Transactions --> Candidate
    Invoices --> Candidate
    Typology --> Candidate

    Candidate --> Recompute["Recompute expected signals<br/>from original case data"]
    Recompute --> Checks["Run six validation controls"]

    Checks --> CaseIdentity["case_identity"]
    Checks --> RequiredTools["required_tools"]
    Checks --> Citations["valid_citations"]
    Checks --> Claims["material_claims_supported"]
    Checks --> Subject["subject_selection"]
    Checks --> Authority["structured_authority_denied"]

    CaseIdentity --> Decision{"Every control passed?"}
    RequiredTools --> Decision
    Citations --> Decision
    Claims --> Decision
    Subject --> Decision
    Authority --> Decision

    Decision -->|No| Reject["Reject the assessment<br/>ValueError and safe upstream error"]
    Decision -->|Yes| Return["Return validated assessment<br/>filing decision NOT_DETERMINED"]
    Return --> Human["Qualified human decides disposition"]
```

## Validation controls

| Control | What must be true |
| --- | --- |
| `case_identity` | The assessment case ID equals the request-scoped case ID |
| `required_tools` | The model called profile, transaction, invoice, and deterministic typology tools |
| `valid_citations` | Every finding contains evidence IDs and every ID exists in the case transactions or invoices |
| `material_claims_supported` | Finding types, subject fields, evidence IDs, cash counts, totals, wire amount, and movement ratio match deterministic recomputation |
| `subject_selection` | Exactly one subject produces signals; the candidate selects that subject and identifies Larry Suds as the red herring |
| `structured_authority_denied` | `drafting_authorized` remains false and `filing_decision` remains `NOT_DETERMINED` |

The model supplies the explanation and recommended review steps, but it cannot
change the deterministic support fields. A failed control rejects the entire
assessment before it reaches the browser.

## Business logic references

- [`app/aml_grounded_agent/aml_grounded_agent/domain.py`](../app/aml_grounded_agent/aml_grounded_agent/domain.py)
- [`app/aml_grounded_agent/main.py`](../app/aml_grounded_agent/main.py)
- [`app/aml_grounded_agent/tests/test_domain.py`](../app/aml_grounded_agent/tests/test_domain.py)
- [`app/aml_grounded_agent/tests/test_runtime.py`](../app/aml_grounded_agent/tests/test_runtime.py)
- [`web-infra/tests/test_handler.py`](../web-infra/tests/test_handler.py)
