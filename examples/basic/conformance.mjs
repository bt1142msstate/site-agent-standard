import { createSiteAgent } from "../../src/site-agent.js";

export default function createConformanceTarget(manifest) {
  let planSequence = 0;
  const presentationEvents = [];
  const createAgent = ({ permissions, expired = false }) => createSiteAgent({
    manifest,
    context: permissions === "authorized"
      ? { authenticated: true, permissions: ["orders.view", "orders.manage"] }
      : { authenticated: true, permissions: [] },
    adapters: {
      query: async ({ request }) => request.resourceId === "public-document-text"
        ? ({
            total: 1,
            summary: "One matching document excerpt",
            items: [{
              reference: "opaque-excerpt-1",
              label: "Tuition",
              fields: { page: 11 },
              destination: {
                destinationId: "public-document.excerpt",
                state: { documentPage: 11 },
                target: { reference: "opaque-excerpt-1", kind: "document-segment" },
              },
            }],
          })
        : ({
            total: 1,
            summary: "One matching order",
            asOf: "2026-08-04T00:00:00.000Z",
            items: [{
              reference: "opaque-order-1",
              label: "Example order",
              fields: { status: request.filters?.status || "open" },
              destinationState: { status: request.filters?.status || "open" },
            }],
          }),
      navigation: async ({ destination, intent }) => destination.reveal?.mode === "nested"
        ? ({
            exact: true,
            visible: true,
            targetKind: intent.target.kind,
            reveal: { complete: true, verifiedSteps: destination.reveal.steps.map(({ id }) => id) },
          })
        : ({
            exact: intent.target?.reference === "opaque-order-1",
            visible: true,
          }),
      action: {
        prepare: async ({ request }) => ({
          planId: request.input.orderReference === "opaque-conflict" ? "conflict-plan" : `plan-${++planSequence}`,
          status: "prepared",
          confirmation: "explicit",
          expiresAt: expired ? "2000-01-01T00:00:00.000Z" : "2099-01-01T00:00:00.000Z",
        }),
        confirm: async ({ request }) => request.planId === "conflict-plan"
          ? {
              status: "reconfirmation-required",
              reconciliation: "conflicting",
              replacementPlan: {
                planId: "replacement-plan",
                status: "prepared",
                confirmation: "explicit",
                expiresAt: "2099-01-01T00:00:00.000Z",
              },
            }
          : {
              status: "confirmed",
              output: { archived: true },
              destination: { destinationId: "orders.detail", target: { reference: "opaque-order-1" } },
            },
        cancel: async () => ({ status: "canceled" }),
      },
      presentation: {
        mount: async () => presentationEvents.push("mount"),
        move: async () => presentationEvents.push("move"),
        click: async () => presentationEvents.push("click"),
        type: async () => presentationEvents.push("type"),
        clear: async () => presentationEvents.push("clear"),
      },
    },
  });

  return {
    createAgent,
    cases: {
      materialization: { verify: () => true },
      nestedNavigation: { request: { resourceId: "public-document-text", filters: { query: "tuition" } } },
      query: { request: { resourceId: "orders", filters: { status: "open" } } },
      invalidQuery: { request: { resourceId: "orders", filters: { status: 7 } } },
      navigation: {
        intent: {
          destinationId: "orders.detail",
          state: { status: "open" },
          target: { reference: "opaque-order-1", kind: "order" },
        },
      },
      action: {
        prepare: { actionId: "orders.archive", input: { orderReference: "opaque-order-1" } },
        confirmation: true,
        requery: { resourceId: "orders", filters: { status: "open" } },
      },
      reconciliation: {
        prepare: { actionId: "orders.archive", input: { orderReference: "opaque-conflict" } },
        confirmation: true,
      },
      expiredAction: {
        createAgent: () => createAgent({ permissions: "authorized", expired: true }),
        prepare: { actionId: "orders.archive", input: { orderReference: "opaque-expired" } },
        confirmation: true,
      },
      presentation: {
        target: "opaque-presentation-target",
        inputTarget: "opaque-presentation-input",
        value: "Example",
        verify: () => {
          const expected = ["mount", "move", "click", "type", "clear"];
          if (expected.some((event) => !presentationEvents.includes(event))) {
            throw new Error("presentation-sequence-not-proven");
          }
        },
      },
      visualQuality: {
        verify: ({ matrix }) => ({
          source: "browser-computed-style",
          observations: matrix.map((item) => ({
            ...item,
            source: "browser-computed-style",
            computedStyles: true,
            labelsChecked: 1,
            textContrastChecks: 1,
            violations: [],
          })),
        }),
      },
      artifactAcceptance: {
        verify: () => ({
          timelineDurationMs: 4200,
          sourceFingerprint: {
            algorithm: "sha256",
            normalization: "stable-content-v1",
            digest: "a".repeat(64),
          },
          media: {
            video: { decodedFullDuration: true, durationMs: 4200 },
            audio: { required: true, present: true, decodedFullDuration: true, durationMs: 4200 },
          },
          integrity: { verified: true },
          deployment: {
            isolated: true,
            cleanBeforeWrite: true,
            symlinkFree: true,
            pathClass: "generated-artifact",
          },
        }),
      },
      multiActor: {
        verify: ({ workflows }) => ({
          source: "synchronized-browser-contexts",
          observations: workflows.flatMap((workflow) => workflow.steps.map((step, index) => ({
            workflowId: workflow.id,
            stepId: step.id,
            actorId: step.actorId,
            contextId: step.contextId,
            startedAtMs: index * 1000,
            completedAtMs: (index * 1000) + 800,
            barrierVerified: true,
          }))),
        }),
      },
      denial: { method: "query", request: { resourceId: "orders" } },
    },
  };
}
