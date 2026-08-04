<p align="center">
  <img src="docs/site-navigator-mark.svg" width="104" height="104" alt="Site Agent Standard logo">
</p>

# Site Agent Standard

Site Agent Standard is a transport-neutral contract for sites that want
authorized software agents, deterministic automation, and tutorials to use the
same capabilities as a person. It combines three independently conforming
profiles without collapsing them into one unsafe API:

- **Query** returns bounded, permission-scoped information and opaque records.
- **Navigation** applies complete UI state and verifies the smallest exact
  visible target.
- **Action** previews, confirms, executes, audits, and verifies changes through
  the site's authoritative domain handlers.

The repository includes the normative 0.1 draft, a dependency-free reference
runtime, a CLI conformance checker, and the battle-tested Site Navigator engine
as the Navigation profile implementation.

## Install

```bash
npm install github:bt1142msstate/site-agent-standard#v0.4.0
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
site-agent test ./site-agent.json
npm run check
```

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

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[the 0.1 security requirements](spec/0.1/security.md). New behavior requires a
minimal synthetic reproduction and profile-appropriate conformance proof.

## License

[MIT](LICENSE)
