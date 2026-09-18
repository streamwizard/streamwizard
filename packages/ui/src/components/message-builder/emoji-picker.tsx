"use client";

import { useState } from "react";
import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../../lib/utils";
import { ToolbarButton } from "./toolbar-button";

// A short, offline list on purpose: a full picker pulls its data from a CDN,
// which the dashboard's CSP blocks. Anything else can be typed or pasted, the
// OS emoji keyboard works in every field.
const EMOJI: [string, string][] = [
  ["Faces", "😀 😄 😁 😂 🙂 😉 😊 😍 😎 🤩 🥳 🤔 😅 😭 😴 🤯 😇 😈 🤖 👻 💀 👀"],
  ["Hands", "👋 👍 👎 👏 🙌 🙏 💪 🤝 ✌️ 🤞 👉 👈 👆 👇 ☝️ ✋ 🫶 🫡"],
  ["Hearts", "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💯 ✨ ⭐ 🌟 🔥 ⚡ 🎉 🎊 🎁"],
  ["Server", "📌 📢 📣 🔔 🔗 📜 📋 📝 ✅ ❌ ⚠️ ⛔ 🚫 ❓ ❗ 🛡️ 👑 🔨 🔒 🔑 🎫 🏷️ 💬 🗨️"],
  ["Stream", "🎮 🕹️ 🎧 🎤 🎬 📺 📷 🎥 💻 🖥️ ⌨️ 🖱️ 🎵 🎶 🏆 🥇 🎯 🎲 🚀 🟣 🔴 🟢"],
  ["Numbers", "1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 ➡️ ⬅️ ⬆️ ⬇️ ▶️ ➕ ➖ •"],
  ["Nature", "🌸 🌙 ☀️ 🌈 ☁️ 🌧️ ❄️ 🌊 🌴 🍀 🐱 🐶 🦊 🐸 🐼 🦄 🍕 🍔 ☕ 🍺 🍪 🎂"],
];

export function EmojiPicker({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton label="Add an emoji" disabled={disabled}>
          <Smile />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 p-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Emoji groups">
          {EMOJI.map(([name], i) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={cn(
                "rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                tab === i && "bg-accent text-accent-foreground",
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-0.5" role="tabpanel">
          {(EMOJI[tab]?.[1] ?? "").split(" ").map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={emoji}
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
              className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-accent"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
