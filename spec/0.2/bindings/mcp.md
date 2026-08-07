# MCP binding

This binding is informative. MCP is not required for Site Agent conformance.

- Public or application-selected Query resources may be MCP resources when
  directly readable. Parameterized Query requests may be bounded tools whose
  schemas derive from semantic filters.
- Navigation may be a tool that accepts a semantic destination. It never accepts
  a model-authored URL, selector, database path, or credential.
- Action preparation and confirmation remain separate. An MCP tool may prepare a
  reviewable plan, but cannot silently approve the consequential operation it
  proposed. An MCP App must use this same consent, audit, and handler path.
- The binding reauthorizes the actor on every stateless request. Application
  state is carried by explicit opaque references rather than protocol sessions.
- Bindings negotiate extensions independently of Site Agent versions. A host
  advertising `io.modelcontextprotocol/tasks` returns a task only when the
  client advertises that extension on the request and the server chooses it.
- Task projection uses `tasks/get`, `tasks/update`, and `tasks/cancel`. It does
  not expose task listing. Task creation is durable before returning the handle;
  clients respect `pollIntervalMs`, persist authorized handles for reconnect,
  and treat cancellation as cooperative acknowledgement.
- `input_required` requests retain their native trust and user-interaction
  requirements. Unique request keys prevent duplicate presentation or replay.
- A completed task result matches the original operation result schema. Every
  poll, update, cancel, notification subscription, and final read remains actor
  scoped and rate limited.

The Site Agent runtime exposes transport-neutral task state. An MCP server is
responsible for projecting that state into the negotiated extension's exact
wire shapes and JSON-RPC errors.
