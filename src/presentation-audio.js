export const SITE_AGENT_PRESENTATION_SAMPLE_RATE = 48000;

export const SITE_AGENT_PRESENTATION_SOUND_PROFILES = Object.freeze({
  click: "soft-tactile-ui-click-v1",
  typing: "ios-inspired-mobile-keyboard-tap-v1",
});

function normalizedSoundKind(kind) {
  if (kind === "click" || kind === "typing") return kind;
  throw new TypeError(`presentation-sound-kind-not-supported:${String(kind || "")}`);
}

function soundDuration(kind, sampleRate) {
  return Math.round(sampleRate * (kind === "typing" ? 0.018 : 0.075));
}

export function createPresentationSoundSamples(kind, options = {}) {
  const normalizedKind = normalizedSoundKind(kind);
  const sampleRate = Math.max(8000, Number(options.sampleRate) || SITE_AGENT_PRESENTATION_SAMPLE_RATE);
  const eventIndex = Math.max(0, Number(options.eventIndex) || 0);
  const samples = new Float64Array(soundDuration(normalizedKind, sampleRate));
  mixPresentationSoundSamples(samples, 0, normalizedKind, { eventIndex, sampleRate });
  return samples;
}

export function mixPresentationSoundSamples(destination, startIndex, kind, options = {}) {
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

