"use client";

import type { CSSProperties } from "react";
import type { AdWidgetItemConfig } from "../ad-widget-config";
import type { AdPhase, AdPhaseView } from "../ad-widget-state";

export {
  FitSvgText,
  FitText,
  GOAL_KEYFRAMES,
  capRadius,
  hexToRgba,
  textStyle,
} from "../../goal/presets/shared";

export interface AdPresetProps {
  view: AdPhaseView;
  cfg: AdWidgetItemConfig;
}

/** The countdown ticks once a second; the drain follows it linearly. */
export const DRAIN_TRANSITION = "1000ms linear";

/**
 * Ad-only keyframes, on top of the goal ones (entrances and the
 * reduced-motion rule for `.sw-goal-motion`).
 */
export const AD_KEYFRAMES = `
@keyframes sw-ad-swap {
  from { opacity: 0; transform: translateY(0.35em) }
  to { opacity: 1; transform: none }
}
@keyframes sw-ad-urgent {
  0%, 100% { box-shadow: 0 0 0 2px var(--sw-ad-accent), 0 0 0 0 var(--sw-ad-accent) }
  50% { box-shadow: 0 0 0 2px var(--sw-ad-accent), 0 0 16px 2px var(--sw-ad-accent) }
}
`;

/** Phase-to-phase change inside a design that stays on screen: the new content rises in. */
export const SWAP_ANIMATION = "sw-ad-swap 320ms cubic-bezier(0.2, 0.7, 0.2, 1) both";

/** The last seconds before an ad: the accent pulses so the heads-up is hard to miss. */
export function urgentStyle(view: AdPhaseView, cfg: AdWidgetItemConfig): CSSProperties {
  if (view.phase !== "warning" || view.secondsLeft > 10) return {};
  return { "--sw-ad-accent": cfg.accentColor, animation: "sw-ad-urgent 1000ms ease-in-out infinite" } as CSSProperties;
}

/** Dark or light text, whichever reads on `hex` (WCAG relative luminance). */
export function inkOn(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
  return lum > 0.4 ? "#0b0b12" : "#ffffff";
}

/** The short name of each phase, for designs that show the time on its own. */
export function phaseLabel(view: AdPhaseView, cfg: AdWidgetItemConfig): string {
  if (view.phase === "warning") return "Ads coming up";
  if (view.phase === "running") return "Ad break";
  return cfg.backText;
}

/** A clock before the ads, a play mark while they run, a heart after. */
export function AdIcon({ phase, size, color }: { phase: AdPhase; size: number; color: string }) {
  const style: CSSProperties = { width: size, height: size, flexShrink: 0, display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))" };
  if (phase === "running") {
    return (
      <svg viewBox="0 0 24 24" style={style} aria-hidden>
        <rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke={color} strokeWidth="2" />
        <path d="M10 9.2v5.6l4.8-2.8z" fill={color} />
      </svg>
    );
  }
  if (phase === "back") {
    return (
      <svg viewBox="0 0 24 24" style={style} aria-hidden>
        <path
          d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4.8-1.3 2.3-2.4 4.4-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"
          fill={color}
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" style={style} aria-hidden>
      <circle cx="12" cy="13" r="8" fill="none" stroke={color} strokeWidth="2" />
      <path d="M12 9v4.2l2.6 1.6M9.5 2.5h5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
