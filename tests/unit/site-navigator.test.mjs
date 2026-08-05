import test from "node:test";
import assert from "node:assert/strict";

import {
  createSiteNavigator,
  focusVerifiedNavigationTarget,
  isVerifiedNavigationTargetVisible,
  selectBestNavigationTarget,
} from "../../src/site-navigator.js";

function createClassList() {
  const values = new Set();
  return {
    add: (value) => values.add(value),
    contains: (value) => values.has(value),
    remove: (value) => values.delete(value),
  };
}

test("ordered exact targets fall back from an oversized record to declared text", () => {
  const ownerDocument = { body: {}, querySelector: () => null };
  const record = {
    isConnected: true,
    ownerDocument,
    parentElement: null,
    getBoundingClientRect: () => ({ top: 0, bottom: 1200, left: 0, right: 360, height: 1200, width: 360 }),
  };
  const text = {
    isConnected: true,
    ownerDocument,
    parentElement: record,
    getBoundingClientRect: () => ({ top: 80, bottom: 120, left: 20, right: 280, height: 40, width: 260 }),
  };
  const selected = selectBestNavigationTarget({
    exact: true,
    target: record,
    candidates: [
      { exact: true, kind: "order-record", precision: "record", target: record },
      { exact: true, kind: "order-title", precision: "text", target: text },
    ],
  }, {
    windowRef: {
      innerHeight: 700,
      innerWidth: 390,
      getComputedStyle: () => ({ overflowX: "visible", overflowY: "visible", position: "static" }),
    },
  });

  assert.equal(selected.target, text);
  assert.equal(selected.kind, "order-title");
  assert.equal(selected.candidateIndex, 1);
  assert.equal(selected.selectionReason, "most-precise-fitting-candidate");
});

test("target selection chooses the most precise concise target even when a broad record also fits", () => {
  const ownerDocument = { body: {}, querySelector: () => null };
  const record = {
    isConnected: true,
    ownerDocument,
    parentElement: null,
    getBoundingClientRect: () => ({ top: 100, bottom: 620, left: 12, right: 378, height: 520, width: 366 }),
  };
  const value = {
    isConnected: true,
    ownerDocument,
    parentElement: record,
    getBoundingClientRect: () => ({ top: 540, bottom: 580, left: 40, right: 180, height: 40, width: 140 }),
  };
  const selected = selectBestNavigationTarget({
    exact: true,
    target: record,
    candidates: [
      { exact: true, kind: "staff-record", precision: "record", target: record },
      { exact: true, kind: "hourly-rate", precision: "value", target: value },
    ],
  }, {
    windowRef: {
      innerHeight: 700,
      innerWidth: 390,
      getComputedStyle: () => ({ overflowX: "visible", overflowY: "visible", position: "static" }),
    },
  });

  assert.equal(selected.target, value);
  assert.equal(selected.kind, "hourly-rate");
  assert.equal(selected.selectionReason, "most-precise-fitting-candidate");
});

test("off-screen reference text is ranked by fit after scrolling", () => {
  const ownerDocument = { body: {}, querySelector: () => null };
  const scrollSurface = {
    clientHeight: 600,
    clientWidth: 366,
    getBoundingClientRect: () => ({ top: 100, bottom: 700, left: 12, right: 378, height: 600, width: 366 }),
    parentElement: null,
    scrollHeight: 2400,
    scrollWidth: 366,
  };
  const record = {
    isConnected: true,
    ownerDocument,
    parentElement: scrollSurface,
    getBoundingClientRect: () => ({ top: 1400, bottom: 2500, left: 12, right: 378, height: 1100, width: 366 }),
  };
  const text = {
    isConnected: true,
    ownerDocument,
    parentElement: record,
    getBoundingClientRect: () => ({ top: 1440, bottom: 1484, left: 32, right: 280, height: 44, width: 248 }),
  };
  const selected = selectBestNavigationTarget({
    exact: true,
    target: record,
    candidates: [
      { exact: true, kind: "request", precision: "record", target: record },
      { exact: true, kind: "request-reference", precision: "text", target: text },
    ],
  }, {
    windowRef: {
      innerHeight: 844,
      innerWidth: 390,
      getComputedStyle: (element) => element === scrollSurface
        ? { overflowX: "hidden", overflowY: "auto", position: "fixed" }
        : { overflowX: "visible", overflowY: "visible", position: "static" },
    },
  });

  assert.equal(selected.target, text);
  assert.equal(selected.kind, "request-reference");
  assert.equal(selected.selectionReason, "most-precise-fitting-candidate");
});

test("target selection never invents an undeclared descendant", () => {
  const ownerDocument = { body: {}, querySelector: () => null };
  const record = {
    isConnected: true,
    ownerDocument,
    parentElement: null,
    getBoundingClientRect: () => ({ top: 0, bottom: 1200, left: 0, right: 360, height: 1200, width: 360 }),
    querySelector: () => ({ id: "undeclared-title" }),
  };
  const selected = selectBestNavigationTarget({ exact: true, kind: "record", target: record }, {
    windowRef: {
      innerHeight: 700,
      innerWidth: 390,
      getComputedStyle: () => ({ overflowX: "visible", overflowY: "visible", position: "static" }),
    },
  });

  assert.equal(selected.target, record);
  assert.equal(selected.selectionReason, "most-precise-least-overflow-candidate");
});

test("site navigators center nested mobile scroll surfaces and retain focus", () => {
  const calls = [];
  const scheduled = [];
  let targetTop = 900;
  const ancestor = {
    clientHeight: 600,
    parentElement: null,
    scrollHeight: 1400,
    scrollTop: 120,
    getBoundingClientRect: () => ({ top: 80, bottom: 680, left: 0, right: 390, height: 600 }),
    scrollTo: (options) => {
      calls.push(["container-scroll", options]);
      targetTop = 320;
    },
  };
  const target = {
    classList: createClassList(),
    ownerDocument: { body: {} },
    parentElement: ancestor,
    getBoundingClientRect: () => ({ top: targetTop, bottom: targetTop + 80, left: 20, right: 300, height: 80, width: 280 }),
    scrollIntoView: (options) => calls.push(["target-scroll", options]),
    querySelector: () => null,
    closest: () => null,
    hasAttribute: () => false,
    setAttribute: (name, value) => calls.push(["attribute", name, value]),
    removeAttribute: (name) => calls.push(["remove-attribute", name]),
    focus: (options) => calls.push(["focus", options]),
  };
  const windowRef = {
    innerHeight: 720,
    innerWidth: 390,
    scrollY: 40,
    getComputedStyle: () => ({ overflowY: "auto" }),
    matchMedia: () => ({ matches: false }),
    scrollTo: (options) => {
      calls.push(["window-scroll", options]);
      targetTop = 320;
    },
  };

  assert.equal(focusVerifiedNavigationTarget({
    target,
    windowRef,
    requestAnimationFrameRef: (callback) => callback(),
    setTimeoutRef: (callback, delay) => scheduled.push({ callback, delay }),
  }), true);
  assert.equal(target.classList.contains("is-navigation-focus"), true);
  assert.deepEqual(
    calls.filter(([kind]) => kind.endsWith("scroll")).slice(0, 2).map(([kind]) => kind),
    ["target-scroll", "container-scroll"],
  );

  scheduled.find(({ delay }) => delay === 260).callback();
  scheduled.find(({ delay }) => delay === 180).callback();
  assert.equal(calls.some(([kind]) => kind === "focus"), true);
  assert.equal(isVerifiedNavigationTargetVisible({ target, windowRef }), true);
  scheduled.find(({ delay }) => delay === 2800).callback();
  assert.equal(target.classList.contains("is-navigation-focus"), false);
});

test("site navigator opens every collapsed details ancestor before focusing", () => {
  const opened = [];
  const outer = {
    matches: (selector) => selector === "details:not([open])",
    parentElement: null,
    setAttribute: (name) => opened.push(["outer", name]),
  };
  const inner = {
    matches: (selector) => selector === "details:not([open])",
    parentElement: outer,
    setAttribute: (name) => opened.push(["inner", name]),
  };
  const target = {
    classList: createClassList(),
    ownerDocument: { body: {}, querySelector: () => null },
    parentElement: inner,
    getBoundingClientRect: () => ({ top: 120, bottom: 160, left: 20, right: 220, height: 40, width: 200 }),
    scrollIntoView: () => {},
    querySelector: () => null,
    hasAttribute: () => true,
    setAttribute: () => {},
    removeAttribute: () => {},
    focus: () => {},
  };
  const scheduled = [];
  focusVerifiedNavigationTarget({
    target,
    windowRef: {
      innerHeight: 700,
      innerWidth: 390,
      getComputedStyle: () => ({ overflowY: "visible", position: "static" }),
      matchMedia: () => ({ matches: true }),
      scrollTo: () => {},
    },
    requestAnimationFrameRef: (callback) => callback(),
    setTimeoutRef: (callback, delay) => scheduled.push({ callback, delay }),
  });
  assert.deepEqual(opened, [["inner", "open"], ["outer", "open"]]);
});

test("site navigator reports replacement instead of claiming focus", () => {
  const outcomes = [];
  const scheduled = [];
  const target = {
    classList: createClassList(),
    isConnected: true,
    ownerDocument: { body: {}, querySelector: () => null },
    parentElement: null,
    getBoundingClientRect: () => ({ top: 120, bottom: 160, left: 20, right: 220, height: 40, width: 200 }),
    scrollIntoView: () => {},
    querySelector: () => null,
    hasAttribute: () => true,
    setAttribute: () => {},
    removeAttribute: () => {},
    focus: () => {},
  };
  focusVerifiedNavigationTarget({
    target,
    windowRef: { innerHeight: 700, innerWidth: 390, matchMedia: () => ({ matches: true }) },
    requestAnimationFrameRef: (callback) => callback(),
    setTimeoutRef: (callback, delay) => scheduled.push({ callback, delay }),
    onSettled: (outcome) => outcomes.push(outcome),
  });
  target.isConnected = false;
  scheduled.find(({ delay }) => delay === 260).callback();
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].visible, false);
  assert.equal(outcomes[0].reason, "target-replaced");
});

test("site navigator visibility excludes a sticky header on desktop", () => {
  const header = { getBoundingClientRect: () => ({ top: 0, bottom: 96 }) };
  const target = {
    ownerDocument: { querySelector: () => header },
    getBoundingClientRect: () => ({ top: 68, bottom: 128, left: 40, right: 400, height: 60, width: 360 }),
  };
  const windowRef = {
    innerHeight: 800,
    innerWidth: 1280,
    getComputedStyle: (element) => ({ position: element === header ? "sticky" : "static" }),
  };
  assert.equal(isVerifiedNavigationTargetVisible({ target, windowRef }), false);
});

test("site navigator visibility excludes content clipped by a modal scroll surface", () => {
  const scrollOwner = {
    clientHeight: 500,
    parentElement: null,
    scrollHeight: 1600,
    getBoundingClientRect: () => ({ top: 120, bottom: 620, left: 20, right: 370 }),
  };
  const target = {
    ownerDocument: { body: {}, querySelector: () => null },
    parentElement: scrollOwner,
    getBoundingClientRect: () => ({ top: 780, bottom: 840, left: 40, right: 340, height: 60, width: 300 }),
  };
  const windowRef = {
    innerHeight: 844,
    innerWidth: 390,
    getComputedStyle: () => ({ overflowY: "auto", position: "static" }),
  };
  assert.equal(isVerifiedNavigationTargetVisible({ target, windowRef }), false);
});

test("site navigator focus honors reduced motion", () => {
  let behavior = "";
  const target = {
    classList: createClassList(),
    ownerDocument: { body: {} },
    parentElement: null,
    getBoundingClientRect: () => ({ top: 100, bottom: 140, height: 40 }),
    scrollIntoView: (options) => { behavior = options.behavior; },
    querySelector: () => null,
    closest: () => null,
    hasAttribute: () => true,
    focus: () => {},
  };
  focusVerifiedNavigationTarget({
    target,
    windowRef: { innerHeight: 700, matchMedia: () => ({ matches: true }) },
    requestAnimationFrameRef: (callback) => callback(),
    setTimeoutRef: (callback, delay) => { if (delay === 260) callback(); },
  });
  assert.equal(behavior, "auto");
});

test("semantic navigation requires a complete host adapter", () => {
  const reports = [];
  const navigator = createSiteNavigator({
    documentRef: { body: null },
    report: (state, detail) => reports.push([state, detail]),
    windowRef: {},
  });
  assert.equal(navigator.start(), false);
  assert.equal(reports[0][0], "failed");
  assert.equal(reports[0][1].reason, "adapter-required");
});

test("semantic navigation applies and verifies state before resolving an exact target", async () => {
  const order = [];
  const reports = [];
  let settled;
  const settledPromise = new Promise((resolve) => { settled = resolve; });
  const target = { isConnected: true };
  const navigator = createSiteNavigator({
    adapter: {
      getIntent: () => ({ route: "team-hours", state: { range: "year-to-date" } }),
      activate: ({ intent }) => order.push(["activate", intent.route]),
      applyState: ({ intent }) => order.push(["apply", intent.state.range]),
      isReady: () => { order.push(["ready"]); return true; },
      verifyState: ({ intent }) => { order.push(["verify", intent.state.range]); return true; },
      resolveTarget: () => { order.push(["resolve"]); return { target, exact: true, kind: "pay-total" }; },
    },
    documentRef: { body: null },
    focusTarget: ({ onSettled }) => {
      order.push(["focus"]);
      onSettled({ reason: "visible", target, visible: true });
      return true;
    },
    report: (state) => {
      reports.push(state);
      if (state === "focused") settled();
    },
    windowRef: {},
  });
  assert.equal(navigator.start(), true);
  await settledPromise;
  assert.deepEqual(order.map(([step]) => step), ["activate", "apply", "ready", "verify", "resolve", "focus"]);
  assert.equal(reports.at(-1), "focused");
});

test("semantic navigation never focuses when state verification fails", async () => {
  const reports = [];
  let focusCalls = 0;
  let resolveCalls = 0;
  const timers = [];
  const navigator = createSiteNavigator({
    adapter: {
      getIntent: () => ({ state: { range: "year-to-date" } }),
      activate: () => {},
      applyState: () => {},
      isReady: () => true,
      verifyState: () => ({ verified: false, reason: "range-mismatch" }),
      resolveTarget: () => { resolveCalls += 1; return null; },
    },
    documentRef: { body: null },
    focusTarget: () => { focusCalls += 1; },
    report: (state) => reports.push(state),
    setTimeoutRef: (callback) => { timers.push(callback); return timers.length; },
    clearTimeoutRef: () => {},
    windowRef: {},
  });
  assert.equal(navigator.start(), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resolveCalls, 0);
  assert.equal(focusCalls, 0);
  assert.ok(reports.includes("state-not-verified"));
  navigator.stop();
});

test("semantic navigation rejects broad targets that are not declared exact", async () => {
  const reports = [];
  let focusCalls = 0;
  const timers = [];
  const navigator = createSiteNavigator({
    adapter: {
      getIntent: () => ({ target: { field: "hourly-rate" } }),
      activate: () => {},
      applyState: () => {},
      isReady: () => true,
      verifyState: () => true,
      resolveTarget: () => ({ target: {}, kind: "staff-card" }),
    },
    documentRef: { body: null },
    focusTarget: () => { focusCalls += 1; },
    report: (state) => reports.push(state),
    setTimeoutRef: (callback) => { timers.push(callback); return timers.length; },
    clearTimeoutRef: () => {},
    windowRef: {},
  });
  navigator.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(focusCalls, 0);
  assert.ok(reports.includes("inexact-target"));
  navigator.stop();
});
