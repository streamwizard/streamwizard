import { walk, type Doc } from "@repo/cms";
import type { ResolvedImage } from "@/components/public/cms/cms-document";
import { env } from "@/lib/env";

// Where CMS images live on the CDN, and which ones a page needs.

export function cmsImageUrl(key: string): string {
  return `${env.NEXT_PUBLIC_CDN_URL.replace(/\/$/, "")}/${key}`;
}

/** Every image asset id in these documents. */
export function docAssetIds(docs: Doc[]): string[] {
  const ids = new Set<string>();
  for (const doc of docs) {
    walk(doc, (node) => {
      if (node.type === "image" && typeof node.attrs?.assetId === "string") ids.add(node.attrs.assetId);
    });
  }
  return [...ids];
}

export interface AssetRecord {
  key: string;
  width: number | null;
  height: number | null;
}

/** Resolves image nodes by asset id. Never trusts a src stored in the document. */
export function imageResolver(assets: Map<string, AssetRecord>) {
  return (attrs: Record<string, unknown>): ResolvedImage | null => {
    const asset = typeof attrs.assetId === "string" ? assets.get(attrs.assetId) : undefined;
    return asset ? { src: cmsImageUrl(asset.key), width: asset.width, height: asset.height } : null;
  };
}
