# Conformance

## Claims

- **Core conformant**: the manifest validates against version 0.1 and capability
  discovery is permission scoped.
- **Query conformant**: every declared resource is bounded, uses semantic
  filters, returns structured values and opaque references, and has tests for
  authorization and denial.
- **Navigation conformant**: the adapter atomically applies and verifies all
  requested state, resolves the smallest exact target, and proves it visible.
- **Action conformant**: every declared action prepares and confirms through an
  authoritative handler with current authorization, stable-reference
  reconciliation, idempotency, and audit evidence. Timestamp drift alone does
  not constitute a semantic conflict.
- **Fully conformant**: all profiles pass and `visibleSurfaces` plus
  `humanActions` are both declared `complete`.

## Required cross-profile proofs

1. Query a record, navigate to its returned semantic destination, and verify the
   exact record or field.
2. Prepare and confirm an Action, reject a duplicate confirmation, requery the
   affected resource, and navigate to the resulting state.
3. Reconcile an equivalent or non-conflicting concurrent change, require a new
   preview for a meaningful conflict, and reject an expired plan without a
   partial change.
4. Deny a capability when its permission contract is not satisfied.
5. Exercise Navigation at desktop, tablet-touch, and mobile-touch sizes against
   delayed rendering, nested scrolling, sticky UI, and target replacement.

Conformance reports may contain capability IDs, pass/fail status, durations,
and sanitized failure codes. They must not retain tested record contents.
