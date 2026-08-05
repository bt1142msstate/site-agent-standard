import { createSiteAgent } from "../../src/site-agent.js";

export default function createConformanceTarget(manifest) {
  let planSequence = 0;
  const createAgent = ({ permissions, expired = false }) => createSiteAgent({
    manifest,
    context: permissions === "authorized"
      ? { authenticated: true, permissions: ["orders.view", "orders.manage"] }
      : { authenticated: true, permissions: [] },
    adapters: {
      query: async ({ request }) => ({
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
      navigation: async ({ intent }) => ({
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
    },
  });

  return {
    createAgent,
    cases: {
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
      denial: { method: "query", request: { resourceId: "orders" } },
    },
  };
}
