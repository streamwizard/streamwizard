import { beforeEach, describe, expect, test } from "bun:test";
import { claimClipSync } from "./sync";

// claimClipSync is the clip sync throttle (SW-480): one sync per user per
// cooldown, decided by a conditional update so two requests can't both win.
// The fake below keeps one twitch_clip_syncs table in memory and applies the
// filters the query sends, so these tests check the filter as well as the
// branches around it.

type Row = { id: string; user_id: string; last_sync: string; sync_status: string; clip_count: number };

let rows: Row[];
let failUpdate: boolean;

function fakeClient() {
  return {
    from(table: string) {
      expect(table).toBe("twitch_clip_syncs");
      return {
        update(patch: Partial<Row>) {
          const filters: ((row: Row) => boolean)[] = [];
          const chain = {
            eq(column: keyof Row, value: string) {
              filters.push((row) => row[column] === value);
              return chain;
            },
            or(expression: string) {
              // Only the shape claimClipSync sends: "<col>.eq.<v>,<col>.lt.<v>".
              const clauses = expression.split(",").map((clause) => {
                const [column, op, ...rest] = clause.split(".");
                const value = rest.join(".");
                return (row: Row) => {
                  const current = String(row[column as keyof Row]);
                  if (op === "eq") return current === value;
                  if (op === "lt") return new Date(current).getTime() < new Date(value).getTime();
                  throw new Error(`unexpected operator ${op}`);
                };
              });
              filters.push((row) => clauses.some((clause) => clause(row)));
              return chain;
            },
            async select() {
              if (failUpdate) return { data: null, error: new Error("update failed") };
              const matched = rows.filter((row) => filters.every((f) => f(row)));
              for (const row of matched) Object.assign(row, patch);
              return { data: matched.map((row) => ({ id: row.id })), error: null };
            },
          };
          return chain;
        },
        upsert(row: Omit<Row, "id">, options: { onConflict: string; ignoreDuplicates: boolean }) {
          expect(options).toEqual({ onConflict: "user_id", ignoreDuplicates: true });
          return {
            async select() {
              if (rows.some((existing) => existing.user_id === row.user_id)) return { data: [], error: null };
              const inserted = { ...row, id: `sync-${rows.length + 1}` };
              rows.push(inserted);
              return { data: [{ id: inserted.id }], error: null };
            },
          };
        },
        select() {
          const filters: ((row: Row) => boolean)[] = [];
          const chain = {
            eq(column: keyof Row, value: string) {
              filters.push((row) => row[column] === value);
              return chain;
            },
            async single() {
              const row = rows.find((r) => filters.every((f) => f(r)));
              return { data: row ?? null, error: row ? null : { message: "no rows" } };
            },
          };
          return chain;
        },
      };
    },
  } as unknown as Parameters<typeof claimClipSync>[0];
}

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-04T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

beforeEach(() => {
  rows = [];
  failUpdate = false;
});

describe("claimClipSync", () => {
  test("a first sync creates the row and is claimed", async () => {
    expect(await claimClipSync(fakeClient(), "u1", now, HOUR)).toEqual({ claimed: true });
    expect(rows).toMatchObject([{ user_id: "u1", sync_status: "syncing", last_sync: now.toISOString(), clip_count: 0 }]);
  });

  test("a sync that finished inside the cooldown is not claimed", async () => {
    rows.push({ id: "s1", user_id: "u1", last_sync: ago(10 * 60 * 1000), sync_status: "completed", clip_count: 5 });
    expect(await claimClipSync(fakeClient(), "u1", now, HOUR)).toEqual({
      claimed: false,
      lastSync: ago(10 * 60 * 1000),
      status: "completed",
    });
    expect(rows[0]!.sync_status).toBe("completed");
  });

  test("a sync still running inside the cooldown is not claimed and reports syncing", async () => {
    rows.push({ id: "s1", user_id: "u1", last_sync: ago(60 * 1000), sync_status: "syncing", clip_count: 0 });
    expect(await claimClipSync(fakeClient(), "u1", now, HOUR)).toMatchObject({ claimed: false, status: "syncing" });
  });

  test("a sync past the cooldown is claimed again", async () => {
    rows.push({ id: "s1", user_id: "u1", last_sync: ago(HOUR + 1000), sync_status: "completed", clip_count: 5 });
    expect(await claimClipSync(fakeClient(), "u1", now, HOUR)).toEqual({ claimed: true });
    expect(rows[0]).toMatchObject({ sync_status: "syncing", last_sync: now.toISOString() });
  });

  test("a stuck 'syncing' row past the cooldown can be taken over", async () => {
    rows.push({ id: "s1", user_id: "u1", last_sync: ago(2 * HOUR), sync_status: "syncing", clip_count: 0 });
    expect(await claimClipSync(fakeClient(), "u1", now, HOUR)).toEqual({ claimed: true });
  });

  test("a failed sync can be retried right away", async () => {
    rows.push({ id: "s1", user_id: "u1", last_sync: ago(1000), sync_status: "failed", clip_count: 0 });
    expect(await claimClipSync(fakeClient(), "u1", now, HOUR)).toEqual({ claimed: true });
  });

  test("two claims in a row: only the first one wins", async () => {
    const client = fakeClient();
    expect(await claimClipSync(client, "u1", now, HOUR)).toEqual({ claimed: true });
    expect(await claimClipSync(client, "u1", now, HOUR)).toMatchObject({ claimed: false, status: "syncing" });
  });

  test("another user's recent sync does not block this one", async () => {
    rows.push({ id: "s1", user_id: "u2", last_sync: ago(1000), sync_status: "syncing", clip_count: 0 });
    expect(await claimClipSync(fakeClient(), "u1", now, HOUR)).toEqual({ claimed: true });
  });

  test("a database error is thrown, not treated as a claim", async () => {
    failUpdate = true;
    await expect(claimClipSync(fakeClient(), "u1", now, HOUR)).rejects.toThrow("update failed");
  });
});
