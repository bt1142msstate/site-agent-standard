# Security and privacy requirements

1. The host remains authoritative for authentication, authorization, data
   validation, policy enforcement, and durable audit. Manifest permissions are
   declarations, never grants.
2. Every Query, subscription, Navigation, Action stage, and task request MUST
   re-evaluate the current actor and capability contract. Revoked access takes
   effect without waiting for a cached manifest or plan to expire.
3. References, cursors, plan IDs, task IDs, and event positions MUST be opaque,
   actor and tenant scoped, audience bound, short-lived when appropriate, and
   protected against replay. They MUST NOT encode usable database paths.
4. All declared JSON Schemas MUST be enforced at the host boundary. Structured
   model output is untrusted input and MUST NOT bypass schema, authorization,
   domain validation, confirmation, or reconciliation.
5. Model, tool, resource, or page content MUST NOT supply executable URLs,
   selectors, database/storage paths, credentials, signatures, unrestricted
   operators, or permission identifiers. Semantic IDs resolve inside the host.
6. Query and tool descriptions, static content, retrieved records, and tool
   results may contain prompt injection. Implementations MUST preserve a clear
   data/instruction boundary and mark externally controlled output as untrusted.
7. Public discovery MUST omit authenticated capabilities and private
   extensions. Authenticated catalogs MUST be permission filtered, cache
   partitioned by actor authority, and invalidated when authority changes.
8. Navigation MUST resolve exact semantic targets through a host adapter. It
   MUST verify requested state, visibility, clipping, focus, and hit testing and
   MUST release interaction locks on cancellation, failure, or timeout.
9. State-changing Actions MUST use authoritative domain handlers, current-state
   reconciliation, durable idempotency, explicit side-effect declarations,
   risk-appropriate confirmation, and audit evidence. A browser-memory set is
   not sufficient durable duplicate protection.
10. Confirmations MUST identify the requesting site, actor, target, meaningful
    change, external recipients or financial effects, and whether the operation
    is reversible. Sensitive credentials and payment secrets require an
    out-of-band, origin-visible host flow rather than model-visible form data.
11. Open-world and external side effects MUST be declared. Implementations MUST
    apply allowlists, quotas, request and result size limits, rate limits, and
    abuse controls appropriate to each capability.
12. Cross-origin exposure requires an explicit trusted-origin policy. Tokens
    MUST be audience bound and MUST NOT be passed through to another service.
13. Durable tasks and subscriptions MUST support cleanup, bounded retention,
    current authorization, terminal-state stability, and denial-safe reconnect.
14. Telemetry MUST exclude prompts, record contents, opaque references, personal
    data, credentials, and secrets. Capability IDs, status, duration, standard
    version, and sanitized failure classes are permitted.
15. Conformance fixtures MUST be isolated from production data, avoid real
    notifications or financial effects, and prove cleanup after success,
    cancellation, timeout, and partial failure.
