import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { getIrlSubscriberToken, listIrlTokens } from "@/actions/irl-tokens";
import { requireProductAccess } from "@/lib/require-product-access";
import { IrlLiveMap } from "@/components/irl/irl-live-map";
import { IrlTokensSection } from "@/components/irl/irl-tokens-section";
import { FeatureDisabledBanner } from "@/components/ui/feature-disabled-banner";
import { env } from "@/lib/env";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui";

export default async function IrlGpsPage() {
  const access = await requireProductAccess("cloud_obs");

  const [{ data: tokens }, { data: subscriberToken }] = await Promise.all([
    listIrlTokens(),
    getIrlSubscriberToken(),
  ]);

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/dashboard/irl/obs"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Cloud OBS
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">GPS &amp; location</h1>
        <p className="text-muted-foreground text-sm">
          Connect a phone to send live location to your overlays while you&apos;re out streaming.
        </p>
      </div>

      {!access.canInteract && <FeatureDisabledBanner />}

      <Alert>
        <BookOpen className="h-4 w-4" />
        <AlertTitle>New to GPS overlays?</AlertTitle>
        <AlertDescription>
          {env.NEXT_PUBLIC_DOCS_URL ? (
            <>
              <a
                href={env.NEXT_PUBLIC_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-medium underline underline-offset-2"
              >
                Read the docs
              </a>{" "}
              to connect a phone and get your location on stream.
            </>
          ) : (
            "Check the docs to connect a phone and get your location on stream."
          )}
        </AlertDescription>
      </Alert>

      {subscriberToken && (
        <Card>
          <CardHeader>
            <CardTitle>Live location</CardTitle>
            <CardDescription>Where your device last reported from.</CardDescription>
          </CardHeader>
          <CardContent>
            <IrlLiveMap subscriberToken={subscriberToken} />
          </CardContent>
        </Card>
      )}

      <IrlTokensSection initialTokens={tokens ?? []} canInteract={access.canInteract} />
    </div>
  );
}
