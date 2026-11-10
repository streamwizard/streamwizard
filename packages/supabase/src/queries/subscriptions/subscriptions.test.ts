import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import {
  getSubscriptionLimits,
  getUserActiveSubscriptionId,
  isActiveSubscriptionOfUser,
  periodNotOverFilter,
} from "./subscriptions";

/**
 * The launch action and the node-facing limits lookup used to accept any
 * active/trialing/past_due row, ignoring current_period_end, so a lapsed grant
 * or a past_due plan could still start Cloud OBS. They must apply the same
 * rule as get_product_access's can_interact.
 */

type Call = [method: string, ...args: unknown[]];

/** Records the PostgREST builder chain and resolves to `result`. */
function recordingClient(result: unknown) {
  const calls: Call[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq", "in", "or", "order", "limit"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return chain;
    };
  }
  chain.maybeSingle = async () => {
    calls.push(["maybeSingle"]);
    return result;
  };
  return { client: chain as unknown as SupabaseClient<Database>, calls };
}

function filtersOf(calls: Call[]) {
  return {
    statuses: calls.find(([m, column]) => m === "in" && column === "status")?.[2],
    period: calls.find(([m]) => m === "or")?.[1],
    product: calls.find(([m, column]) => m === "eq" && column === "plans.product_id")?.[2],
  };
}

describe("periodNotOverFilter", () => {
  test("open-ended grants or a period ending after now", () => {
    expect(periodNotOverFilter(new Date("2026-10-28T12:00:00.000Z"))).toBe(
      "current_period_end.is.null,current_period_end.gt.2026-10-28T12:00:00.000Z",
    );
  });
});

describe("launch entitlement lookups", () => {
  test("getUserActiveSubscriptionId: active or trialing only, period not over", async () => {
    const { client, calls } = recordingClient({ data: { id: "sub-1" } });
    expect(await getUserActiveSubscriptionId(client, "u1", "cloud_obs")).toBe("sub-1");
    const { statuses, period } = filtersOf(calls);
    expect(statuses).toEqual(["active", "trialing"]);
    expect(String(period)).toStartWith("current_period_end.is.null,current_period_end.gt.");
  });

  test("getSubscriptionLimits: same predicate for the node-facing lookup", async () => {
    const { client, calls } = recordingClient({ data: { plans: { limits: { max_instances: 1 } } } });
    expect(await getSubscriptionLimits(client, "sub-1", "cloud_obs")).toEqual({ max_instances: 1 } as never);
    const { statuses, period, product } = filtersOf(calls);
    expect(statuses).toEqual(["active", "trialing"]);
    expect(statuses).not.toContain("past_due");
    expect(String(period)).toStartWith("current_period_end.is.null,current_period_end.gt.");
    expect(product).toBe("cloud_obs");
  });

  test("isActiveSubscriptionOfUser: the user's own plan for that product, same predicate", async () => {
    const { client, calls } = recordingClient({ data: { id: "sub-1" } });
    expect(await isActiveSubscriptionOfUser(client, "sub-1", "u1", "cloud_obs")).toBe(true);
    const { statuses, period, product } = filtersOf(calls);
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(product).toBe("cloud_obs");
    expect(statuses).toEqual(["active", "trialing"]);
    expect(String(period)).toStartWith("current_period_end.is.null,current_period_end.gt.");
  });

  test("isActiveSubscriptionOfUser: false when no row matches", async () => {
    const { client } = recordingClient({ data: null });
    expect(await isActiveSubscriptionOfUser(client, "sub-1", "u1", "cloud_obs")).toBe(false);
  });
});
