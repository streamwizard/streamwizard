import { describe, expect, test } from "bun:test";
import { renderTranscriptText, transcriptFileName } from "./transcript-file";

const ticket = {
  ticket_number: 42,
  subject: "OBS won't connect",
  opener_name: "Alice",
  created_at: "2026-09-18T10:00:00.000Z",
  closed_at: "2026-09-18T11:30:00.000Z",
  closed_by_name: "Bob",
  close_reason: "Fixed in the latest update",
};

const base = { author_is_bot: false, embeds: [], attachments: [], edited_at: null };

describe("renderTranscriptText", () => {
  test("header, then every message with its marks, files and embeds", () => {
    const text = renderTranscriptText(
      ticket,
      [
        { ...base, author_name: "Alice", content: "hello\nsecond line", created_at: "2026-09-18T10:01:00.000Z" },
        {
          ...base,
          author_name: "Bob",
          content: "",
          created_at: "2026-09-18T10:02:00.000Z",
          edited_at: "2026-09-18T10:03:00.000Z",
          attachments: [{ name: "shot.png", size: 120_000, url: "https://cdn/x.png" }],
        },
        {
          ...base,
          author_name: "StreamWizard",
          author_is_bot: true,
          content: "",
          created_at: "2026-09-18T10:04:00.000Z",
          embeds: [{ author: { name: "Bob (via dashboard)" }, description: "Try again now" }],
        },
        { ...base, author_name: "Alice", content: "oops", created_at: "2026-09-18T10:05:00.000Z", deleted_at: "2026-09-18T10:06:00.000Z", pinned: true },
      ],
      { serverName: "StreamWizard", categoryName: "Bug" },
    );

    expect(text).toBe(
      [
        "Ticket #0042 · Bug · StreamWizard",
        "Subject: OBS won't connect",
        "Opened by Alice on 2026-09-18 10:00 UTC",
        "Closed by Bob on 2026-09-18 11:30 UTC: Fixed in the latest update",
        "Messages: 4",
        "",
        "[2026-09-18 10:01 UTC] Alice:",
        "    hello",
        "    second line",
        "",
        "[2026-09-18 10:02 UTC] Bob (edited):",
        "    attachment: shot.png (117 KB) https://cdn/x.png",
        "",
        "[2026-09-18 10:04 UTC] StreamWizard (bot):",
        "    | Bob (via dashboard)",
        "    | Try again now",
        "",
        "[2026-09-18 10:05 UTC] Alice (pinned, deleted):",
        "    oops",
        "",
      ].join("\n"),
    );
  });

  test("an open ticket has no closed line; unknown opener is named as such", () => {
    const text = renderTranscriptText({ ...ticket, opener_name: null, closed_at: null }, [], { serverName: "S", categoryName: "C" });
    expect(text).toContain("Opened by unknown on");
    expect(text).not.toContain("Closed");
    expect(text.endsWith("Messages: 0\n")).toBe(true);
  });

  test("file name carries the padded number", () => {
    expect(transcriptFileName(7)).toBe("ticket-0007.txt");
  });
});
