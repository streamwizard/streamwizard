import { describe, expect, it } from "bun:test";
import { R2Storage } from "./r2";

const r2 = new R2Storage({ accountId: "acc", accessKeyId: "AKIATEST", secretAccessKey: "secret", bucket: "assets" });

describe("R2Storage.presignPut", () => {
  it("signs content-type and content-length so the client can't swap either", async () => {
    const url = new URL(await r2.presignPut("assets/u/a/file.png", "image/png", 1234));
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
  });

  it("uses the requested expiry", async () => {
    const url = new URL(await r2.presignPut("assets/u/a/file.png", "image/png", 1234, 120));
    expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
  });
});
