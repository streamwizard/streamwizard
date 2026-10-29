// The mechanical half of docs/tone_of_voice.md: the things a writer can be
// told about without judging the writing. Pure; publishReadiness turns each
// finding into a warning.

const EM_DASH = /—/g;
const EXCLAMATION = /!/g;
// Two or more emoji in a row, spaces between them allowed.
const STACKED_EMOJI = /\p{Extended_Pictographic}️?(?:\s*\p{Extended_Pictographic}️?)+/u;

/** Marketing words the tone guide calls out, matched as whole words. */
export const FILLER_WORDS = [
  "seamless",
  "seamlessly",
  "cutting-edge",
  "unleash",
  "elevate",
  "leverage",
  "game-changer",
  "game-changing",
  "revolutionary",
  "empower",
  "supercharge",
] as const;

const FILLER = new RegExp(`(?<![\\p{L}-])(${FILLER_WORDS.join("|")})(?![\\p{L}-])`, "giu");

export interface ToneFinding {
  message: string;
}

function count(pattern: RegExp, texts: string[]): number {
  return texts.reduce((total, text) => total + (text.match(pattern)?.length ?? 0), 0);
}

/** Tone problems across every piece of text on the page. */
export function toneFindings(texts: string[]): ToneFinding[] {
  const findings: ToneFinding[] = [];

  const dashes = count(EM_DASH, texts);
  if (dashes > 0) {
    findings.push({
      message: `${dashes} em ${dashes === 1 ? "dash" : "dashes"}. They read as machine-written: use a period, comma, colon or brackets instead.`,
    });
  }

  const exclamations = count(EXCLAMATION, texts);
  if (exclamations > 1) {
    findings.push({ message: `${exclamations} exclamation marks. Keep it to one per page, if any.` });
  }

  if (texts.some((text) => STACKED_EMOJI.test(text))) {
    findings.push({ message: "Stacked emoji. One is plenty." });
  }

  const filler = new Set<string>();
  for (const text of texts) for (const match of text.matchAll(FILLER)) filler.add(match[1]!.toLowerCase());
  if (filler.size > 0) {
    const words = [...filler].map((word) => `“${word}”`).join(", ");
    findings.push({
      message: `${words} ${filler.size === 1 ? "reads" : "read"} like marketing filler. Say what it does instead.`,
    });
  }

  return findings;
}
