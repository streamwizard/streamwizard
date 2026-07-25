import { requireProductAccess } from "@/lib/require-product-access";
import { getObsBetaFeedback } from "@/actions/supabase/obs-beta-feedback";
import { BetaTestContent } from "./_beta-test-content";

export default async function BetaTestPage() {
  const access = await requireProductAccess("cloud_obs");
  const feedback = await getObsBetaFeedback();

  return <BetaTestContent canInteract={access.canInteract} initial={feedback} />;
}
