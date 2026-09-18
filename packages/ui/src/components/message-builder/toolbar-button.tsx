"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { DISCORD } from "./discord-styles";

interface ToolbarButtonProps extends React.ComponentProps<"button"> {
  /** Accessible name and tooltip. */
  label: string;
  tone?: "default" | "danger";
}

/** The small dark buttons that appear on an element: Discord's own hover toolbar look. */
export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
  { label, tone = "default", className, children, style, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border border-black/30 text-[#b5bac1] shadow-sm transition-colors",
        "hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5865f2]",
        "disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4",
        tone === "danger" && "hover:bg-[#da373c] hover:text-white",
        className,
      )}
      style={{ backgroundColor: DISCORD.control, ...style }}
      {...props}
    >
      {children}
    </button>
  );
});
