import { beforeEach, describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { getStreamKeyOwner, setIngestKeysActiveForUser } from "./ingest";

/**
 * An ingest key only opens a session while its owner holds a plan that may
 * start things, and a plan change turns a user's keys off or on without
 * deleting them.
 */

type Row = Record<string, unknown>;

/** Reads a column, following one level of embedding ("plans.product_id"). */
function valueOf(row: Row, column: string): unknown {
  const [head, tail] = column.split(".", 2);
  if (head === undefined || tail === undefined) return row[column];
  const embedded = row[head] as Row | Row[] | null;
  return Array.isArray(embedded) ? embedded[0]?.[tail] : embedded?.[tail];
}

/** One `col.op.value` term of a PostgREST or() filter (is.null and gt only). */
function orTermMatches(row: Row, term: string): boolean {
  const [column, op, ...rest] = term.split(".");
  const value = rest.join(".");
  if (column === undefined) throw new Error(`unsupported or() term ${term}`);
  const actual = valueOf(row, column);
  if (op === "is" && value === "null") return actual === null;
  if (op === "gt") return typeof actual === "string" && new Date(actual) > new Date(value);
  throw new Error(`unsupported or() term ${term}`);
}

/** In-memory PostgREST stand-in that applies the filters the query modules use. */
function fakeClient(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let update: Row | null = null;
      let limit = Number.POSITIVE_INFINITY;
      const matching = () => (tables[table] ?? []).filter((row) => filters.every((f) => f(row)));
      const run = () => {
        const rows = matching().slice(0, limit);
        if (update) for (const row of rows) Object.assign(row, update);
        return rows;
      };
      const chain = {
        select: () => chain,
        update: (values: Row) => {
          update = values;
          return chain;
        },
        eq: (column: string, value: unknown) => {
          filters.push((row) => valueOf(row, column) === value);
          return chain;
        },
        in: (column: string, values: readonly unknown[]) => {
          filters.push((row) => values.includes(valueOf(row, column)));
          return chain;
        },
        or: (expr: string) => {
          filters.push((row) => expr.split(",").some((term) => orTermMatches(row, term)));
          return chain;
        },
        order: () => chain,
        limit: (n: number) => {
          limit = n;
          return chain;
        },
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        then: (resolve: (value: { data: Row[]; error: null }) => unknown) => resolve({ data: run(), error: null }),
      };
      return chain;
    },
  } as unknown as SupabaseClient<Database>;
}

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

function subscription(overrides: Row = {}): Row {
  return {
    id: "sub-1",
    user_id: "u1",
    status: "active",
    current_period_end: null,
    created_at: inDays(-30),
    plans: { product_id: "cloud_obs" },
    ...overrides,
  };
}

let keys: Row[];

beforeEach(() => {
  keys = [{ id: "key-1", user_id: "u1", label: "Camera 1", stream_key: "sk-live", is_active: true }];
});

describe("getStreamKeyOwner", () => {
  test("an active key whose owner has an active plan opens", async () => {
    const client = fakeClient({ ingest_stream_keys: keys, user_subscriptions: [subscription()] });
    expect(await getStreamKeyOwner(client, "sk-live", "cloud_obs")).toEqual({ user_id: "u1", key_id: "key-1", label: "Camera 1" });
  });

  test("a trialing plan with a period still running opens", async () => {
    const client = fakeClient({
      ingest_stream_keys: keys,
      user_subscriptions: [subscription({ status: "trialing", current_period_end: inDays(3) })],
    });
    expect(await getStreamKeyOwner(client, "sk-live", "cloud_obs")).not.toBeNull();
  });

  test("an owner with no plan is refused", async () => {
    const client = fakeClient({ ingest_stream_keys: keys, user_subscriptions: [] });
    expect(await getStreamKeyOwner(client, "sk-live", "cloud_obs")).toBeNull();
  });

  test("a plan whose period has ended is refused, even while its status is still active", async () => {
    const client = fakeClient({
      ingest_stream_keys: keys,
      user_subscriptions: [subscription({ current_period_end: inDays(-1) })],
    });
    expect(await getStreamKeyOwner(client, "sk-live", "cloud_obs")).toBeNull();
  });

  test("past_due and canceled plans are refused", async () => {
    for (const status of ["past_due", "canceled"]) {
      const client = fakeClient({ ingest_stream_keys: keys, user_subscriptions: [subscription({ status })] });
      expect(await getStreamKeyOwner(client, "sk-live", "cloud_obs")).toBeNull();
    }
  });

  test("a plan for another product is refused", async () => {
    const client = fakeClient({
      ingest_stream_keys: keys,
      user_subscriptions: [subscription({ plans: { product_id: "ingest_server" } })],
    });
    expect(await getStreamKeyOwner(client, "sk-live", "cloud_obs")).toBeNull();
  });

  test("another user's plan doesn't count", async () => {
    const client = fakeClient({ ingest_stream_keys: keys, user_subscriptions: [subscription({ user_id: "u2" })] });
    expect(await getStreamKeyOwner(client, "sk-live", "cloud_obs")).toBeNull();
  });

  test("an inactive or unknown key is refused", async () => {
    const client = fakeClient({ ingest_stream_keys: keys, user_subscriptions: [subscription()] });
    keys[0]!.is_active = false;
    expect(await getStreamKeyOwner(client, "sk-live", "cloud_obs")).toBeNull();
    expect(await getStreamKeyOwner(client, "sk-other", "cloud_obs")).toBeNull();
  });
});

describe("setIngestKeysActiveForUser", () => {
  beforeEach(() => {
    keys = [
      { id: "key-1", user_id: "u1", is_active: true },
      { id: "key-2", user_id: "u1", is_active: false },
      { id: "key-3", user_id: "u2", is_active: true },
    ];
  });

  test("turns only that user's active keys off and keeps the rows", async () => {
    const client = fakeClient({ ingest_stream_keys: keys });
    expect(await setIngestKeysActiveForUser(client, "u1", false)).toEqual(["key-1"]);
    expect(keys.map((k) => [k.id, k.is_active])).toEqual([
      ["key-1", false],
      ["key-2", false],
      ["key-3", true],
    ]);
  });

  test("turns that user's keys back on", async () => {
    const client = fakeClient({ ingest_stream_keys: keys });
    expect(await setIngestKeysActiveForUser(client, "u1", true)).toEqual(["key-2"]);
    expect(keys.filter((k) => k.user_id === "u1").every((k) => k.is_active)).toBe(true);
  });

  test("throws on a database error", async () => {
    const failing = {
      from: () => {
        const chain = {
          update: () => chain,
          eq: () => chain,
          select: async () => ({ data: null, error: new Error("db down") }),
        };
        return chain;
      },
    } as unknown as SupabaseClient<Database>;
    await expect(setIngestKeysActiveForUser(failing, "u1", false)).rejects.toThrow("db down");
  });
});
