# Standards gap review - August 2026

This review compares Site Agent Standard 0.2 with adjacent primary standards.
It is informative; `spec/0.2/` remains normative.

## Adopted in package v0.14.0

- **Live WebMCP registration lifecycle.** The reference binding now follows
  revisioned Site Agent capability snapshots, unregistering stale tools after
  page, permission, session, lifecycle, or adapter changes. It uses the current
  `document.modelContext` API and keeps registration cleanup abortable.
- **Current MCP task semantics.** The runtime and binding guidance now use
  server-directed task creation, the `io.modelcontextprotocol/tasks` extension,
  `input_required` plus `tasks/update`, cooperative cancellation, and no task
  listing. This replaces assumptions inherited from the older experimental core
  task shape.
- **Binding-specific security.** Current browser guidance records origin
  isolation, the `tools` Permissions Policy, explicit secure-origin exposure,
  active-page lifecycle, character budgets, and the requirement that MCP Apps
  reuse the same Action consent and audit path.

## Adopted in package v0.13.0

- **Active capability lifecycle.** WebMCP exposes tools from the active page and
  supports dynamic registration and unregistration. Site Agent now exposes
  permission-filtered, revisioned capability snapshots and subscriptions while
  still reauthorizing every call.
- **Cancellation and bounded execution.** MCP tasks define cancellation, TTL,
  requester isolation, and bounded resources. Site Agent now propagates abort
  signals and deadlines into adapters and standardizes partial-effect reporting.
- **Structured failures.** RFC 9457 demonstrates a transport-neutral problem
  shape. Site Agent now uses a domain-specific safe problem contract with stable
  codes, remediation, retryability, and partial effects.
- **Evidence-backed completeness.** Coverage declarations now require an
  executable independent host inventory with stable digest, reviewed hashed
  exemptions, and zero unresolved entries for complete claims.

## Already aligned

- JSON Schema 2020-12 validates filter, state, input, confirmation, output, and
  event boundaries.
- WebDriver BiDi remains an optional browser-control transport beneath semantic
  Navigation; the Site Agent contract does not expose selectors.
- Arazzo 1.1 source descriptions, workflow dependencies, and failure/success
  structure are supported as projections rather than duplicated as host logic.
- W3C Trace Context can carry a transport correlation context, while Site Agent
  telemetry remains content-free and transport neutral.

## Deliberately deferred

- **Generic multi-operation orchestration and compensation.** The standard can
  declare workflows, but it does not yet become a second workflow engine. A
  future draft should project Arazzo-compatible dependencies, retry limits, and
  compensation semantics instead of inventing incompatible primitives.
- **Cross-origin frames, closed shadow roots, and canvas-only interfaces.** A
  host must expose semantic adapters for these boundaries. Inference or a DOM
  fallback would weaken exactness and browser security.
- **Formal registry discovery.** `/site-agent.json` remains the advertised
  discovery location until the draft is stable enough to pursue a registered
  well-known identifier.

## Primary sources

- [WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [WebMCP proposal](https://github.com/webmachinelearning/webmcp)
- [MCP 2026-07-28 release candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)
- [MCP Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview)
- [MCP Tasks draft specification](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
- [Arazzo 1.1.0](https://spec.openapis.org/arazzo/latest.html)
- [WebDriver BiDi](https://www.w3.org/TR/webdriver-bidi/)
- [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
