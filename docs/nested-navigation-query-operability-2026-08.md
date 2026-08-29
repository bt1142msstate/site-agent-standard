# Navigability, query discovery, and operability benchmark — August 2026

## Decision

Site Agent 0.2 now treats a site as operable only when an independent run can
prove three separate things: every declared destination is exactly reachable
at desktop and mobile-touch sizes, every declared information source behaves
correctly for allowed and denied actors, and a transparent accessibility-rule
set passes. The combined score is a release signal, not a WCAG conformance
claim.

This closes three practical gaps in the earlier draft: deep reveal paths were
declared but left entirely to a monolithic host callback, large information
catalogs became unwieldy as one tool per resource, and rendered-label checks did
not establish whole-flow operability.

## Comparative gap matrix

| System | Primary strength | Exact semantic UI reveal | Permission-scoped frontend and backend query | Independent navigability/accessibility gate | Site Agent response |
|---|---|---:|---:|---:|---|
| WebMCP | Page-scoped, progressively enhanced in-browser tools | Host tool dependent | Tool dependent | No | Keep WebMCP as a live binding; broker large query catalogs and retain Site Agent authorization/conformance. |
| MCP | Interoperable tools, resources, prompts, tasks, and lifecycle | Transport dependent | Server dependent | No | Project capabilities without weakening confirmation, permission, or exact-target rules. |
| OpenAPI/Arazzo | HTTP operations and multi-step API workflows | No | Backend/API only | No | Continue using Arazzo as a workflow projection, not a browser-navigation substitute. |
| WebDriver BiDi | Bidirectional browser automation transport | Locator/automation layer | No domain query contract | No | Use as an optional transport below semantic Navigation. |
| WCAG 2.2 + ACT | Accessibility requirements and transparent test-rule evidence | Human-interface focus | No | Yes, within a scoped evaluation | Reuse ACT-compatible automated/manual evidence; prohibit claims that a numeric Site Agent score establishes WCAG conformance. |
| WebArena / WorkArena / REAL | Realistic end-to-end agent benchmark tasks | Benchmark-specific | Benchmark-specific | Task success, not a site contract | Adopt deterministic success evidence and pathological multi-layer fixtures. |

No adjacent standard is replaced. The differentiator is the combination of a
permission-filtered site contract, bounded structured query, exact semantic
reveal, safe mutation, and reproducible operability evidence.

## Implemented requirements

### Stepwise nested reveal

`runNavigationReveal` invokes one declared semantic step at a time and refuses
to advance until the host independently verifies it. Each step has a bounded
timeout and supports cancellation. The final result must be exact, visible, and
of a target kind allowed by the destination. A query bound to a destination
can supply a resource-wide `resultTargetKind`, safely inherits it when the
destination permits exactly one kind, or supplies an allowed kind per result.

The conformance fixture traverses route, tab state, modal, disclosure,
virtualized list, Shadow DOM, iframe, and final document control. It runs at
desktop, tablet-touch, and mobile-touch sizes and remains keyboard operable.

### Query discovery at scale

Query resources can declare aliases, keywords, and examples. The runtime
provides permission-filtered lexical discovery and bounded batch reads. When a
WebMCP catalog exceeds 24 resources, the binding exposes a discovery broker and
one generic read tool instead of flooding the model with one tool per resource.
The host still validates the chosen resource, mode, filters, limits, and actor
for every call.

### Evidence-based operability

The optional Operability profile fails closed unless evidence includes:

- every active destination at every declared desktop and mobile/touch viewport;
- exact state, visibility, keyboard reachability, visible/unobscured focus,
  no keyboard trap, reveal depth, and a time budget;
- every active query resource with allowed, denied, filter, result-schema,
  bounded, empty, error, provenance, and time-budget cases;
- automated and manual or hybrid evidence for keyboard operation, keyboard
  traps, focus order, focus visibility, focus obscuring, name/role/value,
  reflow, target size, status messages, and error identification; and
- an independent inventory digest and privacy-safe evidence.

The reference runtime reports navigation, query, and tested-accessibility-rule
pass rates plus an aggregate operability score. It always labels WCAG
conformance as `none`; a complete WCAG evaluation still requires the scoped
human and assistive-technology work defined by WCAG and its supporting methods.

## Adversarial test model

The reusable fixture covers the failure patterns most likely to create a site
that is technically mapped but practically unreachable:

1. roving-tabindex tabs and keyboard arrows;
2. a modal focus scope;
3. a disclosure that must be opened;
4. a virtualized scroll region;
5. a late-mounted record;
6. open Shadow DOM;
7. an embedded same-origin frame and exact final control;
8. sticky or clipped viewports and mobile reflow; and
9. permission-filtered query discovery with a live status announcement.

Cross-origin frames, closed Shadow DOM, canvas-only controls, and protected
document viewers remain explicit host-adapter boundaries. The standard does not
permit DOM guessing to cross them.

## Primary evidence

- [OpenAI WebMCP documentation](https://learn.chatgpt.com/docs/webmcp)
- [WebMCP proposal](https://github.com/webmachinelearning/webmcp)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2025-06-18/index)
- [OpenAPI 3.2](https://spec.openapis.org/oas/v3.2.0.html)
- [WebDriver BiDi](https://www.w3.org/TR/webdriver-bidi/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [ACT Rules Format 1.1](https://www.w3.org/TR/act-rules-format/)
- [WAI-ARIA Authoring Practices: keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [WebArena paper](https://arxiv.org/abs/2307.13854)
- [WorkArena paper](https://arxiv.org/abs/2403.07718)
- [REAL benchmark paper](https://arxiv.org/abs/2504.11543)

## Remaining evidence limits

The reference suite proves the contract and representative pathological
interfaces, not universal site success. Independent adopters, assistive-
technology user testing, cross-browser runs beyond the supported matrix, and
real-world interoperability reports are still required before a stable 1.0 or
any claim of market leadership.

## Reference integration result

The unreleased 0.15.0 runtime validated Afternoon Adventure's existing 0.2
manifest without changing the application dependency: 53 Query resources, 96
Navigation destinations, 82 Actions, 322 mapped controls, 64 tutorials, and 17
executable proofs remained conformant. Authorized discovery ranked family
billing and staff-onboarding resources from the 53-resource catalog. The same
family-billing search as an unauthenticated actor exposed only the two relevant
public resources and no private billing capability metadata.
