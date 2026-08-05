const { test, expect } = require("@playwright/test");

test("renders the standard instructional pointer, exact target, and anchored ripple", async ({ page }) => {
  await page.goto("/examples/basic/");
  await page.setContent(`
    <link rel="stylesheet" href="/src/presentation.css">
    <main style="min-height:1400px;padding-top:900px"><button data-target style="width:180px;height:64px">Run action</button></main>
  `);
  await page.evaluate(async () => {
    const { createBrowserPresentationAdapter, createPresentationController } = await import("/src/presentation.js");
    window.presentationClicks = 0;
    const target = document.querySelector("[data-target]");
    target.addEventListener("click", () => { window.presentationClicks += 1; });
    const controller = createPresentationController({
      adapter: createBrowserPresentationAdapter({ sounds: false }),
      preset: { targetPauseMs: 0 },
    });
    await controller.click(target, { reducedMotion: true });
  });
  const pointer = page.locator("[data-site-agent-presentation-pointer]");
  const target = page.locator("[data-target]");
  await expect(pointer).toHaveClass(/is-visible/);
  await expect(target).toHaveAttribute("data-site-agent-presentation-target", "");
  await expect(page.locator("[data-site-agent-presentation-ripple]")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.presentationClicks)).toBe(1);
  const alignment = await page.evaluate(() => {
    const pointer = document.querySelector("[data-site-agent-presentation-pointer]").getBoundingClientRect();
    const ripple = document.querySelector("[data-site-agent-presentation-ripple]").getBoundingClientRect();
    return {
      x: Math.abs((pointer.left + 5) - (ripple.left + ripple.width / 2)),
      y: Math.abs((pointer.top + 4) - (ripple.top + ripple.height / 2)),
    };
  });
  expect(alignment.x).toBeLessThanOrEqual(1);
  expect(alignment.y).toBeLessThanOrEqual(1);
});

test("the default presentation preset frames nested content and visibly types with shared sound cues", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/examples/basic/");
  await page.setContent(`
    <link rel="stylesheet" href="/src/presentation.css">
    <style>
      html, body { margin: 0; min-height: 1500px; }
      header { position: fixed; inset: 0 0 auto; height: 88px; z-index: 10; background: white; }
      main { padding-top: 700px; }
      .nested { width: 330px; height: 260px; overflow: auto; }
      .canvas { box-sizing: border-box; width: 980px; height: 820px; padding: 650px 0 0 720px; }
      input { width: 190px; height: 48px; }
    </style>
    <header>Sticky header</header>
    <main><div class="nested"><div class="canvas"><input aria-label="Tutorial field"></div></div></main>
  `);
  await page.evaluate(async () => {
    const { createBrowserPresentationAdapter, createPresentationController } = await import("/src/presentation.js");
    const input = document.querySelector("input");
    window.presentationEvents = [];
    input.addEventListener("input", (event) => window.presentationEvents.push(["input", event.data]));
    input.addEventListener("change", () => window.presentationEvents.push(["change"]));
    const controller = createPresentationController({
      adapter: createBrowserPresentationAdapter({
        onSound: ({ kind, profile }) => window.presentationEvents.push(["sound", kind, profile]),
      }),
      muted: false,
      preset: { targetPauseMs: 0 },
    });
    await controller.move(input, { reducedMotion: true });
    await controller.type(input, "Hi", { keyDelayMs: 0, reducedMotion: true });
  });

  const input = page.locator("input");
  await expect(input).toHaveValue("Hi");
  await expect(input).toHaveAttribute("data-site-agent-presentation-target", "");
  const evidence = await page.evaluate(() => {
    const input = document.querySelector("input");
    const rect = input.getBoundingClientRect();
    const pointerPath = document.querySelector("[data-site-agent-presentation-pointer] path");
    return {
      events: window.presentationEvents,
      inputVisible: rect.top >= 88 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
      nestedLeft: document.querySelector(".nested").scrollLeft,
      nestedTop: document.querySelector(".nested").scrollTop,
      pointerFill: pointerPath?.getAttribute("fill"),
      pointerStroke: pointerPath?.getAttribute("stroke"),
    };
  });
  expect(evidence.inputVisible).toBe(true);
  expect(evidence.nestedLeft).toBeGreaterThan(0);
  expect(evidence.nestedTop).toBeGreaterThan(0);
  expect(evidence.pointerFill).toBe("#fff");
  expect(evidence.pointerStroke).toBe("#10243b");
  expect(evidence.events.filter(([kind]) => kind === "input")).toHaveLength(2);
  expect(evidence.events.at(-1)).toEqual(["change"]);
  expect(evidence.events.some(([event, kind]) => event === "sound" && kind === "typing")).toBe(true);
});

async function activateImmediately(page, locator, touch) {
  const point = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) };
  });
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

test("navigates a clipped, transformed drawer with nested two-axis scrolling", async ({ page }) => {
  await page.goto("/examples/basic/");
  await page.setContent(`
    <style>
      html, body { margin: 0; min-height: 1800px; }
      .page-header { position: fixed; inset: 0 0 auto; height: 74px; z-index: 20; background: white; }
      .drawer { position: fixed; inset: 88px 8px 8px; overflow: hidden; transform: translateZ(0); contain: paint; }
      .drawer-scroll { height: 100%; overflow: auto; overscroll-behavior: contain; }
      .sticky-tools { position: sticky; top: 0; z-index: 8; height: 92px; background: white; }
      .before { height: 740px; }
      details { width: 1080px; }
      .inner-scroll { width: 760px; max-width: calc(100vw - 42px); height: 330px; overflow: auto; }
      .inner-canvas { box-sizing: border-box; width: 1260px; height: 900px; padding: 650px 0 0 930px; }
      .wanted { width: 210px; height: 72px; }
      .is-navigation-focus { outline: 4px solid #1684b3; }
    </style>
    <header class="page-header">Header</header>
    <aside class="drawer"><div class="drawer-scroll">
      <nav class="sticky-tools">Sticky controls</nav><div class="before"></div>
      <details><summary>Advanced</summary><div class="inner-scroll"><div class="inner-canvas"><button class="wanted">Exact target</button></div></div></details>
    </div></aside>
  `);
  await page.evaluate(async () => {
    const { focusVerifiedNavigationTarget } = await import("/src/site-navigator.js");
    focusVerifiedNavigationTarget({ target: document.querySelector(".wanted"), headerSelector: ".page-header" });
  });

  const target = page.locator(".wanted");
  await expect(target).toHaveAttribute("data-verified-navigation-state", "visible");
  await expect(target).toBeFocused();
  const evidence = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      detailsOpen: element.closest("details").open,
      hit: hit === element || element.contains(hit),
      x: element.closest(".inner-scroll").scrollLeft,
      y: element.closest(".inner-scroll").scrollTop,
    };
  });
  expect(evidence).toMatchObject({ detailsOpen: true, hit: true });
  expect(evidence.x).toBeGreaterThan(0);
  expect(evidence.y).toBeGreaterThan(0);
});

test("uses a declared concise text target when the preferred record cannot fit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/examples/basic/");
  await page.setContent(`
    <style>
      body { margin: 0; }
      .page-header { position: fixed; inset: 0 0 auto; height: 88px; z-index: 10; background: white; }
      .surface { position: fixed; inset: 100px 12px 12px; overflow: auto; }
      .before { height: 760px; }
      .record { box-sizing: border-box; min-height: 1100px; padding: 24px; background: white; }
      .record-title { display: block; width: fit-content; font-size: 22px; }
      .is-navigation-focus { outline: 4px solid #1684b3; outline-offset: 4px; }
    </style>
    <header class="page-header">Header</header>
    <main class="surface"><div class="before"></div><article class="record">
      <h2 class="record-title">The exact answer</h2>
      <div style="height:1000px">Long record details</div>
    </article></main>
  `);
  await page.evaluate(async () => {
    const { createSiteNavigator } = await import("/src/site-navigator.js");
    const record = document.querySelector(".record");
    const title = document.querySelector(".record-title");
    createSiteNavigator({
      adapter: {
        getIntent: () => ({ id: "test.concise-target" }),
        activate: () => {},
        applyState: () => {},
        isReady: () => true,
        verifyState: () => true,
        resolveTarget: () => ({
          exact: true,
          target: record,
          candidates: [
            { exact: true, kind: "record", precision: "record", target: record },
            { exact: true, kind: "record-title", precision: "text", target: title },
          ],
        }),
      },
      documentRef: document,
      focusOptions: { headerSelector: ".page-header" },
      report: (state, descriptor) => {
        document.documentElement.dataset.navigationState = state;
        if (descriptor?.kind) document.documentElement.dataset.navigationKind = descriptor.kind;
      },
      windowRef: window,
    }).start();
  });

  await expect(page.locator("html")).toHaveAttribute("data-navigation-state", "focused");
  await expect(page.locator("html")).toHaveAttribute("data-navigation-kind", "record-title");
  await expect(page.locator(".record-title")).toHaveAttribute("data-verified-navigation-state", "visible");
  await expect(page.locator(".record-title")).toBeFocused();
  await expect(page.locator(".record")).not.toHaveClass(/is-navigation-focus/);
  const visible = await page.locator(".record-title").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 96 && rect.bottom <= innerHeight - 8;
  });
  expect(visible).toBe(true);
});

test("chooses and reveals the smallest precise off-screen reference when the record also fits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/examples/basic/");
  await page.setContent(`
    <style>
      body { margin: 0; }
      .page-header { position: fixed; inset: 0 0 auto; height: 88px; z-index: 10; background: white; }
      .surface { position: fixed; inset: 100px 12px 12px; overflow: auto; }
      .before { height: 980px; }
      .record { box-sizing: border-box; height: 520px; padding: 24px; background: white; }
      .reference-wide { display: block; width: 300px; height: 52px; }
      .reference-value { display: block; width: 130px; height: 36px; margin-top: 300px; }
      .is-navigation-focus { outline: 4px solid #1684b3; outline-offset: 4px; }
    </style>
    <header class="page-header">Header</header>
    <main class="surface"><div class="before"></div><article class="record">
      <h2 class="reference-wide">Staff pay details</h2>
      <output class="reference-value">$18.00 per hour</output>
    </article></main>
  `);
  await page.evaluate(async () => {
    const { createSiteNavigator } = await import("/src/site-navigator.js");
    const record = document.querySelector(".record");
    const wide = document.querySelector(".reference-wide");
    const value = document.querySelector(".reference-value");
    createSiteNavigator({
      adapter: {
        getIntent: () => ({ id: "test.smallest-reference" }),
        activate: () => {},
        applyState: () => {},
        isReady: () => true,
        verifyState: () => true,
        resolveTarget: () => ({
          exact: true,
          target: record,
          candidates: [
            { exact: true, kind: "staff-record", precision: "record", target: record },
            { exact: true, kind: "staff-heading", precision: "text", target: wide },
            { exact: true, kind: "staff-pay-value", precision: "value", target: value },
          ],
        }),
      },
      documentRef: document,
      focusOptions: { headerSelector: ".page-header" },
      report: (state, descriptor) => {
        document.documentElement.dataset.navigationState = state;
        if (descriptor?.kind) document.documentElement.dataset.navigationKind = descriptor.kind;
      },
      windowRef: window,
    }).start();
  });

  const value = page.locator(".reference-value");
  await expect(page.locator("html")).toHaveAttribute("data-navigation-state", "focused");
  await expect(page.locator("html")).toHaveAttribute("data-navigation-kind", "staff-pay-value");
  await expect(value).toHaveClass(/is-navigation-focus/);
  await expect(value).toHaveAttribute("data-verified-navigation-state", "visible");
  await expect(page.locator(".record")).not.toHaveClass(/is-navigation-focus/);
  await expect(page.locator(".reference-wide")).not.toHaveClass(/is-navigation-focus/);
  const evidence = await value.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      surfaceScrollTop: document.querySelector(".surface").scrollTop,
      top: rect.top,
    };
  });
  expect(evidence.surfaceScrollTop).toBeGreaterThan(0);
  expect(evidence.top).toBeGreaterThanOrEqual(96);
  expect(evidence.bottom).toBeLessThanOrEqual(836);
});

test("waits for delayed content and retries a replaced shadow target", async ({ page }) => {
  await page.goto("/examples/basic/");
  await page.setContent(`
    <style>
      body { margin: 0; }
      .page-header { position: fixed; inset: 0 0 auto; height: 80px; z-index: 5; background: white; }
      .outer { position: fixed; inset: 96px 10px 10px; overflow: auto; }
      #host { display: block; width: 1100px; margin-top: 800px; }
      .is-navigation-focus { outline: 4px solid #1684b3; }
    </style>
    <header class="page-header">Header</header><main class="outer"><section id="host"></section></main>
  `);
  await page.evaluate(async () => {
    const host = document.querySelector("#host");
    const root = host.attachShadow({ mode: "open" });
    const { createSiteNavigator } = await import("/src/site-navigator.js");
    let activationCount = 0;
    let selectedRange = "today";
    createSiteNavigator({
      adapter: {
        getIntent: () => ({ state: { range: "year-to-date" }, target: { field: "total" } }),
        activate: () => {
          activationCount += 1;
          if (!root.querySelector(".wanted")) {
            root.innerHTML = `<style>.inner{width:900px;height:320px;overflow:auto}.space{width:1200px;height:700px}.wanted{width:180px;height:64px}</style><details><summary>Settings</summary><div class="inner"><div class="space"></div><button class="wanted">Original</button></div></details>`;
            root.querySelector("details").open = true;
            setTimeout(() => {
              const oldTarget = root.querySelector(".wanted");
              const replacement = oldTarget.cloneNode(true);
              replacement.textContent = "Replacement";
              replacement.dataset.replacement = "true";
              oldTarget.replaceWith(replacement);
            }, 80);
          }
        },
        applyState: ({ intent }) => { selectedRange = intent.state.range; },
        isReady: () => Boolean(root.querySelector(".wanted")),
        verifyState: ({ intent }) => selectedRange === intent.state.range,
        resolveTarget: () => {
          const target = root.querySelector(".wanted");
          return target ? { target, exact: true, kind: "setting" } : null;
        },
      },
      focusOptions: { headerSelector: ".page-header" },
      report: (state) => document.documentElement.dataset.navigationState = state,
    }).start();
  });

  await expect(page.locator("html")).toHaveAttribute("data-navigation-state", "focused");
  const evidence = await page.evaluate(() => {
    const target = document.querySelector("#host").shadowRoot.querySelector(".wanted");
    return {
      active: target.getRootNode().activeElement === target,
      replacement: target.dataset.replacement,
      state: target.getAttribute("data-verified-navigation-state"),
    };
  });
  expect(evidence).toEqual({ active: true, replacement: "true", state: "visible" });
  await expect(page.locator("html")).toHaveAttribute("data-navigation-state", "focused");
});

test("treats a full-screen top-layer dialog as its own visible viewport", async ({ page }) => {
  await page.goto("/examples/basic/");
  await page.setContent(`
    <style>
      body { margin: 0; min-height: 1800px; }
      .page-header { position: fixed; inset: 0 0 auto; height: 90px; z-index: 10; background: white; }
      dialog { width: min(760px, calc(100vw - 24px)); height: min(680px, calc(100dvh - 24px)); padding: 0; }
      .modal-scroll { height: 100%; overflow: auto; }
      .space { height: 900px; }
      .wanted { display: block; min-height: 70px; }
      @media (max-width: 620px) { dialog { inset: 0; width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; } }
    </style>
    <header class="page-header">Header</header>
    <dialog><div class="modal-scroll"><div class="space"></div><button class="wanted">Dialog target</button><div class="space"></div></div></dialog>
  `);
  await page.evaluate(async () => {
    const dialog = document.querySelector("dialog");
    dialog.showModal();
    const { focusVerifiedNavigationTarget } = await import("/src/site-navigator.js");
    focusVerifiedNavigationTarget({ target: document.querySelector(".wanted"), headerSelector: ".page-header" });
  });

  const target = page.locator(".wanted");
  await expect(target).toHaveAttribute("data-verified-navigation-state", "visible");
  await expect(target).toBeFocused();
  const hit = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === element;
  });
  expect(hit).toBe(true);
});

test("navigates through a shadow root inside a programmatically clipped dialog", async ({ page }) => {
  await page.goto("/examples/basic/");
  await page.setContent(`
    <style>
      body { margin: 0; min-height: 1600px; }
      .page-header { position: fixed; inset: 0 0 auto; height: 88px; z-index: 20; background: white; }
      dialog { width: min(720px, calc(100vw - 24px)); height: min(640px, calc(100dvh - 24px)); padding: 0; }
      .modal-clip { height: 100%; overflow: hidden; }
      #host { display: block; }
      @media (max-width: 620px) { dialog { inset: 0; width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; } }
    </style>
    <header class="page-header">Header</header>
    <dialog><div class="modal-clip"><section id="host"></section></div></dialog>
  `);
  await page.evaluate(async () => {
    const dialog = document.querySelector("dialog");
    const host = document.querySelector("#host");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .space { height: 980px; }
        .wanted { display: block; width: 220px; min-height: 72px; }
        .is-navigation-focus { outline: 4px solid #1684b3; }
      </style>
      <div class="space"></div><button class="wanted">Shadow dialog target</button><div class="space"></div>
    `;
    dialog.showModal();
    const { focusVerifiedNavigationTarget } = await import("/src/site-navigator.js");
    focusVerifiedNavigationTarget({ target: root.querySelector(".wanted"), headerSelector: ".page-header" });
  });

  await expect.poll(() => page.evaluate(() => {
    const target = document.querySelector("#host").shadowRoot.querySelector(".wanted");
    return target.getAttribute("data-verified-navigation-state");
  })).toBe("visible");
  const evidence = await page.evaluate(() => {
    const clip = document.querySelector(".modal-clip");
    const target = document.querySelector("#host").shadowRoot.querySelector(".wanted");
    const rect = target.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      active: target.getRootNode().activeElement === target,
      hit: hit === document.querySelector("#host"),
      scrollTop: clip.scrollTop,
    };
  });
  expect(evidence.active).toBe(true);
  expect(evidence.hit).toBe(true);
  expect(evidence.scrollTop).toBeGreaterThan(0);
});

test("applies delayed multi-filter state atomically while the navigation progress locks interaction", async ({ page }, testInfo) => {
  await page.goto("/examples/basic/");
  await page.setContent(`
    <link rel="stylesheet" href="/src/navigation-progress.css">
    <style>
      body { margin: 0; min-height: 1900px; }
      .page-header { position: fixed; inset: 0 0 auto; z-index: 10; height: 76px; background: white; }
      [data-probe] { position: fixed; top: 80px; left: 12px; z-index: 9; }
      .surface { position: fixed; inset: 92px 10px 10px; overflow: auto; }
      .spacer { height: 900px; }
      .wanted { display: block; min-height: 74px; margin-bottom: 700px; }
      .is-navigation-focus { outline: 4px solid #1684b3; outline-offset: 4px; }
    </style>
    <header class="page-header">Application header</header>
    <button type="button" data-probe>Blocked while navigating</button>
    <main class="surface">
      <select data-range><option value="week">Week</option><option value="custom">Custom</option></select>
      <input data-start value="">
      <input data-end value="">
      <select data-staff><option value="">All staff</option></select>
      <div class="spacer"></div>
      <div data-target-mount></div>
    </main>
  `);
  await page.evaluate(async () => {
    const { createNavigationProgress, createSiteNavigator } = await import("/src/site-navigator.js");
    const range = document.querySelector("[data-range]");
    const start = document.querySelector("[data-start]");
    const end = document.querySelector("[data-end]");
    const staff = document.querySelector("[data-staff]");
    const requestedState = {
      end: "08/04/2026",
      range: "custom",
      staff: "staff-42",
      start: "01/01/2026",
    };
    window.probeClicks = 0;
    document.querySelector("[data-probe]").addEventListener("click", () => { window.probeClicks += 1; });
    const renderTarget = () => {
      if (range.value !== requestedState.range || start.value !== requestedState.start
        || end.value !== requestedState.end || staff.value !== requestedState.staff) return;
      const target = document.createElement("button");
      target.className = "wanted";
      target.textContent = "Exact combined result";
      document.querySelector("[data-target-mount]").replaceChildren(target);
    };
    [range, start, end, staff].forEach((control) => control.addEventListener("change", renderTarget));
    setTimeout(() => staff.append(new Option("Requested staff", "staff-42")), 650);
    const progress = createNavigationProgress({ documentRef: document, windowRef: window });
    let controller;
    controller = createSiteNavigator({
      adapter: {
        getIntent: () => ({ state: requestedState, target: { id: "combined-result" } }),
        activate: () => {},
        applyState: ({ intent }) => {
          if (range.value !== intent.state.range) {
            range.value = intent.state.range;
            range.dispatchEvent(new Event("change", { bubbles: true }));
            return;
          }
          if (start.value !== intent.state.start || end.value !== intent.state.end) {
            start.value = intent.state.start;
            end.value = intent.state.end;
            end.dispatchEvent(new Event("change", { bubbles: true }));
            return;
          }
          if (Array.from(staff.options).some(({ value }) => value === intent.state.staff)
            && staff.value !== intent.state.staff) {
            staff.value = intent.state.staff;
            staff.dispatchEvent(new Event("change", { bubbles: true }));
          }
        },
        isReady: () => Boolean(document.querySelector(".wanted")),
        verifyState: ({ intent }) => ({
          reason: "combined-filter-mismatch",
          verified: range.value === intent.state.range && start.value === intent.state.start
            && end.value === intent.state.end && staff.value === intent.state.staff,
        }),
        resolveTarget: () => {
          const target = document.querySelector(".wanted");
          return target ? { exact: true, kind: "combined-result", target } : null;
        },
      },
      documentRef: document,
      focusOptions: { headerSelector: ".page-header" },
      report: (state, descriptor) => {
        document.documentElement.dataset.navigationState = state;
        progress.update(state, descriptor);
      },
      windowRef: window,
    });
    progress.setCancelHandler((reason) => controller.stop(reason));
    controller.start();
  });

  await expect(page.locator("html")).toHaveAttribute("data-site-navigation-locked", "true");
  await expect(page.locator("[data-site-navigation-progress]")).toHaveAttribute("data-navigation-active", "true");
  await activateImmediately(page, page.locator("[data-probe]"), testInfo.project.name.includes("touch"));
  await expect.poll(() => page.evaluate(() => window.probeClicks)).toBe(0);
  await expect(page.locator("html")).toHaveAttribute("data-navigation-state", "focused");
  await expect(page.locator("[data-range]")).toHaveValue("custom");
  await expect(page.locator("[data-start]")).toHaveValue("01/01/2026");
  await expect(page.locator("[data-end]")).toHaveValue("08/04/2026");
  await expect(page.locator("[data-staff]")).toHaveValue("staff-42");
  await expect(page.locator("html")).not.toHaveAttribute("data-site-navigation-locked", "true");
  await expect(page.locator(".wanted")).toHaveAttribute("data-verified-navigation-state", "visible");
  await expect(page.locator(".wanted")).toBeFocused();
  await page.locator("[data-probe]").click();
  await expect.poll(() => page.evaluate(() => window.probeClicks)).toBe(1);
});

test("hard deadline releases the navigation progress when an adapter never becomes ready", async ({ page }, testInfo) => {
  await page.goto("/examples/basic/");
  await page.setContent(`
    <link rel="stylesheet" href="/src/navigation-progress.css">
    <button type="button" data-probe>Available after timeout</button>
  `);
  await page.evaluate(async () => {
    const { createNavigationProgress, createSiteNavigator } = await import("/src/site-navigator.js");
    window.probeClicks = 0;
    document.querySelector("[data-probe]").addEventListener("click", () => { window.probeClicks += 1; });
    const progress = createNavigationProgress({ documentRef: document, maxDurationMs: 1200, windowRef: window });
    let controller;
    controller = createSiteNavigator({
      adapter: {
        getIntent: () => ({ state: { pending: true } }),
        activate: () => {},
        applyState: () => {},
        isReady: () => false,
        verifyState: () => false,
        resolveTarget: () => null,
      },
      documentRef: document,
      report: (state, descriptor) => {
        document.documentElement.dataset.navigationState = state;
        progress.update(state, descriptor);
      },
      timeoutMs: 1000,
      windowRef: window,
    });
    progress.setCancelHandler((reason) => controller.stop(reason));
    controller.start();
  });

  await expect(page.locator("html")).toHaveAttribute("data-site-navigation-locked", "true");
  await activateImmediately(page, page.locator("[data-probe]"), testInfo.project.name.includes("touch"));
  await expect.poll(() => page.evaluate(() => window.probeClicks)).toBe(0);
  await expect(page.locator("html")).toHaveAttribute("data-navigation-state", "timed-out");
  await expect(page.locator("html")).not.toHaveAttribute("data-site-navigation-locked", "true");
  await page.locator("[data-probe]").click();
  await expect.poll(() => page.evaluate(() => window.probeClicks)).toBe(1);
});
