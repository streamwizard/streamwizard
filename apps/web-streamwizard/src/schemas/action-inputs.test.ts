import { describe, expect, test } from "bun:test";
import { createAssetUploadSchema } from "./assets";
import { addClipToFolderSchema, createClipFolderSchema } from "./clip-folders";
import { idSchema, twitchClipIdSchema, twitchIdSchema } from "./ids";
import { launchInstanceOptionsSchema, mintNodeTokenSchema } from "./obs";
import { overlayImportTextSchema, saveOverlayItemsSchema } from "./overlay-actions";
import { createClipFromVodSchema, deleteVideosSchema } from "./twitch";
import { widgetIdsSchema } from "./widgets";

const ID = "4a1f0c2e-8b7d-4c3a-9e5f-1d2c3b4a5e6f";

describe("ids", () => {
  test("row ids must be uuids", () => {
    expect(idSchema.safeParse(ID).success).toBe(true);
    for (const bad of ["", "1", "temp-3", `${ID} `, "../x"]) expect(idSchema.safeParse(bad).success).toBe(false);
  });

  test("Twitch ids are numeric strings", () => {
    expect(twitchIdSchema.safeParse("12826").success).toBe(true);
    for (const bad of ["", "abc", "1".repeat(21), "12 34"]) expect(twitchIdSchema.safeParse(bad).success).toBe(false);
  });

  test("clip ids are slugs", () => {
    expect(twitchClipIdSchema.safeParse("AwkwardHelplessSalamander-abc_1").success).toBe(true);
    expect(twitchClipIdSchema.safeParse("https://evil.example/x").success).toBe(false);
  });
});

describe("clip folders", () => {
  test("a folder name is bounded and plain", () => {
    expect(createClipFolderSchema.safeParse({ name: "Best of 2026" }).success).toBe(true);
    expect(createClipFolderSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createClipFolderSchema.safeParse({ name: "a".repeat(256) }).success).toBe(false);
    expect(createClipFolderSchema.safeParse({ name: "<script>" }).success).toBe(false);
  });

  test("adding a clip needs an existing folder and drops any user id sent along", () => {
    expect(addClipToFolderSchema.safeParse({ clipId: "Clip-1", folderName: "Fav" }).success).toBe(false);
    const parsed = addClipToFolderSchema.parse({ clipId: "Clip-1", folderId: ID, folderName: "Fav", userId: "someone-else" });
    expect(parsed).not.toHaveProperty("userId");
  });
});

describe("uploads", () => {
  const ok = { fileName: "alert.png", mimeType: "image/png", sizeBytes: 1024 };

  test("accepts a normal file", () => {
    expect(createAssetUploadSchema.safeParse(ok).success).toBe(true);
  });

  test("refuses bad sizes, names and types", () => {
    for (const bad of [
      { ...ok, sizeBytes: 0 },
      { ...ok, sizeBytes: 1.5 },
      { ...ok, sizeBytes: 10 * 1024 * 1024 + 1 },
      { ...ok, sizeBytes: "1024" },
      { ...ok, fileName: "" },
      { ...ok, fileName: "a".repeat(256) },
      { ...ok, mimeType: "x".repeat(101) },
    ]) {
      expect(createAssetUploadSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("cloud OBS", () => {
  test("node tokens need a uuid instance and a streamer scope", () => {
    expect(mintNodeTokenSchema.safeParse({ instanceId: ID, scope: "files" }).success).toBe(true);
    expect(mintNodeTokenSchema.safeParse({ instanceId: ID, scope: "admin:instances" }).success).toBe(false);
    expect(mintNodeTokenSchema.safeParse({ instanceId: "i-1", scope: "files" }).success).toBe(false);
  });

  test("launch options are an allowlist", () => {
    expect(launchInstanceOptionsSchema.safeParse({}).success).toBe(true);
    expect(launchInstanceOptionsSchema.safeParse({ resolution: "1920x1080", template: "default" }).success).toBe(true);
    expect(launchInstanceOptionsSchema.safeParse({ subscription_id: "x" }).success).toBe(false);
    expect(launchInstanceOptionsSchema.safeParse({ template: "../../etc" }).success).toBe(false);
  });
});

describe("overlays", () => {
  test("a save names a uuid scene and stays within bounds", () => {
    expect(saveOverlayItemsSchema.safeParse({ sceneId: ID, items: [{ temp_id: "temp-1" }], groups: [] }).success).toBe(true);
    expect(saveOverlayItemsSchema.safeParse({ sceneId: "x", items: [], groups: [] }).success).toBe(false);
    const tooMany = Array.from({ length: 501 }, (_, i) => ({ temp_id: `temp-${i}` }));
    expect(saveOverlayItemsSchema.safeParse({ sceneId: ID, items: tooMany, groups: [] }).success).toBe(false);
  });

  test("an import is capped at the server action body limit", () => {
    expect(overlayImportTextSchema.safeParse("{}").success).toBe(true);
    expect(overlayImportTextSchema.safeParse("x".repeat(1024 * 1024 + 1)).success).toBe(false);
  });

  test("widget id lists drop anything that can't be a row id", () => {
    expect(widgetIdsSchema.parse([ID, ID, "", "temp-1"])).toEqual([ID]);
    expect(widgetIdsSchema.safeParse(Array.from({ length: 501 }, () => ID)).success).toBe(false);
  });
});

describe("VODs", () => {
  test("deletes are 1 to 5 numeric ids", () => {
    expect(deleteVideosSchema.safeParse(["1"]).success).toBe(true);
    expect(deleteVideosSchema.safeParse([]).success).toBe(false);
    expect(deleteVideosSchema.safeParse(["1", "2", "3", "4", "5", "6"]).success).toBe(false);
    expect(deleteVideosSchema.safeParse(["abc"]).success).toBe(false);
  });

  test("a clip from a VOD is 5 to 60 seconds and can't start before the VOD", () => {
    expect(createClipFromVodSchema.safeParse({ vodId: "1", vod_offset: 30, duration: 20 }).success).toBe(true);
    expect(createClipFromVodSchema.safeParse({ vodId: "1", vod_offset: 10, duration: 20 }).success).toBe(false);
    expect(createClipFromVodSchema.safeParse({ vodId: "1", vod_offset: 100, duration: 61 }).success).toBe(false);
  });
});
