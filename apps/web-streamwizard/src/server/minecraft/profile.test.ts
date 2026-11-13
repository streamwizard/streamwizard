import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { resetMinecraftProfileCache, resolveMinecraftProfile } from "./profile";

const realFetch = globalThis.fetch;
let calls: string[] = [];

function respondWith(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  }) as unknown as typeof fetch;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("resolveMinecraftProfile", () => {
  beforeEach(() => {
    calls = [];
    resetMinecraftProfileCache();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("returns the dashed UUID and Mojang's spelling of the name", async () => {
    respondWith(() => json({ id: "069A79F444E94726A5BEFCA90E38AAF5", name: "Notch" }));
    expect(await resolveMinecraftProfile("notch")).toEqual({
      status: "found",
      uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
      name: "Notch",
    });
    expect(calls).toEqual(["https://api.mojang.com/users/profiles/minecraft/notch"]);
  });

  for (const status of [404, 204]) {
    test(`reads a ${status} as "no such account"`, async () => {
      respondWith(() => new Response(null, { status }));
      expect(await resolveMinecraftProfile("Nobody_Here")).toEqual({ status: "not_found" });
    });
  }

  test("asks Mojang once for the same name, whatever the case", async () => {
    respondWith(() => json({ id: "069a79f444e94726a5befca90e38aaf5", name: "Notch" }));
    await resolveMinecraftProfile("Notch");
    await resolveMinecraftProfile("NOTCH");
    expect(calls).toHaveLength(1);
  });

  test("reports unavailable when Mojang is down, and asks again next time", async () => {
    respondWith(() => new Response("busy", { status: 503 }));
    expect(await resolveMinecraftProfile("Notch")).toEqual({ status: "unavailable" });
    respondWith(() => json({ id: "069a79f444e94726a5befca90e38aaf5", name: "Notch" }));
    expect((await resolveMinecraftProfile("Notch")).status).toBe("found");
  });

  test("reports unavailable when the request fails or the answer has another shape", async () => {
    respondWith(() => {
      throw new Error("network");
    });
    expect(await resolveMinecraftProfile("Notch")).toEqual({ status: "unavailable" });
    respondWith(() => json({ id: "not-a-uuid", name: "Notch" }));
    expect(await resolveMinecraftProfile("Alex")).toEqual({ status: "unavailable" });
  });

  test("never sends a name Minecraft would not accept", async () => {
    respondWith(() => json({}));
    expect(await resolveMinecraftProfile("../../admin")).toEqual({ status: "not_found" });
    expect(await resolveMinecraftProfile("a b")).toEqual({ status: "not_found" });
    expect(calls).toEqual([]);
  });
});
