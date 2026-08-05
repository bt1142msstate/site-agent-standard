"use strict";

const SITE_AGENT_PRESENTATION_VERSION = 2;

const SITE_AGENT_PRESENTATION_SAMPLE_RATE = 48000;

const SITE_AGENT_PRESENTATION_SOUND_PROFILES = Object.freeze({
  click: "soft-tactile-ui-click-v1",
  typing: "ios-inspired-mobile-keyboard-tap-v1",
});

const SITE_AGENT_PRESENTATION_PRESET = Object.freeze({
  id: "standard-instructional-v2",
  cursor: "modern-stemless-pointer",
  cursorMotion: "travel-pause-click",
  frameTarget: "settled-sticky-header-aware",
  clickFeedback: "target-outline-and-ripple",
  clickSound: SITE_AGENT_PRESENTATION_SOUND_PROFILES.click,
  scrollMotion: "tutorial-eased-nested-scroll-v1",
  inputPresentation: "visible-typing-with-keystroke-audio",
  typingSound: SITE_AGENT_PRESENTATION_SOUND_PROFILES.typing,
  responsiveVariants: Object.freeze(["desktop", "mobile"]),
  moveDuration: Object.freeze({ minimumMs: 280, maximumMs: 640, baseMs: 240, distanceFactor: 0.18 }),
  targetPauseMs: 180,
  clickDurationMs: 220,
  keyDelayMs: 42,
  soundsEnabled: true,
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

function normalizedSoundKind(kind) {
  if (kind === "click" || kind === "typing") return kind;
  throw new TypeError(`presentation-sound-kind-not-supported:${String(kind || "")}`);
}

function soundDuration(kind, sampleRate) {
  return Math.round(sampleRate * (kind === "typing" ? 0.018 : 0.075));
}

function mixPresentationSoundSamples(destination, startIndex, kind, options = {}) {
  if (!destination || typeof destination.length !== "number") {
    throw new TypeError("presentation-sound-destination-required");
  }
  const normalizedKind = normalizedSoundKind(kind);
  const sampleRate = Math.max(8000, Number(options.sampleRate) || SITE_AGENT_PRESENTATION_SAMPLE_RATE);
  const eventIndex = Math.max(0, Number(options.eventIndex) || 0);
  const start = Math.max(0, Math.round(Number(startIndex) || 0));
  const duration = soundDuration(normalizedKind, sampleRate);
  let noiseState = (eventIndex + 1) * (normalizedKind === "typing" ? 7919 : 104729);

  for (let offset = 0; offset < duration; offset += 1) {
    const targetIndex = start + offset;
    if (targetIndex >= destination.length) break;
    noiseState = (noiseState * 48271) % 2147483647;
    const noise = ((noiseState / 2147483647) * 2) - 1;
    const seconds = offset / sampleRate;
    if (normalizedKind === "typing") {
      const frequency = 1780 + ((eventIndex * 37) % 120);
      const envelope = Math.exp(-seconds * 235);
      const primary = Math.sin(2 * Math.PI * frequency * seconds);
      const sheen = Math.sin(2 * Math.PI * (frequency * 1.72) * seconds);
      const transient = offset < Math.round(sampleRate * 0.0025) ? noise : 0;
      destination[targetIndex] += (
        (primary * 0.048) +
        (sheen * 0.018) +
        (transient * 0.014)
      ) * envelope;
      continue;
    }
    const bodyEnvelope = Math.exp(-seconds * 68);
    const sheenEnvelope = Math.exp(-seconds * 118);
    const transientEnvelope = Math.exp(-seconds * 420);
    destination[targetIndex] += (
      (Math.sin(2 * Math.PI * 620 * seconds) * 0.055 * bodyEnvelope) +
      (Math.sin(2 * Math.PI * 1680 * seconds) * 0.023 * sheenEnvelope) +
      (noise * 0.018 * transientEnvelope)
    );
  }
  return destination;
}

function createPresentationSoundSamples(kind, options = {}) {
  const normalizedKind = normalizedSoundKind(kind);
  const sampleRate = Math.max(8000, Number(options.sampleRate) || SITE_AGENT_PRESENTATION_SAMPLE_RATE);
  const samples = new Float64Array(soundDuration(normalizedKind, sampleRate));
  return mixPresentationSoundSamples(samples, 0, normalizedKind, options);
}

module.exports = {
  SITE_AGENT_PRESENTATION_PRESET,
  SITE_AGENT_PRESENTATION_SAMPLE_RATE,
  SITE_AGENT_PRESENTATION_SELECTORS,
  SITE_AGENT_PRESENTATION_SOUND_PROFILES,
  SITE_AGENT_PRESENTATION_VERSION,
  createPresentationSoundSamples,
  getPresentationMotionDuration,
  getPresentationPointerPoint,
  mixPresentationSoundSamples,
};
