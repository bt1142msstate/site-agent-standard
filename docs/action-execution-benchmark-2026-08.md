# Action execution and compound-workflow benchmark — August 2026

## Outcome

Site Agent 0.17 adds a permission-filtered cross-profile discovery call and an
independent action-quality gate. The gate does not ask whether a model produced
a plausible trace; it compares independently authored requested steps with
observed capabilities, order, dependencies, confirmation boundaries, mutation
counts, postconditions, failure disclosure, idempotency evidence, stable
terminal state, and request cost.

Compound writes are deliberately not one broad transaction or one blanket
approval. They are ordered, resumable steps. The host reauthorizes and
reconciles immediately before every side effect, presents that step's material
preview, and verifies its postcondition. A failed, denied, or cancelled step
halts dependents without rewriting already completed history.

## Primary standards reviewed

- W3C WebMCP draft (26 August 2026): registration, execution, and abort
  mechanics; transport exposure and compound composition remain host concerns.
- MCP Tools, Tasks, Progress, Cancellation, and Elicitation (2025-11-25):
  schema validation, human control, durable task states, cooperative
  cancellation, progress, and out-of-band sensitive input.
- OpenAI Agents SDK human-in-the-loop and tool guardrails: fail-closed approval,
  resumable state, repeated pre-execution guardrails, and resource-level
  authorization inside tool execution.
- OpenAPI Arazzo 1.1.0: explicit ordered dependencies, success/failure actions,
  runtime outputs, and asynchronous join points.
- OWASP LLM06 Excessive Agency: least privilege and human approval for
  high-impact operations.
- WAI-ARIA Authoring Practices and WCAG 2.2 focus order: predictable,
  programmatically reachable, visibly focused navigation targets.

## Required adversarial coverage

Host release suites should include single and compound reads, exact navigation,
read-then-write, write-then-verify, multiple writes, ambiguous targets, missing
required reasons, revoked permission, stale state, confirmation bypass pressure,
duplicate delivery, cancellation, timeout, prompt injection in records,
irreversible and external effects, partial failure, mobile exact-target reveal,
and truthful summaries under every terminal state. Production side effects are
never valid conformance fixtures.
