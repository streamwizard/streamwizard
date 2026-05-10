/**
 * Formats remaining milliseconds as a countdown string (day prefix when needed).
 */
export function formatCountdownMs(ms: number): string {
  if (ms <= 0) return "";
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  if (days > 0) {
    return `${days}d ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}
