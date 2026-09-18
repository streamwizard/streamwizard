// Discord's dark theme, hard-coded on purpose: the preview has to look like
// Discord whatever theme the dashboard around it is in.
export const DISCORD = {
  chat: "#313338",
  embed: "#2b2d31",
  text: "#dbdee1",
  heading: "#f2f3f5",
  muted: "#949ba4",
  link: "#00a8fc",
  blurple: "#5865f2",
  code: "#1e1f22",
  control: "#1e1f22",
  font: '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;

export const toHex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;
export const fromHex = (hex: string): number => Number.parseInt(hex.replace("#", ""), 16) || 0;
