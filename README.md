<p align="center">
  <img src="docs/site-navigator-mark.svg" width="104" height="104" alt="Site Navigator logo">
</p>

# Site Navigator

Site Navigator reliably reveals and focuses an exact element in complex,
responsive web interfaces. It handles the cases where `scrollIntoView()` alone
is not enough: nested two-axis scrollers, sticky headers, clipped drawers,
collapsed details, top-layer dialogs, shadow roots, delayed rendering, and DOM
replacement during live updates.

The runtime has no dependencies. Application-specific routes and selectors stay
in small adapters outside the engine.

## Why it is different

- **Verified, not hopeful.** Success is reported only after geometry stabilizes,
  every clipping boundary contains the target, and browser hit testing confirms
  that an overlay is not covering it.
- **Dynamic UI aware.** A controller can activate tabs or dialogs, wait for
  asynchronous data, and retry when a framework replaces the target.
- **Responsive by design.** The same behavior is tested at desktop, tablet, and
  touch-mobile sizes.
- **Accessible.** The resolved control receives keyboard focus, collapsed
  `details` ancestors open, and reduced-motion preferences are respected.
- **Framework independent.** It works with browser DOM APIs and supports shadow
  host ancestry without requiring React, Vue, or another runtime.

## Install

```bash
npm install github:bt1142msstate/site-navigator#v0.1.0
```

The package is currently distributed from this repository. An npm release can
be added after the public API has received external feedback.

## Focus a target

```js
import { focusVerifiedNavigationTarget } from "@bt1142msstate/site-navigator";

focusVerifiedNavigationTarget({
  target: document.querySelector("[data-order-id='order-42']"),
  headerSelector: ".app-header",
  onSettled({ visible, reason }) {
    console.log({ visible, reason });
  },
});
```

Add your own highlight style:

```css
.is-navigation-focus {
  outline: 4px solid #1684b3;
  outline-offset: 4px;
}
```

## Navigate through dynamic UI

Use the controller when a route must open a tab, drawer, accordion, or modal
before its exact target exists:

```js
import { createVerifiedNavigationController } from "@bt1142msstate/site-navigator";

const controller = createVerifiedNavigationController({
  hasIntent: () => new URLSearchParams(location.search).has("showOrder"),
  activate: () => {
    document.querySelector("[data-tab='orders']")?.click();
  },
  resolve: () => {
    const id = new URLSearchParams(location.search).get("showOrder");
    const target = document.querySelector(`[data-order-id='${CSS.escape(id)}']`);
    return target ? { target, exact: true, kind: "order" } : null;
  },
  focusOptions: { headerSelector: ".app-header" },
  report: (state, destination) => {
    console.log(state, destination?.kind);
  },
});

controller.start();
```

Do not place untrusted values directly into selectors as shown in a simplified
example. Validate route values and use `CSS.escape()` or opaque application
references.

## Adapter contract

The engine deliberately does not know routes, business entities, permissions,
or data stores. A host adapter owns four decisions:

1. `hasIntent`: whether navigation was requested.
2. `activate`: which UI state must be opened.
3. `resolve`: the smallest stable target currently rendered.
4. `report`: how waiting, scrolling, retrying, focused, or failed states appear.

This boundary makes one engine reusable across applications while keeping
authorization and data semantics in the host.

## Battle-testing

The browser suite uses deliberately difficult synthetic layouts and runs every
case in desktop, tablet-touch, and mobile-touch projects. Covered patterns
include:

- nested horizontal and vertical scroll containers;
- fixed and sticky outer headers plus sticky internal toolbars;
- `overflow: hidden`, `overflow: clip`, transforms, and paint containment;
- collapsed `details` ancestors;
- full-screen and desktop top-layer dialogs;
- delayed targets and listener/framework replacement;
- open shadow roots and composed ancestry;
- center-point hit verification against overlays;
- keyboard focus and reduced motion.

The fixture set reproduces layout patterns observed read-only on large public
production sites. External pages are not part of CI because their markup and
availability are not deterministic.

```bash
npm install
npm run check
```

## Scope and limitations

- The engine navigates within one document. For same-origin iframes, instantiate
  it with the iframe's `document` and `window`. Browser security prevents a host
  page from inspecting cross-origin iframe content.
- Closed shadow roots cannot be inspected from outside their component. The
  component must expose a target or run its own adapter.
- Site Navigator does not authorize users or perform mutations.
- Hit verification can be disabled with `verifyHitTarget: false` for a known
  non-pointer target, but keeping it enabled is safer for user-facing navigation.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). New layout behavior requires a minimal
synthetic reproduction and responsive browser proof. Security concerns should
follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
