<p align="center">
  <img src="docs/site-navigator-mark.svg" width="104" height="104" alt="Site Agent Standard logo">
</p>

# Site Agent Standard

Site Agent Standard is a transport-neutral contract for sites that want
authorized software agents, deterministic automation, and tutorials to use the
same capabilities as a person. It combines independently conforming
profiles without collapsing them into one unsafe API:

- **Query** returns bounded, permission-scoped information and opaque records.
- **Navigation** applies complete UI state and verifies the smallest exact
  visible target.
- **Action** previews, confirms, executes, audits, and verifies changes through
  the site's authoritative domain handlers.
- **Presentation** optionally renders those capabilities with an instructional
  cursor, framing, click ripple, visible typing, and local sound cues.

The repository includes the normative 0.2 draft, a schema-validating reference
runtime, executable CLI conformance proofs, MCP/WebMCP/Arazzo/AsyncAPI bindings,
and the battle-tested Site Navigator engine as the Navigation implementation.

## Install

```bash
npm install github:bt1142msstate/site-agent-standard#v0.12.0
```

```js
import {
  createSiteAgent,
  createSiteNavigator,
} from "@bt1142msstate/site-agent-standard";
```

Version `0.4.0` intentionally renames the package from
`@bt1142msstate/site-navigator`. Existing `v0.3.1` and older tags retain their
original package identity.

Version `0.5.0` added the Action reconciliation contract. Implementations
distinguish equivalent, safely rebaseable, conflicting, and missing targets
instead of treating every revision change as a failed action.

Version `0.6.0` adds the 0.2 draft: runtime JSON Schema enforcement, cursor and
freshness semantics, live Query subscriptions, durable Action tasks, capability
lifecycle metadata, executable conformance evidence, and standard bindings.

Version `0.7.0` adds the optional first-party Presentation profile and browser
adapter. Normal agents remain silent; tutorial runners can enable the shared
pointer, ripple, motion, typing, and sound contract.

Version `0.8.0` requires local static Query resources to prove parity with
fully materialized user-visible content instead of indexing wrapper fragments.

Version `0.9.0` makes the complete instructional presentation theme reusable:
the browser adapter and offline recorder share exact click and keyboard sound
generation, nested framing matches tutorial motion, and audible mode is applied
correctly at controller creation.

Version `0.10.0` adds ordered exact Navigation candidates. A host can prefer a
complete record while declaring a concise value, field, control, or text
fallback. The runtime chooses the first candidate that fits the actual visible
region and never invents a descendant through DOM inference.

Version `0.10.1` ranks those host-declared candidates by fit after scrolling,
semantic precision, and rendered size. Compact values, controls, fields, and
reference text now win over broad containers and are scrolled fully into view.

Version `0.11.0` adds exact nested-result reveal contracts. Query evidence from
inside a PDF, linked document, disclosure, dialog, viewer, or frame carries a
host-declared semantic path through the outer route and nested resource to the
exact source target. The runtime verifies every step and rejects results that
stop at a wrapper, link, viewer shell, or document cover.

Version `0.12.0` adds rendered visual-quality evidence, synchronized
multi-actor tutorial contexts, stable timestamp-insensitive source
fingerprints, and complete media/deployment acceptance evidence. Conformance
now requires computed-browser-style label and contrast checks across every
mapped state, responsive variant, and supported theme; accessibility names
alone cannot prove that visible interface text actually renders.

```json
{
  "materialization": {
    "basis": "document-text",
    "stage": "build",
    "surfaceParity": "required",
    "nestedContent": "resolved",
    "nestedDestination": "exact-reveal-required"
  },
  "destinationId": "documents.excerpt"
}
```

The destination declares semantic `route`, `state`, `nested-resource`, and
`target` reveal steps. Its adapter returns the verified step IDs and exact final
target kind; selectors and storage paths remain private to the host.

## Publish a manifest

Serve a public-only discovery document at `/site-agent.json` and advertise it:

```html
<link rel="alternate" type="application/json" href="/site-agent.json"
      data-site-agent-manifest>
```

The public document must omit authenticated capabilities and implementation
extensions. A signed-in application may provide a permission-filtered manifest
through its host adapter.

See [the complete example](examples/basic/site-agent.json) and the
[normative draft](spec/0.1/README.md).

## Create an agent runtime

```js
import { createSiteAgent } from "@bt1142msstate/site-agent-standard";
import manifest from "./site-agent.json" with { type: "json" };

const agent = createSiteAgent({
  manifest,
  getContext: () => session.siteAgentContext(),
  adapters: {
    query: ({ resource, request, context }) =>
      dataAdapters.get(resource.id).query({ request, context }),
    navigation: ({ destination, intent }) =>
      navigationAdapters.get(destination.id).navigate(intent),
    action: {
      prepare: (input) => actions.prepare(input),
      confirm: (input) => actions.confirm(input),
      cancel: (input) => actions.cancel(input),
    },
  },
});
```

The standard does not give the model a database path, CSS selector, arbitrary
URL, or mutation envelope. Sites resolve semantic capability IDs and opaque
references inside their own authorization boundary.

## Instructional presentation

```js
import {
  createBrowserPresentationAdapter,
  createSiteAgent,
} from "@bt1142msstate/site-agent-standard";
import "@bt1142msstate/site-agent-standard/presentation.css";

const agent = createSiteAgent({
  manifest,
  presentation: { muted: false },
  adapters: {
    ...adapters,
    presentation: createBrowserPresentationAdapter(),
  },
});

await agent.presentation.click(document.querySelector("[data-example-target]"));
```

The built-in `standard-instructional-v2` preset is the complete default tutorial
theme: a crisp white pointer, eased nested scrolling, sticky-header-aware
framing, target outline, anchored click ripple, tactile click audio, visible
typing, and iPhone-inspired keyboard taps. The browser and offline soundtrack
APIs use the same deterministic sound generator, so recorded and interactive
presentation stay synchronized.

Presentation remains opt-in and muted by default for ordinary automation. A
tutorial enables the complete preset with `presentation: { muted: false }`;
individual adapters may still set `sounds: false`. Reduced-motion and mute
controls remain mandatory.

Offline recorders can create the exact same local effects without extracting
audio from a browser:

```js
import {
  SITE_AGENT_PRESENTATION_SAMPLE_RATE,
  mixPresentationSoundSamples,
} from "@bt1142msstate/site-agent-standard/presentation-audio";

mixPresentationSoundSamples(track, frame, "click", {
  eventIndex: 0,
  sampleRate: SITE_AGENT_PRESENTATION_SAMPLE_RATE,
});
```

## Generate tutorials

Use the [tutorial-authoring guide](docs/tutorial-authoring.md) to build a host
workflow layer, record independent desktop and touch-mobile variants, keep
narration replaceable, verify privacy-safe artifacts, and release only matching
accepted pairs. The guide includes an installable
[Codex skill example](examples/codex-skills/site-agent-tutorial-author/SKILL.md)
and the exact reusable prompt used to invoke it.

Tutorial conformance now requires a complete rendered-quality evidence matrix
for every mapped state, responsive viewport, and supported theme. The reference
checker reads browser computed styles and rendered text geometry, so an
accessible name cannot hide a missing or transparent visible label. It also
supports synchronized multi-actor workflows, stable timestamp-independent
source fingerprints, full A/V decoding, and isolated deployment acceptance.

## Query, navigate, and act

```js
const result = await agent.query({
  resourceId: "orders",
  filters: { status: "open", period: "year-to-date" },
});

await agent.navigate(result.items[0].destination);

const plan = await agent.prepareAction({
  actionId: "orders.archive",
  target: { reference: result.items[0].reference },
});

await agent.confirmAction({
  actionId: plan.actionId,
  planId: plan.planId,
  confirmation: true,
});
```

Every operation rechecks the current actor. A state-changing plan cannot be
confirmed twice through the reference runtime, and the authoritative host
handler remains responsible for durable idempotency and stale-state rejection.

## Verified navigation

The Navigation reference implementation handles nested two-axis scrollers,
sticky headers, clipped drawers, collapsed details, dialogs, open shadow roots,
delayed rendering, and target replacement. Application routes and selectors
stay in host adapters. There is deliberately no semantic DOM fallback.

```js
import {
  createNavigationProgress,
  createSiteNavigator,
} from "@bt1142msstate/site-agent-standard/navigation";
import "@bt1142msstate/site-agent-standard/navigation-progress.css";

const controller = createSiteNavigator({
  adapter: {
    getIntent: () => destination,
    activate: ({ intent }) => router.open(intent.route),
    applyState: ({ intent }) => view.applyAll(intent.state),
    isReady: () => view.isLoaded(),
    verifyState: ({ intent }) => view.matches(intent.state),
    resolveTarget: ({ intent }) => view.resolveExact(intent.target),
  },
  report: (state, descriptor) => progress.update(state, descriptor),
});

const progress = createNavigationProgress();
progress.setCancelHandler((reason) => controller.cancel(reason));
controller.start();
```

Success is reported only after requested state is verified, geometry is stable,
every clipping boundary contains the target, and hit testing confirms that the
target is not covered.

## Validate and test

```bash
site-agent validate ./site-agent.json
site-agent test ./site-agent.json --adapter ./site-agent.conformance.mjs
npm run check
```

`validate` checks structure. `test` only reports full conformance after the host
adapter executes Query, Navigation, Action, denial, reconciliation, and lifecycle
proofs. A manifest's coverage declaration is not accepted as test evidence.

The browser suite runs deliberately difficult synthetic layouts at desktop,
tablet-touch, and mobile-touch sizes. A conforming host should additionally
test Query to Navigation, Action to Requery, permission denial, stale plans,
duplicate confirmation, and sanitized telemetry.

## Boundaries

- The standard does not define authentication, natural-language interpretation,
  a database schema, or a required network transport.
- Host authorization and domain validation remain authoritative.
- Static Query resources may execute locally; protected data uses host adapters.
- The navigator works within one document. Cross-origin frames remain isolated
  by browser security.
- Closed shadow roots require their component to expose a target or adapter.

## Interoperability bindings

```js
import {
  createArazzoBinding,
  createAsyncApiBinding,
  createMcpBinding,
  registerWebMcpTools,
} from "@bt1142msstate/site-agent-standard/bindings";
```

Bindings project the same permission-filtered semantic contract into established
protocols. They never expose selectors or storage paths and cannot bypass the
Action prepare/confirmation lifecycle.

`createArazzoBinding` requires valid OpenAPI, AsyncAPI, or Arazzo source
descriptions and an explicit capability-to-operation mapping. It intentionally
refuses to invent operations that are absent from the source API description.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[the 0.1 security requirements](spec/0.1/security.md). New behavior requires a
minimal synthetic reproduction and profile-appropriate conformance proof.

## License

[MIT](LICENSE)
