export interface SiteAgentPresentationPreset {
  id: string;
  cursor: string;
  cursorMotion: string;
  frameTarget: string;
  clickFeedback: string;
  clickSound: string;
  scrollMotion: string;
  inputPresentation: string;
  typingSound: string;
  responsiveVariants: readonly string[];
  moveDuration: { minimumMs: number; maximumMs: number; baseMs: number; distanceFactor: number };
  targetPauseMs: number;
  clickDurationMs: number;
  keyDelayMs: number;
  soundsEnabled: boolean;
}

export * from "./presentation-audio.js";

export declare const SITE_AGENT_PRESENTATION_VERSION: 2;
export declare const SITE_AGENT_PRESENTATION_PRESET: Readonly<SiteAgentPresentationPreset>;
export declare const SITE_AGENT_PRESENTATION_SELECTORS: Readonly<Record<string, string>>;
export declare function getPresentationMotionDuration(distance: number, preset?: SiteAgentPresentationPreset): number;
export declare function getPresentationPointerPoint(
  box: { x: number; y: number; width: number; height: number },
  options?: { xRatio?: number; yRatio?: number },
): { x: number; y: number } | null;
export declare function framePresentationTarget(
  target: HTMLElement,
  options?: {
    document?: Document;
    window?: Window;
    reducedMotion?: boolean;
    preset?: SiteAgentPresentationPreset;
  },
): Promise<{
  distancePx: number;
  durationMs: number;
  scrolled: boolean;
  segments: readonly { distancePx: number; durationMs: number; scope: "viewport" | "container" }[];
}>;
export declare function createPresentationController(options?: Record<string, unknown>): Record<string, unknown>;
export declare function createBrowserPresentationAdapter(options?: Record<string, unknown>): Record<string, unknown>;
