function requiredFunction(adapter, name, contextId) {
  if (typeof adapter?.[name] !== "function") {
    throw new Error(`tutorial-context-${name}-required:${contextId}`);
  }
  return adapter[name].bind(adapter);
}

function defaultClock() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function createSynchronizedTutorialRuntime(options = {}) {
  const workflow = options.workflow || {};
  const actors = new Map((workflow.actors || []).map((actor) => [actor.id, actor]));
  const declarations = new Map((workflow.contexts || []).map((context) => [context.id, context]));
  const adapters = options.contexts instanceof Map
    ? options.contexts
    : new Map(Object.entries(options.contexts || {}));
  const clock = typeof options.clock === "function" ? options.clock : defaultClock;
  const observations = [];
  const completedSteps = new Set();
  const recordings = [];
  let epochMs = 0;
  let started = false;
  let finished = false;

  if ((workflow.actors || []).length < 2) throw new Error("multi-actor-workflow-required");
  if (workflow.synchronization?.timeline !== "shared-monotonic") throw new Error("shared-monotonic-timeline-required");
  if (workflow.synchronization?.barriers !== "step-boundaries") throw new Error("step-boundary-barriers-required");
  if (workflow.synchronization?.recording !== "all-contexts") throw new Error("all-context-recording-required");
  for (const [contextId, declaration] of declarations) {
    if (!actors.has(declaration.actorId)) throw new Error(`tutorial-context-actor-unknown:${contextId}`);
    if (!adapters.has(contextId)) throw new Error(`tutorial-context-adapter-missing:${contextId}`);
  }

  async function synchronize(phase, step) {
    const barrierId = `${step.id}:${phase}`;
    const results = await Promise.all([...declarations].map(async ([contextId]) => {
      const adapter = adapters.get(contextId);
      return requiredFunction(adapter, "synchronize", contextId)({
        barrierId,
        contextId,
        phase,
        stepId: step.id,
        timelineMs: clock() - epochMs,
      });
    }));
    if (results.some((result) => result !== true)) throw new Error(`tutorial-barrier-failed:${barrierId}`);
  }

  async function start() {
    if (started) return;
    epochMs = clock();
    await Promise.all([...declarations].map(async ([contextId, declaration]) => {
      const adapter = adapters.get(contextId);
      await requiredFunction(adapter, "startRecording", contextId)({
        actor: actors.get(declaration.actorId),
        context: declaration,
        epochMs,
        workflowId: workflow.id,
      });
    }));
    started = true;
  }

  async function runStep(step, execute) {
    if (!started || finished) throw new Error("tutorial-runtime-not-active");
    for (const dependency of step.dependsOn || []) {
      if (!completedSteps.has(dependency)) throw new Error(`tutorial-step-dependency-incomplete:${step.id}:${dependency}`);
    }
    const declaration = declarations.get(step.contextId);
    const actor = actors.get(step.actorId);
    if (!declaration || declaration.actorId !== step.actorId || !actor) {
      throw new Error(`tutorial-step-context-invalid:${step.id}`);
    }
    await synchronize("before", step);
    const startedAtMs = clock() - epochMs;
    const output = await execute({
      actor,
      context: adapters.get(step.contextId),
      contextDeclaration: declaration,
      step,
      timeline: Object.freeze({ epochMs, startedAtMs }),
    });
    const completedAtMs = clock() - epochMs;
    await synchronize("after", step);
    completedSteps.add(step.id);
    observations.push(Object.freeze({
      workflowId: workflow.id,
      stepId: step.id,
      actorId: step.actorId,
      contextId: step.contextId,
      startedAtMs,
      completedAtMs,
      barrierVerified: true,
    }));
    return output;
  }

  async function finish() {
    if (!started || finished) throw new Error("tutorial-runtime-not-active");
    const results = await Promise.all([...declarations].map(async ([contextId, declaration]) => {
      const adapter = adapters.get(contextId);
      const recording = await requiredFunction(adapter, "stopRecording", contextId)({
        actor: actors.get(declaration.actorId),
        context: declaration,
        timelineMs: clock() - epochMs,
        workflowId: workflow.id,
      });
      if (!recording) throw new Error(`tutorial-context-recording-missing:${contextId}`);
      return Object.freeze({ contextId, recording });
    }));
    recordings.push(...results);
    finished = true;
    return Object.freeze({
      source: "synchronized-browser-contexts",
      observations: Object.freeze([...observations]),
      recordings: Object.freeze([...recordings]),
    });
  }

  return Object.freeze({ start, runStep, finish });
}

export async function runSynchronizedTutorial(options = {}) {
  const runtime = createSynchronizedTutorialRuntime(options);
  await runtime.start();
  for (const step of options.workflow.steps || []) {
    await runtime.runStep(step, options.execute);
  }
  return runtime.finish();
}
