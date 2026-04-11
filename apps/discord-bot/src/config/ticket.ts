// Emoji and color maps for ticket categories and priorities
export const CATEGORY_CONFIG = {
  bug: { emoji: "🐛", label: "Bug Report", color: 0xef4444 },
  feature: { emoji: "✨", label: "Feature Request", color: 0x8b5cf6 },
  general: { emoji: "💬", label: "General", color: 0x3b82f6 },
} as const;

export const PRIORITY_CONFIG = {
  low: { emoji: "🟢", label: "Low" },
  medium: { emoji: "🟡", label: "Medium" },
  high: { emoji: "🟠", label: "High" },
  critical: { emoji: "🔴", label: "Critical" },
} as const;
