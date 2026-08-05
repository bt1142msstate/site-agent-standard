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
  motion. See [Presentation](presentation.md).

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
and declared target kind. Navigation MUST apply and verify every reveal step
before it reports the final target visible. Reaching the outer page, resource
card, download link, viewer shell, or document cover does not satisfy the
contract. An adapter MUST fail when it cannot reveal the exact nested source;
it MUST NOT substitute an outer surface or inferred DOM text.

Reveal declarations contain semantic step IDs, state keys, and target kinds.
They never contain selectors, model-authored URLs, database paths, credentials,
or document storage internals. Hosts remain responsible for mapping those
semantic declarations to their own components and document viewers.

## Action reconciliation

An Action plan retains semantic intent and a stable opaque target reference. At
confirmation, the host reloads current authorized state and classifies it as
unchanged, equivalent, non-conflicting, conflicting, or missing. Equivalent
outcomes complete idempotently. Declared non-conflicting changes may be rebased.
A meaningful conflict produces a replacement preview or rejection. Timestamp
drift alone is not a semantic conflict.

Long-running Actions declare `taskSupport`. Durable task IDs are opaque and
actor scoped. Task status, progress, cancellation, and result retrieval do not
weaken authorization, idempotency, output validation, or audit requirements.

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
