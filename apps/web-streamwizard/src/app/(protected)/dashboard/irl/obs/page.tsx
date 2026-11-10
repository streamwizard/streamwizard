import { requireProductAccess } from "@/lib/require-product-access";
import { getMissingTwitchScopes } from "@/lib/twitch/twitch-scopes";
import { listIngestKeys } from "@/actions/irl/ingest-keys";
import { getAutoSwitcherConfig } from "@/actions/irl/auto-switcher";
import { CloudObsContent } from "@/components/irl/cloud-obs/cloud-obs-content";
import { getObsPullHost } from "@/lib/obs/obs-pull-host";

export default async function CloudObsPage() {
  const access = await requireProductAccess("cloud_obs");
  const [{ data: keys }, autoSwitcherConfig, obsPullHost, missingTwitchScopes] = await Promise.all([
    listIngestKeys(),
    getAutoSwitcherConfig(),
    getObsPullHost(),
    // The instance streams with the user's Twitch stream key, which sign-in
    // does not ask for; this page prompts for it when the token lacks it.
    getMissingTwitchScopes("cloud_obs"),
  ]);

  return (
    <CloudObsContent
      canInteract={access.canInteract}
      plan={access.plan}
      needsTwitchScopes={missingTwitchScopes.length > 0}
      initialIngestKeys={keys ?? []}
      obsPullHost={obsPullHost}
      autoSwitcherConfig={autoSwitcherConfig}
    />
  );
}
