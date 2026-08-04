# Security requirements

1. The host application remains authoritative for authentication and
   authorization. Manifest permissions are declarations, not grants.
2. Every Query and Action invocation MUST re-evaluate the current actor and
   capability permission contract.
3. Record references exposed to an agent MUST be opaque, scoped, short-lived
   when appropriate, and unusable as database paths.
4. Model or client output MUST NOT supply URLs, CSS selectors, database paths,
   storage paths, credentials, secrets, signatures, or unrestricted operators.
5. Navigation MUST resolve semantic destinations through a host adapter and
   MUST report success only for an exact, rendered, visible target after the
   full requested state is verified.
6. State-changing Actions MUST use authoritative domain handlers, stale-state
   guards, idempotency, and the confirmation policy declared by the Action.
7. Public discovery MUST omit authenticated capabilities and implementation
   extensions. Private capability catalogs MUST be filtered for the actor.
8. Telemetry MUST exclude prompts, record contents, opaque references, personal
   data, and secrets. Capability IDs, status, duration, and failure classes are
   permitted.
