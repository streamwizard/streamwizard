"use client";

import { useTransition } from "react";
import { KeyRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button } from "@repo/ui";
import { authorizeTwitchFeature } from "@/actions/auth/authorize-twitch";
import type { TwitchScopeFeature } from "@repo/schemas";

const COPY: Record<TwitchScopeFeature, { title: string; body: string }> = {
  cloud_obs: {
    title: "Cloud OBS needs your stream key",
    body: "Your cloud OBS goes live on your channel with your own Twitch stream key. Twitch only hands it over with your say-so, so this is a one-time Twitch round trip. Until then the instance starts without a key.",
  },
};

/**
 * Re-runs the Twitch authorization with the feature's scopes added and brings
 * the user back to `next`. Used by the banner, the cloud OBS setup step, and
 * the goal widgets ("base", for a token from before goals joined base).
 */
export function TwitchConnectButton({
  feature,
  next,
  disabled,
  size = "sm",
  className,
}: {
  feature: TwitchScopeFeature | "base";
  next: string;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size={size}
      className={className}
      disabled={disabled || pending}
      onClick={() => startTransition(() => authorizeTwitchFeature(feature, next))}
    >
      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
      {pending ? "Heading to Twitch…" : "Connect Twitch"}
    </Button>
  );
}

/**
 * Shown when a feature's Twitch scopes are missing from the stored token.
 */
export function TwitchScopeBanner({ feature, next }: { feature: TwitchScopeFeature; next: string }) {
  const { title, body } = COPY[feature];

  return (
    <Alert>
      <KeyRound className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{body}</span>
        <TwitchConnectButton feature={feature} next={next} className="shrink-0" />
      </AlertDescription>
    </Alert>
  );
}
