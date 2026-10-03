import type { Platform, Product } from "@/lib/types";

/** What Store Watch last saw on the app's store page. */
export type StoreInfo = {
  live: boolean | null;
  version: string | null;
  updatedAt: string | null;
  checkedAt: string | null;
  error: string | null;
  url: string | null;
};

export function storeInfoOf(
  product:
    | Pick<
        Product,
        "store_live" | "store_version" | "store_updated_at" | "store_checked_at" | "store_error" | "store_url"
      >
    | undefined,
): StoreInfo | null {
  if (!product) return null;
  return {
    live: product.store_live,
    version: product.store_version,
    updatedAt: product.store_updated_at,
    checkedAt: product.store_checked_at,
    error: product.store_error,
    url: product.store_url,
  };
}

/**
 * The version the store should show for this submission: the build name
 * ("1.0.7" of "1.0.7+10"), else the release's version.
 */
export function expectedVersion(buildVersion: string | null, releaseVersion: string | null): string {
  return (buildVersion?.split("+")[0] || releaseVersion || "").trim();
}

/**
 * The store already has this submission live, but the tracker doesn't say so
 * yet — the developer should move it to Production. Nothing moves on its own.
 */
export function liveButNotMoved(
  store: StoreInfo | null,
  status: string,
  buildVersion: string | null,
  releaseVersion: string | null,
): boolean {
  if (!store?.live || status === "production") return false;
  const want = expectedVersion(buildVersion, releaseVersion);
  return !!want && store.version?.trim() === want;
}

export const STORE_NAME: Record<Platform, string> = {
  play_store: "Google Play",
  app_store: "the App Store",
};
