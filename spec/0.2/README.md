# Site Agent Standard 0.2

Status: public draft.

Site Agent Standard defines a transport-neutral contract that lets an authorized
programmatic client discover what a site can answer, navigate to, observe, and
change. It does not define natural-language interpretation, authentication, a
database schema, or a required browser or network transport.

## Profiles

- **Core** defines manifests, capability identity and lifecycle, permissions,
  opaque references, semantic destinations, versioning, and privacy-safe
  telemetry.
- **Query** defines schema-validated, bounded reads with opaque cursor
  pagination, freshness, aggregation declarations, relationships, and optional
  live subscriptions. Local static resources also declare how their content is
  materialized and prove parity with the reachable user surface.
- **Navigation** atomically applies declared state and verifies the smallest
  exact visible target without an inferred DOM fallback.
- **Action** defines schema-validated prepare, confirm, cancel, reconciliation,
  audit, and optional durable-task stages through authoritative host handlers.
- **Presentation** optionally renders instructional cursor travel, exact target
  framing, click feedback, visible typing, local sound cues, mute, and reduced
  motion. See [Presentation](presentation.md) and
  [tutorial artifact acceptance](artifacts.md).
- **Operability** validates independent exact-navigation, bounded-query, and
  ACT-compatible accessibility evidence across desktop and mobile/touch. Its
  aggregate score is a release signal and MUST NOT be represented as a WCAG
  conformance determination.

## Version and capability lifecycle

`standardVersion` identifies the feature set. `manifestVersion` versions the
site contract, while `capabilityRevision` changes whenever the effective
permission-filtered catalog or adapter semantics change. Clients MUST NOT infer
compatibility from `manifestVersion`; they negotiate a supported
`standardVersion` and ignore only explicitly permitted `x-` extensions.

Capabilities MAY be `active`, `deprecated`, or `sunset`. Deprecated
capabilities identify a replacement or sunset time. Sunset capabilities MUST
NOT execute. Permission-filtered manifests and bindings MUST preserve lifecycle
metadata so clients can migrate without guessing.

### Revisioned capability snapshots

A runtime MUST expose the caller-authorized catalog as a snapshot containing
`standardVersion`, `manifestVersion`, `capabilityRevision`, and the filtered
manifest. When the active page, session, permissions, feature availability, or
adapter semantics change, a subscribed client MUST receive a new snapshot. A
client MUST NOT continue invoking a removed or sunset capability from an older
snapshot, and the host still reauthorizes every invocation.

## Runtime validation

All filter values, Query results, Navigation state, Action inputs,
confirmations, completed Action outputs, event payloads, and durable-task
outputs MUST validate against their JSON Schema 2020-12 declarations at the
host boundary. A model-generated value is never trusted merely because it came
from structured output.

## Materialized user content

A local static Query resource MUST declare its materialization basis, stage,
surface-parity requirement, and nested-content behavior. A resource based on a
rendered user surface MUST be extracted only after templates, includes,
components, and declared reachable UI state are assembled. Raw wrapper files,
unexpanded fragments, and source placeholders are not the user surface and MUST
NOT be treated as complete query evidence.

Conformance compares normalized materialized content with the host's rendered
or accessibility-supported user surface. Sites MAY instead declare a canonical
structured source or readable document text when that source is authoritative;
if the same facts are also shown in the UI, the host still declares and proves
surface parity. The standard does not require runtime browser scraping.

### Nested result provenance and reveal

When a Query result is sourced from content inside a linked document, viewer,
disclosure, dialog, frame, or other nested surface, its materialization MUST set
`nestedDestination` to `exact-reveal-required`. The referenced Navigation
destination MUST declare an ordered host-adapter `reveal` path that begins at
the route, includes the nested resource, and ends at an exact semantic target.
Any semantic state needed to reveal the result, such as a document page,
selected record, filter, range, tab, or open disclosure, is part of the same
destination intent.

The Query result MUST bind its source provenance to an opaque target reference
and declared target kind. A Query resource MAY declare `resultTargetKind` as a
safe resource-wide default; a single-kind destination MAY supply that kind by
safe inference. Otherwise each result supplies its own allowed exact kind.
Navigation MUST apply and verify every reveal step
before it reports the final target visible. Reaching the outer page, resource
card, download link, viewer shell, or document cover does not satisfy the
contract. An adapter MUST fail when it cannot reveal the exact nested source;
it MUST NOT substitute an outer surface or inferred DOM text.

Reveal declarations contain semantic step IDs, state keys, and target kinds.
They never contain selectors, model-authored URLs, database paths, credentials,
or document storage internals. Hosts remain responsible for mapping those
semantic declarations to their own components and document viewers.

A conforming stepwise coordinator invokes only the semantic host handler for
the current step and MUST independently verify its observable result before
advancing. Every step is bounded and cancellable. A timeout, missing handler,
out-of-order proof, or inexact final target fails the whole navigation.

## Query discovery and catalog scale

Query resources MAY declare aliases, keywords, and example information needs.
Discovery MUST search only the caller's current permission-filtered resources
and MUST NOT expose denied capability metadata. Batch reads remain bounded,
reauthorize and validate each individual request, and report partial failure
without disguising it as complete success.

Bindings MAY broker a large catalog behind a discovery tool and a generic read
tool. Brokerage changes tool exposure only; it does not weaken resource IDs,
schemas, limits, provenance, authorization, or freshness semantics.

### Compound Query efficiency and evidence

A discovery operation MAY accept several keyed information needs and MUST rank
each need only against the active caller-authorized catalog. A brokered read
SHOULD accept a bounded keyed request array so a model can obtain independent
frontend, backend, and document evidence in one tool call. The host still
reauthorizes and validates every child request.

Batch execution MUST preserve caller order and keys, report child failures, and
publish privacy-safe metrics for requested, executed, deduplicated, and host
transport calls. Exact duplicate requests MUST execute once. A broader mode MAY
satisfy another mode only when the Query resource declares that relationship in
`modeCoverage`; a runtime MUST NOT infer coverage from field names or sample
results. An optional host `executeBatch` adapter carries the validated unique
requests in one transport. Snapshot consistency may be claimed only when every
resource belongs to one declared snapshot-capable batch group.

Sparse result selection is opt-in: a model may request only fields in
`selectableFields`, and omitted selection uses `defaultFields`. Selection never
grants field authority or weakens result-schema validation.

Every normalized result MUST state completeness as `complete`, `partial`, or
`unknown`, list material limitations, and carry at least its semantic resource
ID plus available `asOf` and revision provenance. Pagination, truncation, or a
source-declared partial result forces partial status. Models MUST disclose
partial evidence and MUST NOT turn unavailable or unknown evidence into zero.
Quality gates SHOULD use independently reviewed expected facts and sources to
measure exact answer accuracy, evidence coverage, latency, model tool calls,
internal reads, deduplication, and host transport calls.

## Operability evidence

An Operability claim requires an independent inventory digest, every active
destination at all declared desktop and mobile/touch viewports, every active
Query resource, keyboard and programmatic input modes, bounded durations, and
ACT-compatible automated plus manual or hybrid accessibility-rule evidence.
Navigation evidence proves exact state, visible and unobscured focus, keyboard
reachability, no trap, and full reveal depth. Query evidence proves allowed and
denied cases, filters, result schemas, bounds, empty/error states, and
provenance. Reports keep navigation, query, and tested accessibility pass rates
separate even when presenting an aggregate release score.

## Action reconciliation

An Action plan retains semantic intent and a stable opaque target reference. At
confirmation, the host reloads current authorized state and classifies it as
unchanged, equivalent, non-conflicting, conflicting, or missing. Equivalent
outcomes complete idempotently. Declared non-conflicting changes may be rebased.
A meaningful conflict produces a replacement preview or rejection. Timestamp
drift alone is not a semantic conflict.

Long-running Actions declare `taskSupport`. Durable task creation is
server-directed: a client advertises support, but the host decides per request
whether work becomes a task. Durable task IDs are opaque, high entropy, actor
scoped, and not listable. Task states are `working`, `input_required`,
`completed`, `failed`, and `cancelled`. Input responses use unique request keys
that are never reused during a task lifetime. Completed results validate against
the original Action output schema. Cancellation is cooperative acknowledgement,
not proof that work stopped or rolled back. Task polling, input updates,
cancellation, and result retrieval reauthorize the caller and do not weaken
idempotency, output validation, audit, TTL, or rate-limit requirements.

## Cancellation, deadlines, and problems

Every Query, Navigation, Action, subscription, and task operation MAY carry an
abort signal, deadline, and privacy-safe correlation ID. The runtime MUST reject
an already-cancelled or expired request before calling its host adapter. Host
adapters MUST observe cancellation and deadlines before irreversible effects
and SHOULD stop cooperative work promptly. Cancellation never implies rollback.

Failures MUST be representable as a transport-neutral structured problem with a
stable code, category, retryability, remediation, required-permission summary,
correlation ID, and `partialEffects` classification. Serialized problems MUST
exclude stacks, causes, prompts, records, private references, and credentials.
Transports MAY project this structure into their native error format.

## Coverage evidence

A complete coverage claim MUST be backed by executable, itemized evidence
generated from an independent inventory of the user-visible and user-invokable
surface, not by recounting the manifest or backend handler registry. Each item
identifies its actor class and a privacy-safe stable source hash. Query items
count as covered only when queryable, Navigation items only when navigable, and
Action items only when executable; being able to describe or navigate to an
Action does not make that Action covered.

A complete claim additionally requires a real rendered-state crawl across every
declared workflow state at desktop and mobile-touch viewports. Static source
inspection may support a partial inventory, but it cannot observe conditional,
template-instantiated, permission-dependent, or runtime-created controls and
therefore cannot prove completeness by itself.

Every discovered item MUST be classified as covered, reviewed-restricted, or
unresolved. `visibleSurfaces: complete` requires zero unresolved Query or
Navigation items independently; `humanActions: complete` requires zero
unresolved Action items independently. A restriction is valid only for a legal, security, privacy,
provider, human-judgment, or physical-presence boundary, and records its policy
authority, reviewing role, review time, and concrete reason. Missing adapters,
technical debt, UI-only implementations, and implementation inconvenience are
unresolved—not exemptions. Complete conformance requires zero unresolved items
for every actor class. This is 100% capability accountability: every safely
automatable Action is executable and every genuine exception is explicit.

## Bindings

The standard remains transport neutral. Normative capability semantics can be
projected into:

- MCP Resources and prepare-only Tools;
- in-page WebMCP tools that reuse the active page and user session;
- Arazzo workflow descriptions;
- AsyncAPI event descriptions;
- WebDriver BiDi or another browser-control transport beneath Navigation.

Bindings MUST NOT expose host selectors, database paths, credentials, or permit
a transport to bypass Action confirmation and authoritative handlers.
Bindings negotiate their own versions and extensions independently from
`standardVersion`. See the current [browser/WebMCP](bindings/browser.md) and
[MCP](bindings/mcp.md) guidance.

## Exact target selection

A Navigation adapter MAY return an ordered set of exact semantic target
candidates. The runtime ranks candidates by whether they can fit after
scrolling, semantic precision, and rendered size; declaration order is the
final tie-break. A candidate's current off-screen position MUST NOT make it lose
to a broader container when it can be scrolled fully into the active visible
region, including clipping containers, dialogs, sticky headers, and the visual
viewport. The adapter MUST declare a smaller value, field, control, or text
element for a broad card or section; the runtime then frames and highlights
that concise candidate instead of leaving the user with a partially visible
container.

Candidate resolution is host-declared. A runtime MUST NOT search arbitrary DOM
text, infer a selector, or substitute an undeclared descendant. If no declared
candidate can be resolved, Navigation fails rather than highlighting a broad or
unrelated surface.
Arazzo projections MUST reference a valid OpenAPI, AsyncAPI, or Arazzo source
description and resolvable source operations; a Site Agent capability ID alone
is not an Arazzo operation.

## Conformance

Manifest validation proves only structural validity. Full conformance requires
the executable proofs in `conformance.md`; a manifest's coverage declaration is
not evidence by itself. Reports contain capability IDs, status, durations, and
sanitized failure classes, never record contents or opaque references.

Normative keywords are interpreted as described by RFC 2119 and RFC 8174 when
written in uppercase.
