"use client";

import { Check } from "lucide-react";
import { BANNER_RECOMMENDED_SIZE, themesByCategory } from "@repo/discord-message";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import type { BuilderTheme } from "./types";

interface ThemePanelProps {
  themes: BuilderTheme[];
  selectedId: string;
  disabled?: boolean;
  onSelect: (theme: BuilderTheme) => void;
  onLockedClick?: (theme: BuilderTheme) => void;
}

const { width, height } = BANNER_RECOMMENDED_SIZE;

export function ThemePanel({ themes, selectedId, disabled, onSelect, onLockedClick }: ThemePanelProps) {
  const groups = themesByCategory(themes) as [string, BuilderTheme[]][];

  return (
    <section aria-labelledby="message-builder-themes" className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h3 id="message-builder-themes" className="text-sm font-semibold">
          Choose your theme
        </h3>
        <p className="text-xs text-muted-foreground">Restyles every banner at once. You can still swap single banners after.</p>
      </div>
      <ScrollArea className="h-[28rem]">
        <div className="space-y-4 p-4">
          {groups.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{category}</h4>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {items.map((theme) => {
                  const selected = theme.id === selectedId;
                  return (
                    <li key={theme.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        aria-label={`${theme.name} theme${theme.animated ? ", animated" : ""}${theme.locked ? `, ${theme.locked}` : ""}`}
                        onClick={() => (theme.locked ? onLockedClick?.(theme) : onSelect(theme))}
                        className={cn(
                          "relative block w-full overflow-hidden rounded-md border-2 border-transparent outline-none transition-[border-color,transform]",
                          "hover:border-primary/60 focus-visible:border-ring active:scale-[0.98] disabled:opacity-60",
                          selected && "border-primary",
                        )}
                        style={{ aspectRatio: `${width} / ${height}` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- bundled theme art */}
                        <img src={theme.imageUrl} alt="" loading="lazy" className={cn("size-full object-cover", theme.locked && "opacity-60")} />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-left text-xs font-medium text-white">
                          {theme.name}
                        </span>
                        <span className="absolute right-1.5 top-1.5 flex gap-1">
                          {theme.animated && <Badge className="bg-black/70 px-1.5 text-[10px] text-white">GIF</Badge>}
                          {theme.locked && <Badge variant="secondary" className="px-1.5 text-[10px]">{theme.locked}</Badge>}
                        </span>
                        {selected && (
                          <span className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}
