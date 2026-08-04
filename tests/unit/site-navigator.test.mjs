import test from "node:test";
import assert from "node:assert/strict";

import {
  focusVerifiedNavigationTarget,
  isVerifiedNavigationTargetVisible,
} from "../../src/site-navigator.js";

function createClassList() {
  const values = new Set();
  return {
    add: (value) => values.add(value),
    contains: (value) => values.has(value),
    remove: (value) => values.delete(value),
  };
}

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
