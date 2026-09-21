"use client";

import { ExternalLink, ImageOff } from "lucide-react";
import { ANNOUNCEMENT_VARIABLES, type Announcement } from "@repo/discord-message";
import { DISCORD, DiscordMessageFrame, RichTextView, toHex } from "@repo/ui/message-builder";
import type { PickerOption } from "@/lib/discord/options";

interface AnnouncementPreviewProps {
  announcement: Announcement;
  roles: PickerOption[];
  bot: { name: string; avatarUrl?: string | null };
  /** Origins the dashboard may load images from (its CSP). Anything else gets a placeholder. */
  imageHosts: string[];
}

function MentionPill({ text, color }: { text: string; color?: string }) {
  // Discord tints a role mention with the role's colour; @everyone and @here are blurple.
  const base = color ?? DISCORD.blurple;
  return (
    <span className="rounded-[3px] px-0.5 font-medium" style={{ backgroundColor: `${base}4d`, color: color ?? "#c9cdfb" }}>
      {text}
    </span>
  );
}

/** What the announcement looks like in Discord, as close as a dashboard gets. Read-only. */
export function AnnouncementPreview({ announcement, roles, bot, imageHosts }: AnnouncementPreviewProps) {
  const { title, body, color, imageUrl, button, mention } = announcement;
  const role = mention.kind === "role" ? roles.find((r) => r.value === mention.roleId) : undefined;
  const canShowImage = imageUrl !== null && imageHosts.some((host) => imageUrl.startsWith(host.replace(/\/$/, "") + "/"));
  const empty = !title.trim() && !body.trim();

  return (
    <DiscordMessageFrame bot={bot}>
      {mention.kind !== "none" && (
        <p className="mb-1 leading-[1.375]">
          {mention.kind === "everyone" && <MentionPill text="@everyone" />}
          {mention.kind === "here" && <MentionPill text="@here" />}
          {mention.kind === "role" && <MentionPill text={`@${role?.label ?? "deleted-role"}`} color={role?.color} />}
        </p>
      )}

      <div
        className="max-w-[520px] rounded-[4px] border-l-4 py-2 pl-3 pr-4 text-sm"
        style={{ backgroundColor: DISCORD.embed, borderLeftColor: toHex(color), color: DISCORD.text }}
      >
        {title.trim() && (
          <p className="mt-1 text-base font-semibold leading-[1.375]" style={{ color: DISCORD.heading }}>
            <RichTextView text={title} variables={ANNOUNCEMENT_VARIABLES} />
          </p>
        )}
        {body.trim() && (
          <div className="mt-1 whitespace-pre-wrap leading-[1.375]">
            <RichTextView text={body} variables={ANNOUNCEMENT_VARIABLES} />
          </div>
        )}
        {empty && (
          <p className="py-1 leading-[1.375]" style={{ color: DISCORD.muted }}>
            Your announcement shows up here as you type.
          </p>
        )}
        {imageUrl &&
          (canShowImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- the admin's own image, shown as Discord would
            <img src={imageUrl} alt="" className="mt-3 max-h-80 w-auto max-w-full rounded-[4px] object-contain" />
          ) : (
            <div
              className="mt-3 flex items-center gap-2 rounded-[4px] px-3 py-2 text-xs"
              style={{ backgroundColor: DISCORD.code, color: DISCORD.muted }}
            >
              <ImageOff className="size-3.5 shrink-0" />
              Discord shows this image. The preview can&apos;t load it from that site.
            </div>
          ))}
      </div>

      {button && (button.label.trim() || button.url.trim()) && (
        <div className="mt-2">
          <span
            className="inline-flex h-8 items-center gap-1.5 rounded-[3px] px-4 text-sm font-medium"
            style={{ backgroundColor: "#4e5058", color: "#ffffff" }}
          >
            {button.label.trim() || "Button"}
            <ExternalLink className="size-3.5" />
          </span>
        </div>
      )}
    </DiscordMessageFrame>
  );
}
