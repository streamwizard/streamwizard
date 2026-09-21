"use client";

import { useMemo } from "react";
import { DISCORD } from "./discord-styles";

export interface DiscordMessageFrameProps {
  /** Who the message is from. */
  bot: { name: string; avatarUrl?: string | null };
  children: React.ReactNode;
}

/** One message in Discord's dark chat: avatar, the bot's name and tag, a time, and whatever the message holds. */
export function DiscordMessageFrame({ bot, children }: DiscordMessageFrameProps) {
  const time = useMemo(() => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), []);

  return (
    <div
      className="relative rounded-lg py-4 pl-14 pr-10 text-[15px] sm:pl-[72px] sm:pr-12"
      style={{ backgroundColor: DISCORD.chat, color: DISCORD.text, fontFamily: DISCORD.font }}
    >
      {bot.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Discord avatar
        <img src={bot.avatarUrl} alt="" className="absolute left-2 top-4 size-8 rounded-full sm:left-4 sm:size-10" />
      ) : (
        <div
          className="absolute left-2 top-4 flex size-8 items-center justify-center rounded-full text-base font-semibold text-white sm:left-4 sm:size-10"
          style={{ backgroundColor: DISCORD.blurple }}
        >
          {bot.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="mb-1 flex flex-wrap items-center gap-x-1.5 leading-[1.375]">
        <span className="font-medium" style={{ color: DISCORD.heading }}>
          {bot.name}
        </span>
        <span className="rounded-[4px] px-1 text-[10px] font-semibold uppercase leading-[15px] text-white" style={{ backgroundColor: DISCORD.blurple }}>
          Bot
        </span>
        <span className="text-xs" style={{ color: DISCORD.muted }} suppressHydrationWarning>
          Today at {time}
        </span>
      </div>
      {children}
    </div>
  );
}
