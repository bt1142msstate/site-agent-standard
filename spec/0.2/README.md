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
  live subscriptions.
- **Navigation** atomically applies declared state and verifies the smallest
  exact visible target without an inferred DOM fallback.
- **Action** defines schema-validated prepare, confirm, cancel, reconciliation,
  audit, and optional durable-task stages through authoritative host handlers.

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
