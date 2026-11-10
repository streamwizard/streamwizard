import { describe, expect, test } from "bun:test";
import { ingestPullStreamId, obsPullUrl } from "./obs-irl";

const HOST = "100.64.0.5";

describe("ingestPullStreamId", () => {
  test("reads the output key from what obsPullUrl builds", () => {
    expect(ingestPullStreamId(obsPullUrl(HOST, "abc123"), HOST)).toBe("abc123");
  });

  test("is null for other feeds", () => {
    expect(ingestPullStreamId(obsPullUrl("10.0.0.9", "abc123"), HOST)).toBeNull();
    expect(ingestPullStreamId(`srt://${HOST}:9000`, HOST)).toBeNull();
    expect(ingestPullStreamId(`srt://${HOST}:9000?streamid=`, HOST)).toBeNull();
    expect(ingestPullStreamId(`rtmp://${HOST}/live?streamid=abc`, HOST)).toBeNull();
    expect(ingestPullStreamId("/home/user/video.mp4", HOST)).toBeNull();
    expect(ingestPullStreamId("", HOST)).toBeNull();
  });
});
