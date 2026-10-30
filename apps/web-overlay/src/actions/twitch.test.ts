import { beforeEach, describe, expect, mock, test } from "bun:test";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

/**
 * Each overlay clip used to cost one Helix call on the shared app token every
 * time it was shown, and any failure (a 429 included) marked the clip dead for
 * hours. The URL is now cached per clip, and only "this clip has no download"
 * is reported as such.
 */

let helixCalls: number;
let answer: () => Promise<{ data: { landscape_download_url?: string }[] }>;

mock.module("@repo/twitch-api", () => ({
  TwitchApi: class {
    clips = {
      getClipDownloadUrl: async () => {
        helixCalls++;
        return answer();
      },
    };
  },
}));

const { ClipUnavailableError, getClipDownloadUrl } = await import("./twitch");

function helixError(status: number): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = { status, statusText: "", headers: {}, config, data: { message: "x" } } as AxiosResponse;
  return new AxiosError("Request failed", undefined, config, null, response);
}

beforeEach(() => {
  helixCalls = 0;
  answer = async () => ({ data: [{ landscape_download_url: "https://clips.example/a.mp4" }] });
});

describe("getClipDownloadUrl", () => {
  test("a clip's URL is fetched once and then served from cache", async () => {
    expect(await getClipDownloadUrl("cached-clip", "b1")).toBe("https://clips.example/a.mp4");
    expect(await getClipDownloadUrl("cached-clip", "b1")).toBe("https://clips.example/a.mp4");
    expect(helixCalls).toBe(1);
  });

  test("no URL, or a 404, means the clip is unavailable", async () => {
    answer = async () => ({ data: [] });
    expect(getClipDownloadUrl("empty-clip", "b1")).rejects.toBeInstanceOf(ClipUnavailableError);

    answer = async () => {
      throw helixError(404);
    };
    expect(getClipDownloadUrl("missing-clip", "b1")).rejects.toBeInstanceOf(ClipUnavailableError);
  });

  test("a 429 or 5xx is a plain error, and isn't cached", async () => {
    for (const status of [429, 503]) {
      answer = async () => {
        throw helixError(status);
      };
      const error = await getClipDownloadUrl(`busy-${status}`, "b1").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(ClipUnavailableError);
    }

    answer = async () => ({ data: [{ landscape_download_url: "https://clips.example/b.mp4" }] });
    expect(await getClipDownloadUrl("busy-429", "b1")).toBe("https://clips.example/b.mp4");
  });
});
