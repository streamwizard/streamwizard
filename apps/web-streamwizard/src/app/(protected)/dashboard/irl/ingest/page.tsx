import { listIngestKeys } from "@/actions/ingest-keys";
import { listOutputKeys } from "@/actions/ingest-output-keys";
import { getIrlSubscriberToken, listIrlTokens } from "@/actions/irl-tokens";
import { IngestKeysSection } from "@/components/irl/ingest-keys-section";
import { IngestOutputKeysSection } from "@/components/irl/ingest-output-keys-section";
import { IngestLiveStats } from "@/components/irl/ingest-live-stats";
import { IrlLiveMap } from "@/components/irl/irl-live-map";
import { IrlTokensSection } from "@/components/irl/irl-tokens-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";

export default async function IrlIngestPage() {
  const [{ data: keys }, { data: outputKeys }, { data: tokens }, { data: subscriberToken }] =
    await Promise.all([listIngestKeys(), listOutputKeys(), listIrlTokens(), getIrlSubscriberToken()]);
  const ingestHost = process.env.NEXT_PUBLIC_INGEST_HOST ?? "your-stream-server";
  const obsPullHost = process.env.NEXT_PUBLIC_OBS_PULL_HOST ?? "your-ingest-tailscale-ip";
  const activeStreamKeyId = keys?.[0]?.id ?? null;

  return (
    <div className="w-full max-w-2xl space-y-6">
      <IngestLiveStats />
      <IngestKeysSection initialKeys={keys ?? []} ingestHost={ingestHost} />
      <IngestOutputKeysSection
        initialKeys={outputKeys ?? []}
        streamKeyId={activeStreamKeyId}
        obsPullHost={obsPullHost}
      />

      {subscriberToken && (
        <Card>
          <CardHeader>
            <CardTitle>Live location</CardTitle>
            <CardDescription>Where your IRL device last reported from.</CardDescription>
          </CardHeader>
          <CardContent>
            <IrlLiveMap subscriberToken={subscriberToken} />
          </CardContent>
        </Card>
      )}
      <IrlTokensSection initialTokens={tokens ?? []} />
    </div>
  );
}
