import type { Product } from "@/lib/types";

/** The client's image links for an app, from their intake form. */
export type AppImages = {
  icon: string | null;
  screenshots: string | null;
  banner: string | null;
  /** The client's own note about them. */
  note: string | null;
};

export function imagesOf(
  product:
    | Pick<Product, "icon_url" | "screenshots_url" | "feature_graphic_url" | "client_note">
    | undefined,
): AppImages | null {
  if (!product) return null;
  return {
    icon: product.icon_url,
    screenshots: product.screenshots_url,
    banner: product.feature_graphic_url,
    note: product.client_note,
  };
}
