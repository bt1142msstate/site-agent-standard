# Site Agent query efficiency research

Audience: Site Agent implementers and Afternoon Adventure maintainers  
Date: August 29, 2026  
Decision: define and validate the smallest safe request path for accurate AI answers across frontend, backend, and document sources.

## Executive answer

The existing v0.15 runtime already permission-filters discovery and supports a bounded in-process batch, but the public broker still encourages one resource per tool call. The next revision should make one multi-need discovery call and one keyed batch read the default compound-answer path, then prove rather than assume correctness. It must consolidate only exact duplicates or host-declared mode coverage, use a single host batch transport when available, expose allowlisted sparse fields, and return explicit completeness, provenance, and request-cost evidence.

## Baseline

Afternoon Adventure's August 29 release evaluation passed 15/15 cases with an average of one model tool call, 5,291 ms average latency, and 8,465 ms p95 latency. Six query answers used ten internal reads. One directory question issued three same-resource reads; one records result could safely cover its identical-filter count read when that coverage is declared. The standard's WebMCP broker accepted only one resource per `site.query` call, and normalized Query results did not uniformly state completeness, source revision, or transport count.

## Evidence and implications

- MCP tools can declare an output schema and return structured content; result metadata is preserved for caching optimizations. Site Agent should project normalized evidence into structured results rather than forcing a model to parse prose. Source: Model Context Protocol, “Tools” and current schema, 2025-11-25, https://modelcontextprotocol.io/specification/2025-11-25/server/tools and https://modelcontextprotocol.io/specification/2025-11-25/schema
- MCP resources support cursor pagination, subscriptions, and list/resource update notifications. Site Agent completeness must distinguish a complete bounded result from a page with more data, and cached results must remain invalidatable. Source: Model Context Protocol, “Resources,” 2025-11-25, https://modelcontextprotocol.io/specification/2025-11-25/server/resources
- WebMCP imperative tools expose JSON input schemas and execute in the active document/origin context; the draft does not prescribe how a browser agent ultimately transports those tools. Site Agent can therefore provide one browser-facing batch tool without coupling its core semantics to a proprietary model protocol. Source: W3C Web Machine Learning Community Group, “WebMCP,” Draft Community Group Report, August 26, 2026, https://webmachinelearning.github.io/webmcp/
- OpenAI Structured Outputs with `strict: true` constrains tool arguments to a supported JSON Schema subset, but application-side validation remains necessary for incompatible paths and edge cases. Site Agent should keep validating every filter and result at the host boundary. Source: OpenAI, “Function Calling in the OpenAI API,” updated August 2026, https://help.openai.com/en/articles/8555517-function-calling-in-the-openai-api
- HTTP caching reduces latency and bandwidth only when reuse preserves request semantics; validators such as ETags enable conditional revalidation, and unsafe requests must not be answered from cache. Site Agent should carry freshness/revision evidence and permission-scoped invalidation semantics rather than introduce a shared opaque data cache. Source: IETF, RFC 9111 “HTTP Caching,” June 2022, https://www.rfc-editor.org/rfc/rfc9111.html

## Design decisions

1. Multi-need discovery returns ranked authorized candidates for up to twenty keyed needs in one call.
2. Batch reads preserve request keys and order, validate each child, reject duplicate keys, and report partial failures explicitly.
3. Exact duplicates collapse automatically. Cross-mode collapse requires a resource-authored `modeCoverage` declaration.
4. A host `executeBatch` adapter receives only validated unique requests and allows one backend transport. Snapshot consistency is allowed only within one declared snapshot-capable group.
5. Sparse selection uses `selectableFields` and `defaultFields`; unknown fields fail before adapter dispatch.
6. Normalized results include complete/partial/unknown evidence, limitations, semantic source IDs, timestamps, and revisions.
7. Release gates use deterministic expected facts and sources, not the manifest itself or an ungrounded model judge. They bound tool calls, transport calls, latency, and undisclosed partial answers.

## Limitations

The standard cannot guarantee that every model chooses the optimal query on every prompt. It can make the optimal path obvious, validate it, measure deviations, and reject unsupported claims. Cross-resource semantic joins remain host/domain logic; the runtime does not infer joins from similarly named fields. Cache storage remains host controlled so permission boundaries and monetary/current-state rules are not weakened.
