# Browser and WebMCP binding

This binding is informative. Browser or WebMCP support is not required for Site
Agent conformance.

- Discover `/site-agent.json` through the page's
  `data-site-agent-manifest` link. Public discovery contains public capabilities
  only; the host supplies the active caller-authorized catalog after sign-in.
- Use `document.modelContext`. The older `navigator.modelContext` surface is not
  part of this binding.
- WebMCP registration requires an origin-isolated document and the browser's
  `tools` Permissions Policy. Cross-origin exposure is disabled unless the host
  delegates the policy and allowlists each secure origin explicitly.
- Registered tools MUST track the active `capabilityRevision`. A permission,
  page-state, feature, session, deprecation, or adapter change removes stale
  tools and registers the new filtered set without requiring a page reload.
- Query tools are read-only but may return untrusted content. Action tools expose
  preparation only; confirmation and execution remain visible host-controlled
  stages using the same authoritative handler as the human interface.
- A large Query catalog SHOULD expose permission-filtered resource discovery
  plus one generic read tool rather than registering an unbounded tool per
  resource. The broker MUST preserve resource schemas, limits, provenance,
  freshness, authorization, and active revision semantics.
- Tool registration and execution use abort signals. Unmount, sign-out, authority
  changes, navigation, and timeout release registrations and in-flight work.
- Tool names, descriptions, parameter descriptions, and results SHOULD stay
  within the active WebMCP implementation's published character budgets.
- Navigation adapters activate the application view, apply every semantic state
  value, wait for data, verify complete state, and resolve one exact target. The
  manifest never supplies executable selectors or arbitrary scripts.
- Nested Navigation SHOULD use a stepwise coordinator that invokes and verifies
  route, state, nested-resource, and exact-target handlers in declaration order.
  A binding MUST NOT collapse a failed intermediate step into a successful
  outer-page navigation.

The Site Agent capability subscription is authoritative for registered-tool
lifecycle. A browser `toolchange` event is useful evidence for consumers but is
not a substitute for host reauthorization on each invocation.
