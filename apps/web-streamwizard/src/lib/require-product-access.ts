import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";
import { getProductAccess, type ProductAccess } from "@repo/supabase/queries/subscriptions";
import { track } from "@/lib/track";

export type { ProductAccess };

export async function requireProductAccess(productId: string): Promise<ProductAccess> {
  const supabase = await createClient();
  const access = await getProductAccess(supabase, productId);
  if (!access.canAccess) {
    // Someone wanted a paid product and hit the wall: the one signal of
    // demand that exists before there is a checkout. A link prefetch renders
    // this too, and a link scrolling into view is not someone wanting it.
    const isPrefetch = (await headers()).has("next-router-prefetch");
    if (!isPrefetch) await track("product_gate_hit", { product: productId });
    redirect(`/dashboard/upgrade?feature=${productId}`);
  }
  return access;
}
