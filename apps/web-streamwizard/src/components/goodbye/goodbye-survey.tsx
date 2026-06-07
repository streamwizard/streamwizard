"use client";

import { useState } from "react";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui";
import { Textarea } from "@repo/ui";
import { submitAccountDeletionFeedback } from "@/actions/supabase/user/account-deletion-feedback";
import type { Database } from "@repo/supabase/types/supabase";

type DeletionReason = Database["public"]["Enums"]["deletion_reason"];

const REASONS: {
  value: DeletionReason;
  label: string;
  subtext: string;
  meme: string;
  memeCaption: string;
  reaction: string;
}[] = [
  {
    value: "too_expensive",
    label: "Too expensive",
    subtext: "My wallet said no.",
    meme: "💸",
    memeCaption: "NOT STONKS",
    reaction: "My bank account watching my subscriptions",
  },
  {
    value: "missing_features",
    label: "Missing features",
    subtext: "It didn't do the thing I needed.",
    meme: "🥺",
    memeCaption: "COULD YOU... ADD THAT?",
    reaction: "Me submitting a feature request at 2am",
  },
  {
    value: "switching_to_another_tool",
    label: "Switching to another tool",
    subtext: "Found something else.",
    meme: "😔",
    memeCaption: "IT'S NOT ME IT'S YOU",
    reaction: "Me packing my clips and leaving",
  },
  {
    value: "just_taking_a_break",
    label: "Just taking a break",
    subtext: "Still a fan, just stepping away.",
    meme: "✋",
    memeCaption: "I'LL BE BACK",
    reaction: "Terminator energy. We respect it.",
  },
];

export default function GoodbyeSurvey() {
  const [selected, setSelected] = useState<DeletionReason | null>(null);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    await submitAccountDeletionFeedback(selected, comments || undefined);
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="text-8xl">🫡</div>
        <p className="text-2xl font-bold">Thanks for telling us.</p>
        <p className="text-muted-foreground">
          We read every single one of these. No, really.
        </p>
      </div>
    );
  }

  const activeReason = REASONS.find((r) => r.value === selected);

  return (
    <div className="space-y-8">
      {/* Meme reaction panel */}
      <div
        className={cn(
          "rounded-xl border-2 p-6 text-center transition-all duration-300",
          selected
            ? "border-primary bg-primary/5"
            : "border-dashed border-muted-foreground/30 bg-muted/20"
        )}
      >
        {selected && activeReason ? (
          <div className="space-y-2">
            <div className="text-7xl">{activeReason.meme}</div>
            <p
              className="text-xl font-black tracking-wide uppercase"
              style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}
            >
              {activeReason.memeCaption}
            </p>
            <p className="text-sm text-muted-foreground italic">
              {activeReason.reaction}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Pick a reason and watch the magic happen.
          </p>
        )}
      </div>

      {/* Reason cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REASONS.map((reason) => (
          <button
            key={reason.value}
            onClick={() => setSelected(reason.value)}
            className={cn(
              "rounded-lg border-2 p-4 text-left transition-all duration-200 hover:border-primary",
              selected === reason.value
                ? "border-primary bg-primary/10"
                : "border-border bg-card"
            )}
          >
            <p className="font-semibold">{reason.label}</p>
            <p className="text-sm text-muted-foreground">{reason.subtext}</p>
          </button>
        ))}
      </div>

      {/* Optional comments */}
      {selected && (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            Anything else? (optional — we actually read these)
          </label>
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Your chat had better suggestions anyway..."
            className="resize-none"
            rows={3}
            maxLength={500}
          />
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!selected || loading}
        className="w-full"
      >
        {loading ? "Sending..." : "Send feedback"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Or just close the tab. We get it.
      </p>
    </div>
  );
}
