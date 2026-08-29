# Site Agent Standard review - August 2026

## Grade after v0.15.0: A (97/100)

| Area | Score | Evidence |
|---|---:|---|
| Architecture and scope | 19/20 | Independent Query, Navigation, Action, and Presentation profiles share opaque references without becoming one privileged API. |
| Authorization and safety | 19/20 | Caller-filtered revisions, reauthorization, schema validation, reconciliation, idempotency, consent, safe problems, and privacy-bounded telemetry are explicit. |
| Query and completeness | 19/20 | Permission-filtered discovery, brokered large catalogs, bounded batch reads, static materialization, subscriptions, nested provenance, and independent inventory evidence cover frontend and backend information. |
| Navigation and presentation | 20/20 | Stepwise semantic reveal, exact declared targets, clipping/viewport verification, pathological nested fixtures, rendered-quality evidence, and tutorial presentation form a complete reference contract. |
| Interoperability and lifecycle | 19/20 | WebMCP registration follows live capability revisions; MCP Tasks, Apps boundaries, Arazzo, AsyncAPI, and WebDriver BiDi are clean projections rather than duplicated business logic. |

The standard is stronger than any one adjacent protocol for its intended host
contract. WebMCP standardizes in-page tools, MCP standardizes remote model
context, Arazzo describes API workflows, and WebDriver BiDi controls browsers;
none independently provides the combined permission-scoped Query, verified
semantic Navigation, reconciled Action, tutorial Presentation, and complete
human-surface parity contract. Site Agent should complement those standards,
not compete with or reimplement them.

## Remaining limits

- The project is a young public draft with limited independent implementation
  and interoperability evidence outside the reference runtime.
- Cross-origin frames, closed shadow roots, canvas-only surfaces, and protected
  document viewers still require explicit semantic host adapters.
- Generic multi-operation compensation remains deliberately deferred; workflow
  projections should build on Arazzo rather than create a second orchestration
  language.
- Formal registered discovery and extension identifiers should wait until the
  draft has broader implementation feedback and a stable 1.0 contract.

These limits prevent an A+ grade, but none requires weakening exactness with DOM
guessing or granting an agent broader authority than the human actor.
