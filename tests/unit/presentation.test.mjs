import assert from "node:assert/strict";
import test from "node:test";
import {
  SITE_AGENT_PRESENTATION_PRESET,
  createPresentationController,
  getPresentationMotionDuration,
  getPresentationPointerPoint,
} from "../../src/presentation.js";
import cjsContract from "../../src/presentation-contract.cjs";

test("the standard presentation preset preserves cursor hotspot and bounded motion", () => {
  assert.equal(SITE_AGENT_PRESENTATION_PRESET.cursor, "modern-stemless-pointer");
  assert.equal(SITE_AGENT_PRESENTATION_PRESET.clickSound, "soft-tactile-ui-click-v1");
  assert.equal(SITE_AGENT_PRESENTATION_PRESET.typingSound, "ios-inspired-mobile-keyboard-tap-v1");
  assert.deepEqual(getPresentationPointerPoint({ x: 10, y: 20, width: 100, height: 50 }), { x: 60, y: 45 });
  assert.equal(getPresentationMotionDuration(0), 280);
  assert.equal(getPresentationMotionDuration(10000), 640);
  assert.deepEqual(cjsContract.SITE_AGENT_PRESENTATION_PRESET, SITE_AGENT_PRESENTATION_PRESET);
  assert.equal(cjsContract.SITE_AGENT_PRESENTATION_VERSION, 1);
});

test("presentation is opt-in, muted by default, and sequences move before click", async () => {
  const calls = [];
  const controller = createPresentationController({
    preset: { targetPauseMs: 0 },
    adapter: {
      mount: ({ muted }) => calls.push(["mount", muted]),
      move: ({ target, muted }) => calls.push(["move", target, muted]),
      click: ({ target, muted }) => calls.push(["click", target, muted]),
      type: ({ value, muted }) => calls.push(["type", value, muted]),
      setMuted: (muted) => calls.push(["muted", muted]),
    },
  });
  await controller.mount();
  await controller.click("target-1");
  controller.setMuted(false);
  await controller.type("field-1", "Hello");
  assert.deepEqual(calls, [
    ["mount", true],
    ["move", "target-1", true],
    ["click", "target-1", true],
    ["muted", false],
    ["type", "Hello", false],
  ]);
});
