import { createPublicDiscoveryManifest, getSiteAgentConformance } from "./manifest.js";
import { validateTutorialArtifactAcceptanceEvidence } from "./artifact-contract.js";
import { getRenderedQualityMatrix, validateRenderedQualityEvidence } from "./rendered-quality.js";

function sanitizedProof(id, profile, status, startedAt, failureCode = "") {
  return Object.freeze({
    id,
    profile,
    status,
    durationMs: Date.now() - startedAt,
    failureCode: String(failureCode || "").slice(0, 120),
  });
}

async function runProof(proofs, id, profile, operation) {
  const startedAt = Date.now();
  try {
    await operation();
    proofs.push(sanitizedProof(id, profile, "passed", startedAt));
  } catch (error) {
    proofs.push(sanitizedProof(id, profile, "failed", startedAt, error?.message || error));
  }
}

function requireCase(cases, name) {
  if (!cases?.[name]) throw new Error(`conformance-case-required:${name}`);
  return cases[name];
}

function validateMultiActorEvidence(workflows, evidence = {}) {
  if (evidence.source !== "synchronized-browser-contexts") {
    throw new Error("multi-actor-source-not-proven");
  }
  const observations = Array.isArray(evidence.observations) ? evidence.observations : [];
  const observed = new Map(observations.map((item) => [`${item.workflowId}\0${item.stepId}`, item]));
  for (const workflow of workflows) {
    const contexts = new Map((workflow.contexts || []).map((context) => [context.id, context]));
    for (const step of workflow.steps || []) {
      const observation = observed.get(`${workflow.id}\0${step.id}`);
      if (!observation) throw new Error(`multi-actor-step-not-proven:${workflow.id}:${step.id}`);
      if (observation.actorId !== step.actorId || observation.contextId !== step.contextId) {
        throw new Error(`multi-actor-step-context-mismatch:${workflow.id}:${step.id}`);
      }
      if (!Number.isFinite(Number(observation.startedAtMs)) || !Number.isFinite(Number(observation.completedAtMs))) {
        throw new Error(`multi-actor-shared-timeline-missing:${workflow.id}:${step.id}`);
      }
      if (Number(observation.completedAtMs) < Number(observation.startedAtMs)) {
        throw new Error(`multi-actor-timeline-invalid:${workflow.id}:${step.id}`);
      }
      if (observation.barrierVerified !== true) {
        throw new Error(`multi-actor-barrier-not-proven:${workflow.id}:${step.id}`);
      }
      if (!contexts.has(observation.contextId)) {
        throw new Error(`multi-actor-context-not-declared:${workflow.id}:${step.id}`);
      }
    }
  }
}

export async function runSiteAgentConformance(options = {}) {
  const declared = getSiteAgentConformance(options.manifest);
  const proofs = [];
  if (!declared.valid) return { ...declared, proofs, executionVerified: false, fullyConformant: false };
  if (typeof options.createAgent !== "function") {
    return {
      ...declared,
      errors: [...declared.errors, "Executable conformance requires createAgent."],
      proofs,
      executionVerified: false,
      fullyConformant: false,
    };
  }

  const agent = await options.createAgent({ permissions: "authorized" });
  const deniedAgent = await options.createAgent({ permissions: "denied" });
  const cases = options.cases || {};

  await runProof(proofs, "core.permission-filtering", "core", async () => {
    const authorized = await agent.getCapabilities();
    const denied = await deniedAgent.getCapabilities();
    if ((authorized.actions?.length || 0) <= (denied.actions?.length || 0)) throw new Error("permission-filtering-not-proven");
  });

  await runProof(proofs, "core.public-discovery-redaction", "core", async () => {
    const publicManifest = createPublicDiscoveryManifest(options.manifest);
    const serialized = JSON.stringify(publicManifest);
    if (publicManifest.actions?.some(({ visibility }) => visibility !== "public")) throw new Error("private-action-exposed");
    if (/selector|firestorePath|storagePath|documentPath|collectionPath|credential/i.test(serialized)) {
      throw new Error("private-implementation-detail-exposed");
    }
  });

  if (declared.profiles.query) {
    const materializedResources = (options.manifest.queryResources || [])
      .filter(({ execution, freshness }) => execution === "local" && freshness?.mode === "static");
    if (materializedResources.length) {
      await runProof(proofs, "query.materialized-surface-parity", "query", async () => {
        const testCase = requireCase(cases, "materialization");
        if (typeof testCase.verify !== "function") throw new Error("materialization-verifier-required");
        const result = await testCase.verify({ resources: materializedResources });
        if (result !== true) throw new Error("materialized-surface-parity-not-proven");
      });
    }
    const nestedResources = materializedResources
      .filter(({ materialization }) => materialization?.nestedDestination === "exact-reveal-required");
    if (nestedResources.length) {
      await runProof(proofs, "query.nested-destination-reveal", "query", async () => {
        const testCase = requireCase(cases, "nestedNavigation");
        const requests = testCase.requests || [testCase.request];
        if (!Array.isArray(requests) || !requests.length) throw new Error("nested-navigation-request-required");
        for (const request of requests) {
          const result = await agent.query(request);
          const destinations = result.items.map(({ destination }) => destination).filter(Boolean);
          if (!destinations.length) throw new Error("nested-navigation-destination-required");
          for (const destination of destinations) {
            const outcome = await agent.navigate(destination);
            if (outcome.reveal?.complete !== true) throw new Error("nested-reveal-not-proven");
          }
          if (typeof testCase.verify === "function") await testCase.verify(result);
        }
      });
    }
    await runProof(proofs, "query.structured-read", "query", async () => {
      const testCase = requireCase(cases, "query");
      const result = await agent.query(testCase.request);
      if (!Array.isArray(result.items) || !result.status) throw new Error("query-result-not-structured");
      const destination = result.items.find(({ destination }) => destination)?.destination;
      if (destination && declared.profiles.navigation) {
        const navigation = await agent.navigate(destination);
        if (navigation.exact !== true || navigation.visible !== true) throw new Error("query-destination-not-navigable");
      }
      if (typeof testCase.verify === "function") await testCase.verify(result);
    });

    await runProof(proofs, "query.malformed-input-rejected", "query", async () => {
      const testCase = requireCase(cases, "invalidQuery");
      await agent.query(testCase.request)
        .then(() => { throw new Error("malformed-query-accepted"); }, (error) => {
          if (!String(error?.message).includes("schema-invalid")) throw error;
        });
    });
  }

  if (declared.profiles.navigation) {
    await runProof(proofs, "navigation.exact-target", "navigation", async () => {
      const testCase = requireCase(cases, "navigation");
      const result = await agent.navigate(testCase.intent);
      if (result.exact !== true || result.visible !== true) throw new Error("exact-visible-target-not-proven");
      if (typeof testCase.verify === "function") await testCase.verify(result);
    });
  }

  if (declared.profiles.action) {
    await runProof(proofs, "action.prepare-confirm-requery", "action", async () => {
      const testCase = requireCase(cases, "action");
      const plan = await agent.prepareAction(testCase.prepare);
      const result = await agent.confirmAction({
        actionId: plan.actionId,
        planId: plan.planId,
        confirmation: testCase.confirmation,
      });
      if (!new Set(["confirmed", "already-applied", "working"]).has(result.status)) throw new Error("action-not-completed");
      await agent.confirmAction({ actionId: plan.actionId, planId: plan.planId, confirmation: testCase.confirmation })
        .then(() => { throw new Error("duplicate-confirmation-accepted"); }, (error) => {
          if (!String(error?.message).includes("already-consumed")) throw error;
        });
      if (testCase.requery) await agent.query(testCase.requery);
      if (typeof testCase.verify === "function") await testCase.verify(result);
    });

    await runProof(proofs, "action.reconciliation", "action", async () => {
      const testCase = requireCase(cases, "reconciliation");
      const reconciliationAgent = typeof testCase.createAgent === "function"
        ? await testCase.createAgent()
        : agent;
      const plan = await reconciliationAgent.prepareAction(testCase.prepare);
      if (typeof testCase.mutate === "function") await testCase.mutate();
      const result = await reconciliationAgent.confirmAction({
        actionId: plan.actionId,
        planId: plan.planId,
        confirmation: testCase.confirmation,
      });
      if (!new Set(["already-applied", "reconfirmation-required"]).has(result.status)) {
        throw new Error("reconciliation-not-proven");
      }
    });

    await runProof(proofs, "action.expired-plan", "action", async () => {
      const testCase = requireCase(cases, "expiredAction");
      const expiredAgent = await testCase.createAgent();
      const plan = await expiredAgent.prepareAction(testCase.prepare);
      await expiredAgent.confirmAction({
        actionId: plan.actionId,
        planId: plan.planId,
        confirmation: testCase.confirmation,
      }).then(() => { throw new Error("expired-plan-accepted"); }, (error) => {
        if (!String(error?.message).includes("plan-expired")) throw error;
      });
    });
  }

  if (declared.profiles.presentation) {
    await runProof(proofs, "presentation.instructional-sequence", "presentation", async () => {
      const testCase = requireCase(cases, "presentation");
      if (!agent.presentation) throw new Error("presentation-controller-not-created");
      await agent.presentation.mount();
      await agent.presentation.click(testCase.target, { reducedMotion: true });
      await agent.presentation.type(testCase.inputTarget, testCase.value, { reducedMotion: true });
      await agent.presentation.clear();
      if (typeof testCase.verify === "function") await testCase.verify();
    });

    await runProof(proofs, "presentation.rendered-visual-quality", "presentation", async () => {
      const testCase = requireCase(cases, "visualQuality");
      if (typeof testCase.verify !== "function") throw new Error("rendered-quality-verifier-required");
      const evidence = await testCase.verify({ matrix: getRenderedQualityMatrix(options.manifest) });
      const result = validateRenderedQualityEvidence(options.manifest, evidence);
      if (!result.valid) throw new Error(result.errors.join(" | "));
    });

    await runProof(proofs, "presentation.artifact-acceptance", "presentation", async () => {
      const testCase = requireCase(cases, "artifactAcceptance");
      if (typeof testCase.verify !== "function") throw new Error("artifact-acceptance-verifier-required");
      const result = validateTutorialArtifactAcceptanceEvidence(await testCase.verify());
      if (!result.valid) throw new Error(result.errors.join(" | "));
    });
  }

  const multiActorWorkflows = (options.manifest.workflows || [])
    .filter((workflow) => (workflow.actors || []).length > 1);
  if (multiActorWorkflows.length) {
    await runProof(proofs, "workflow.synchronized-multi-actor", "core", async () => {
      const testCase = requireCase(cases, "multiActor");
      if (typeof testCase.verify !== "function") throw new Error("multi-actor-verifier-required");
      validateMultiActorEvidence(multiActorWorkflows, await testCase.verify({ workflows: multiActorWorkflows }));
    });
  }

  await runProof(proofs, "permission.denial", "core", async () => {
    const testCase = requireCase(cases, "denial");
    const method = deniedAgent[testCase.method];
    if (typeof method !== "function") throw new Error("denial-method-invalid");
    await method.call(deniedAgent, testCase.request)
      .then(() => { throw new Error("permission-denial-not-enforced"); }, (error) => {
        if (!String(error?.message).includes("not-authorized")) throw error;
      });
  });

  const executionVerified = proofs.length > 0 && proofs.every(({ status }) => status === "passed");
  return {
    ...declared,
    proofs,
    executionVerified,
    fullyConformant: declared.declaredComplete && executionVerified,
    tutorialConformant: declared.declaredTutorialComplete && executionVerified,
    errors: [...declared.errors, ...proofs.filter(({ status }) => status === "failed").map(({ id, failureCode }) => `${id}: ${failureCode}`)],
  };
}
