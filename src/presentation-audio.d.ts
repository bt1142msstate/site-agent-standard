export type SiteAgentPresentationSoundKind = "click" | "typing";

export declare const SITE_AGENT_PRESENTATION_SAMPLE_RATE: 48000;
export declare const SITE_AGENT_PRESENTATION_SOUND_PROFILES: Readonly<{
  click: "soft-tactile-ui-click-v1";
  typing: "ios-inspired-mobile-keyboard-tap-v1";
}>;

export declare function createPresentationSoundSamples(
  kind: SiteAgentPresentationSoundKind,
  options?: { sampleRate?: number; eventIndex?: number },
): Float64Array;

export declare function mixPresentationSoundSamples(
  destination: Float32Array | Float64Array | number[],
  startIndex: number,
  kind: SiteAgentPresentationSoundKind,
  options?: { sampleRate?: number; eventIndex?: number },
): typeof destination;

