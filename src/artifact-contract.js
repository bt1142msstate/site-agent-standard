const defaultVolatileKeys = Object.freeze([
  "bakedAt",
  "finalizedAt",
  "generatedAt",
  "generated_at",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function canonicalizeFingerprintValue(value, options = {}) {
  const volatileKeys = new Set(options.volatileKeys || defaultVolatileKeys);
  if (Array.isArray(value)) return value.map((item) => canonicalizeFingerprintValue(item, { volatileKeys }));
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort()
    .filter((key) => !volatileKeys.has(key))
    .map((key) => [key, canonicalizeFingerprintValue(value[key], { volatileKeys })]));
}

export function stableFingerprintPayload(entries = [], options = {}) {
  const normalized = [...entries]
    .map((entry) => ({
      path: String(entry.path || "").replaceAll("\\", "/"),
      value: canonicalizeFingerprintValue(entry.value, options),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return JSON.stringify(normalized);
}

export function validateTutorialArtifactAcceptanceEvidence(evidence = {}) {
  const errors = [];
  const timelineDurationMs = Number(evidence.timelineDurationMs);
  const video = evidence.media?.video || {};
  const audio = evidence.media?.audio || {};
  if (evidence.sourceFingerprint?.algorithm !== "sha256") errors.push("artifact-source-fingerprint-must-use-sha256");
  if (evidence.sourceFingerprint?.normalization !== "stable-content-v1") errors.push("artifact-source-fingerprint-normalization-invalid");
  if (!/^[a-f0-9]{64}$/.test(String(evidence.sourceFingerprint?.digest || ""))) errors.push("artifact-source-fingerprint-invalid");
  if (!Number.isFinite(timelineDurationMs) || timelineDurationMs <= 0) errors.push("artifact-timeline-duration-invalid");
  if (video.decodedFullDuration !== true) errors.push("artifact-video-full-decode-required");
  if (!Number.isFinite(Number(video.durationMs)) || Number(video.durationMs) + 250 < timelineDurationMs) {
    errors.push("artifact-video-duration-incomplete");
  }
  if (audio.required === true || audio.present === true) {
    if (audio.present !== true) errors.push("artifact-audio-required");
    if (audio.decodedFullDuration !== true) errors.push("artifact-audio-full-decode-required");
    if (!Number.isFinite(Number(audio.durationMs)) || Number(audio.durationMs) + 250 < timelineDurationMs) {
      errors.push("artifact-audio-duration-incomplete");
    }
    if (
      Number.isFinite(Number(audio.durationMs))
      && Number.isFinite(Number(video.durationMs))
      && Math.abs(Number(audio.durationMs) - Number(video.durationMs)) > 500
    ) errors.push("artifact-audio-video-duration-mismatch");
  }
  if (evidence.integrity?.verified !== true) errors.push("artifact-integrity-required");
  if (evidence.deployment?.isolated !== true) errors.push("artifact-deployment-must-be-isolated");
  if (evidence.deployment?.cleanBeforeWrite !== true) errors.push("artifact-deployment-directory-must-be-clean");
  if (evidence.deployment?.symlinkFree !== true) errors.push("artifact-deployment-directory-must-be-symlink-free");
  if (evidence.deployment?.pathClass !== "generated-artifact") errors.push("artifact-deployment-path-class-invalid");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export const SITE_AGENT_FINGERPRINT_NORMALIZATION = "stable-content-v1";
