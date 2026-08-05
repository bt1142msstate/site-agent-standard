# Conformance

## Claims

- **Structurally valid** means the complete manifest and every embedded JSON
  Schema validate against the 0.2 normative schemas.
- **Declared complete** means the site claims complete visible-surface and
  human-action coverage. This is an inventory assertion, not conformance proof.
- **Execution verified** means the applicable profile proofs ran against a host
  adapter and passed without privileged test shortcuts.
- **Fully conformant** requires structural validity, all three profiles,
  declared completeness, and execution verification.

The CLI MUST NOT report full conformance without an executable adapter.

## Required proofs

1. Obtain permission-filtered catalogs for authorized and denied actors and
   prove that declarations do not grant authority.
2. Query structured data, enforce filter and result schemas, exercise bounded
   pagination where declared, and navigate to the returned exact destination.
3. Apply and verify all Navigation state before resolving, revealing, focusing,
   and highlighting the smallest target at desktop, tablet-touch, and
   mobile-touch sizes.
4. Prepare and confirm an Action, reject duplicate confirmation, validate the
   completed output, requery affected state, and navigate to the result.
5. Reconcile equivalent and non-conflicting changes, require a replacement
   preview for a meaningful conflict, and reject expired or unauthorized plans
   without partial effects.
6. For durable Actions, prove progress/result retrieval, cancellation, terminal
   state stability, current authorization, and opaque cursor/task identifiers.
7. For live Queries, prove subscription authorization, event schema validation,
   reconnect/cleanup behavior, and bounded resource use.
8. Reject malformed, sunset, unknown, over-broad, and permission-denied
   capabilities before invoking a host mutation.
9. Verify public discovery and every generated binding contain no authenticated
   capability, private extension, selector, storage path, database path,
   credential, private identifier, or tested record content.

An exporter that claims compatibility with another protocol MUST validate its
generated artifact against that protocol's official schema when one exists and
MUST satisfy normative requirements the schema cannot prove, including
resolvable cross-document operation references.

Hosts MUST run proofs against isolated fixtures or a non-production environment.
Conformance reports may retain capability IDs, pass/fail status, durations, and
sanitized failure codes only.
