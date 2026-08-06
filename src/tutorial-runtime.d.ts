export interface TutorialContextAdapter {
  startRecording(input: Record<string, unknown>): Promise<void> | void;
  synchronize(input: Record<string, unknown>): Promise<boolean> | boolean;
  stopRecording(input: Record<string, unknown>): Promise<unknown> | unknown;
  [key: string]: unknown;
}

export interface SynchronizedTutorialEvidence {
  source: "synchronized-browser-contexts";
  observations: ReadonlyArray<Record<string, unknown>>;
  recordings: ReadonlyArray<{ contextId: string; recording: unknown }>;
}

export function createSynchronizedTutorialRuntime(options: {
  workflow: Record<string, any>;
  contexts: Map<string, TutorialContextAdapter> | Record<string, TutorialContextAdapter>;
  clock?: () => number;
}): {
  start(): Promise<void>;
  runStep(step: Record<string, any>, execute: (input: Record<string, any>) => Promise<unknown> | unknown): Promise<unknown>;
  finish(): Promise<SynchronizedTutorialEvidence>;
};

export function runSynchronizedTutorial(options: {
  workflow: Record<string, any>;
  contexts: Map<string, TutorialContextAdapter> | Record<string, TutorialContextAdapter>;
  clock?: () => number;
  execute(input: Record<string, any>): Promise<unknown> | unknown;
}): Promise<SynchronizedTutorialEvidence>;
