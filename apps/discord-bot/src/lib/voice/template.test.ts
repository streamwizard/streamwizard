import { describe, expect, test } from "bun:test";
import { findUnknownVoicePlaceholders } from "@repo/supabase/queries/discord-voice";
import { CHANNEL_NAME_MAX, cleanChannelName, renderChannelName } from "./template";

const values = { username: "pogfrog", displayname: "Pog Frog" };

describe("renderChannelName", () => {
  test("fills in the default template", () => {
    expect(renderChannelName("{username}'s channel", values)).toBe("pogfrog's channel");
  });

  test("placeholders ignore capitalisation and spaces inside the braces", () => {
    expect(renderChannelName("{ DisplayName } hangout", values)).toBe("Pog Frog hangout");
  });

  test("fills every occurrence", () => {
    expect(renderChannelName("{username} & {username}", values)).toBe("pogfrog & pogfrog");
  });

  test("leaves unknown placeholders as written", () => {
    expect(renderChannelName("{game} with {username}", values)).toBe("{game} with pogfrog");
  });

  test("object built-ins aren't placeholders", () => {
    expect(renderChannelName("{constructor} {toString}", values)).toBe("{constructor} {toString}");
  });

  test("collapses whitespace and trims", () => {
    expect(renderChannelName("  {username}\n\n  room  ", values)).toBe("pogfrog room");
  });

  test("cuts to Discord's 100 characters without splitting an emoji", () => {
    const name = renderChannelName("🎮".repeat(150), values);
    expect([...name].length).toBe(CHANNEL_NAME_MAX);
    expect(name).toBe("🎮".repeat(CHANNEL_NAME_MAX));
  });

  test("a long nickname can't push the name past the limit", () => {
    const name = renderChannelName("{displayname}'s channel", { ...values, displayname: "x".repeat(120) });
    expect([...name].length).toBe(CHANNEL_NAME_MAX);
  });

  test("falls back to a plain name when nothing is left", () => {
    expect(renderChannelName("{displayname}", { ...values, displayname: "   " })).toBe("Voice channel");
  });
});

describe("cleanChannelName", () => {
  test("trims and collapses", () => {
    expect(cleanChannelName("  late   night  chat ")).toBe("late night chat");
  });

  test("null when only whitespace", () => {
    expect(cleanChannelName(" \n ")).toBeNull();
  });
});

describe("findUnknownVoicePlaceholders", () => {
  test("known placeholders pass, any case", () => {
    expect(findUnknownVoicePlaceholders("{username} / {DisplayName}")).toEqual([]);
  });

  test("names the unknown ones once each", () => {
    expect(findUnknownVoicePlaceholders("{game} {game} {user}")).toEqual(["game", "user"]);
  });
});
