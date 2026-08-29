# Conformance

## Claims

- **Structurally valid** means the complete manifest and every embedded JSON
  Schema validate against the 0.2 normative schemas.
- **Declared complete** means the site claims complete visible-surface and
  human-action coverage. This is an inventory assertion, not conformance proof.
- **Execution verified** means the applicable profile proofs ran against a host
  adapter and passed without privileged test shortcuts.
- **Fully conformant** requires structural validity, Query, Navigation, and Action,
  declared completeness, and execution verification.
- **Tutorial conformant** additionally requires the Presentation profile and its
  desktop and touch-mobile browser proofs.
- **Operability conformant** additionally requires independent all-capability
  navigation, query, and accessibility evidence without a WCAG claim.

The CLI MUST NOT report full conformance without an executable adapter.

## Required proofs

1. Obtain permission-filtered catalogs for authorized and denied actors and
   prove that declarations do not grant authority.
2. Query structured data, enforce filter and result schemas, exercise bounded
   pagination where declared, and navigate to the returned exact destination.
3. For every local static Query resource, materialize content from its declared
   basis and prove that nested templates/components are resolved. When surface
   parity is required, compare normalized facts against every declared reachable
   rendered state; raw wrapper fragments are not valid evidence.
4. Apply and verify all Navigation state before resolving, revealing, focusing,
   and highlighting the smallest target at desktop, tablet-touch, and
   mobile-touch sizes. Prove that an oversized preferred target yields to the
   next declared precise candidate, while an undeclared DOM descendant is never
   selected.
5. For every Query materialization that requires an exact nested destination,
   query representative results and prove the ordered route, state,
   nested-resource, and target reveal steps individually. The final target kind
   and opaque reference MUST match the result provenance. Prove that stopping
   at the outer page, card, link, viewer shell, or document cover fails.
6. Prepare and confirm an Action, reject duplicate confirmation, validate the
   completed output, requery affected state, and navigate to the result.
7. Reconcile equivalent and non-conflicting changes, require a replacement
   preview for a meaningful conflict, and reject expired or unauthorized plans
   without partial effects.
8. For durable Actions, prove progress/result retrieval, cancellation, terminal
   state stability, current authorization, and opaque cursor/task identifiers.
9. For live Queries, prove subscription authorization, event schema validation,
   reconnect/cleanup behavior, and bounded resource use.
10. Reject malformed, sunset, unknown, over-broad, and permission-denied
   capabilities before invoking a host mutation.
11. Verify public discovery and every generated binding contain no authenticated
   capability, private extension, selector, storage path, database path,
   credential, private identifier, or tested record content.
12. When Presentation is claimed, prove cursor travel before action, exact
    target framing, hotspot/ripple anchoring, visible typing events, mute,
    reduced motion, cleanup, and desktop plus touch-mobile rendering.
13. For every mapped state, responsive variant, and supported theme, inspect a
    real browser's computed styles and rendered text geometry. Prove visible
    labels and WCAG 2.2 AA contrast; accessible names alone do not pass.
14. When a workflow declares multiple actors, prove synchronized client and
    Operations contexts on one monotonic timeline with verified step barriers
    and all declared contexts represented in the recording.
15. Validate source fingerprints using stable-content normalization, fully
    decode accepted video and required audio through the mapped timeline, and
    prove the deployment directory was clean, symlink-free, and isolated.
16. Obtain a permission-filtered capability snapshot and prove its standard,
    manifest, and capability revisions match the effective catalog.
17. Cancel and deadline-expire representative operations before host dispatch;
    prove the host adapter was not called and the structured problem reports no
    partial effects. Hosts additionally test cooperative cancellation around
    their own irreversible boundaries.
18. Generate Query, Navigation, and Action coverage evidence from independent
    host inventories. Validate counts, stable digest, reviewed exemptions, and
    zero unresolved entries for complete claims.
19. When Operability is claimed, prove every active destination at each declared
    desktop and mobile/touch viewport with exact state, visibility, full reveal
    depth, keyboard reachability, visible and unobscured focus, no keyboard
    trap, and the declared time budget.
20. Prove every active Query resource for allowed and denied actors, valid and
    invalid filters, bounded results, empty and error states, result schemas,
    provenance, and the declared time budget. Record transparent automated and
    manual or hybrid results for the required accessibility rules. The report
    MUST state that it is not a WCAG conformance determination.
21. For compound Query paths, prove multi-need discovery remains permission
    filtered; exact duplicates and declared mode coverage execute once; a host
    batch adapter uses one transport; keyed child order and failures survive;
    sparse fields stay allowlisted; and every result carries non-unknown
    completeness plus semantic provenance. Run independently sourced answer
    fixtures that gate correctness, fact/source coverage, partial disclosure,
    latency, model tool calls, internal reads, and transport calls.

An exporter that claims compatibility with another protocol MUST validate its
generated artifact against that protocol's official schema when one exists and
MUST satisfy normative requirements the schema cannot prove, including
resolvable cross-document operation references.

Hosts MUST run proofs against isolated fixtures or a non-production environment.
Conformance reports may retain capability IDs, pass/fail status, durations, and
sanitized failure codes only.
