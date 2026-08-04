const { test, expect } = require("@playwright/test");

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
    const { createVerifiedNavigationController } = await import("/src/site-navigator.js");
    let activationCount = 0;
    createVerifiedNavigationController({
      hasIntent: () => true,
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
      resolve: () => {
        const target = root.querySelector(".wanted");
        return target ? { target, exact: true, kind: "setting" } : null;
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
