"use strict";

const SITE_AGENT_PRESENTATION_VERSION = 1;

const SITE_AGENT_PRESENTATION_PRESET = Object.freeze({
  id: "standard-instructional-v1",
  cursor: "modern-stemless-pointer",
  cursorMotion: "travel-pause-click",
  frameTarget: "settled-sticky-header-aware",
  clickFeedback: "target-outline-and-ripple",
  clickSound: "soft-tactile-ui-click-v1",
  scrollMotion: "tutorial-eased-nested-scroll-v1",
  inputPresentation: "visible-typing-with-keystroke-audio",
  typingSound: "ios-inspired-mobile-keyboard-tap-v1",
  responsiveVariants: Object.freeze(["desktop", "mobile"]),
  moveDuration: Object.freeze({ minimumMs: 280, maximumMs: 640, baseMs: 240, distanceFactor: 0.18 }),
  targetPauseMs: 180,
  clickDurationMs: 220,
});

const SITE_AGENT_PRESENTATION_SELECTORS = Object.freeze({
  pointer: "[data-site-agent-presentation-pointer]",
  target: "[data-site-agent-presentation-target]",
  ripple: "[data-site-agent-presentation-ripple]",
  pointerCoreClass: "site-agent-presentation-pointer-core",
});

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getPresentationMotionDuration(distance, preset = SITE_AGENT_PRESENTATION_PRESET) {
  const motion = preset.moveDuration || SITE_AGENT_PRESENTATION_PRESET.moveDuration;
  return clamp(
    Number(motion.baseMs) + (Math.max(0, Number(distance) || 0) * Number(motion.distanceFactor)),
    Number(motion.minimumMs),
    Number(motion.maximumMs),
  );
}

function getPresentationPointerPoint(box, options = {}) {
  if (!box) return null;
  const xRatio = Number.isFinite(options.xRatio) ? options.xRatio : 0.5;
  const yRatio = Number.isFinite(options.yRatio) ? options.yRatio : 0.5;
  return Object.freeze({
    x: Math.round(box.x + clamp(box.width * xRatio, 12, Math.max(12, box.width - 12))),
    y: Math.round(box.y + clamp(box.height * yRatio, 12, Math.max(12, box.height - 12))),
  });
}

module.exports = {
  SITE_AGENT_PRESENTATION_PRESET,
  SITE_AGENT_PRESENTATION_SELECTORS,
  SITE_AGENT_PRESENTATION_VERSION,
  getPresentationMotionDuration,
  getPresentationPointerPoint,
};
