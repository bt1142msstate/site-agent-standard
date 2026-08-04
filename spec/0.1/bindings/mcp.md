# MCP binding

This binding is informative. MCP is not required for conformance.

- Public or application-selected Site Agent Query resources may be represented
  as MCP resources when their content is directly readable.
- Parameterized or model-selected Query requests may be represented as a
  bounded tool whose input schema is derived from the resource's semantic
  filters.
- Navigation may be represented as a tool accepting a semantic destination.
- Action preparation and confirmation must remain separate tool calls so a
  model cannot both propose and silently approve a consequential change.
- The MCP server must enforce the same actor permissions and opaque-reference
  rules as every other transport.
