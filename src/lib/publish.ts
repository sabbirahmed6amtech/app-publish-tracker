import type { Client, Product } from "./types";

/**
 * Exactly what the "Play Console Publisher" extension fills in — the same
 * shape as its popup form (and the Node bot's publisher-data.json).
 */
export type PublishAppData = {
  appName: string;
  packageName: string;
  defaultLanguage: string;
  storeCategory: string;
  privacyUrl: string;
  deleteAccountUrl: string;
  accessInstructions: string;
  accessLoginEmail: string;
  accessLoginPassword: string;
  accessDetails: string;
  contactEmail: string;
  storeListingContactEmail: string;
  contactPhone: string;
  storeListingContactWebsite: string;
  shortDescription: string;
  longDescription: string;
};

export type PublishCheck = {
  label: string;
  /** Where it's edited: the app's listing or the client's Play details. */
  where: "app" | "client";
  ok: boolean;
  /** Required ones block the run; the rest are worth filling but optional. */
  required: boolean;
};

/** Builds the extension's input from a client and one of its Play apps. */
export function publishData(client: Client, product: Product): PublishAppData {
  const v = (x: string | null | undefined) => (x ?? "").trim();
  return {
    appName: v(product.app_name),
    packageName: v(product.package_name),
    defaultLanguage: v(client.play_default_language),
    storeCategory: v(product.play_category),
    privacyUrl: v(client.play_privacy_url),
    deleteAccountUrl: v(client.play_delete_account_url),
    accessInstructions: v(product.demo_instructions),
    accessLoginEmail: v(product.demo_login),
    accessLoginPassword: v(product.demo_password),
    accessDetails: v(product.demo_details),
    contactEmail: v(client.play_contact_email),
    storeListingContactEmail: v(client.play_listing_email || client.play_contact_email),
    contactPhone: v(client.play_contact_phone),
    storeListingContactWebsite: v(client.play_website),
    shortDescription: v(product.short_description),
    longDescription: v(product.long_description),
  };
}

/**
 * What's filled and what isn't, in the order the extension needs them. Play
 * requires the delete-account URL once users can sign in (Data safety won't
 * move on without it), so it blocks the run too.
 */
export function publishChecks(data: PublishAppData): PublishCheck[] {
  const has = (x: string) => x.length > 0;
  return [
    { label: "App name", where: "app", ok: has(data.appName), required: true },
    { label: "Package name", where: "app", ok: has(data.packageName), required: true },
    { label: "Privacy policy URL", where: "client", ok: has(data.privacyUrl), required: false },
    { label: "Store category", where: "app", ok: has(data.storeCategory), required: false },
    { label: "Default language", where: "client", ok: has(data.defaultLanguage), required: false },
    { label: "Delete-account URL", where: "client", ok: has(data.deleteAccountUrl), required: true },
    {
      label: "App Review demo login",
      where: "app",
      ok: has(data.accessLoginEmail) && has(data.accessLoginPassword),
      required: false,
    },
    { label: "Contact email", where: "client", ok: has(data.contactEmail), required: false },
    { label: "Short description", where: "app", ok: has(data.shortDescription), required: false },
    { label: "Full description", where: "app", ok: has(data.longDescription), required: false },
  ];
}

// ─────────────────────────────────────────────────────────── App Store ──

/** What the extension fills into App Store Connect for one App Store app. */
export type PublishAppDataIos = {
  platform: "app_store";
  appName: string;
  bundleId: string;
  sku: string;
  primaryLanguage: string;
  subtitle: string;
  primaryCategory: string;
  secondaryCategory: string;
  privacyUrl: string;
  supportUrl: string;
  marketingUrl: string;
  description: string;
  keywords: string;
  promoText: string;
  copyright: string;
  reviewFirstName: string;
  reviewLastName: string;
  reviewPhone: string;
  reviewEmail: string;
  demoLogin: string;
  demoPassword: string;
  reviewNotes: string;
};

/**
 * App Store Connect names languages its own way ("English (U.K.)"), so the
 * client's Play-style default ("English (United Kingdom) – en-GB") is mapped
 * for the common cases and otherwise reduced to its plain name.
 */
export function appStoreLanguage(playLanguage: string | null | undefined): string {
  const label = (playLanguage ?? "").trim();
  if (!label) return "English (U.S.)";
  const known: [RegExp, string][] = [
    [/^English \(United Kingdom\)/i, "English (U.K.)"],
    [/^English \(United States\)/i, "English (U.S.)"],
    [/^English \(Australia\)/i, "English (Australia)"],
    [/^Spanish \(Spain\)/i, "Spanish (Spain)"],
    [/^Spanish \(Latin America\)/i, "Spanish (Mexico)"],
    [/^Spanish \(United States\)/i, "Spanish (Mexico)"],
    [/^Portuguese \(Brazil\)/i, "Portuguese (Brazil)"],
    [/^French \(France\)/i, "French"],
  ];
  for (const [pattern, name] of known) if (pattern.test(label)) return name;
  return label.replace(/\s+[–-]\s+[\w-]+$/, ""); // "Turkish – tr-TR" → "Turkish"
}

export function publishDataIos(client: Client, product: Product): PublishAppDataIos {
  const v = (x: string | null | undefined) => (x ?? "").trim();
  const bundleId = v(product.package_name);
  return {
    platform: "app_store",
    appName: v(product.app_name),
    bundleId,
    // A common convention, and unique per account: the bundle ID itself.
    sku: v(product.ios_sku) || bundleId,
    primaryLanguage: appStoreLanguage(client.play_default_language),
    subtitle: v(product.ios_subtitle),
    primaryCategory: v(product.ios_primary_category),
    secondaryCategory: v(product.ios_secondary_category),
    privacyUrl: v(client.play_privacy_url),
    supportUrl: v(client.store_support_url),
    marketingUrl: v(client.store_marketing_url),
    description: v(product.long_description),
    keywords: v(product.ios_keywords),
    promoText: v(product.ios_promo_text),
    copyright: v(product.ios_copyright) || `© ${new Date().getFullYear()} ${client.name}`,
    reviewFirstName: v(client.review_contact_first_name),
    reviewLastName: v(client.review_contact_last_name),
    reviewPhone: v(client.review_contact_phone),
    reviewEmail: v(client.review_contact_email),
    demoLogin: v(product.demo_login),
    demoPassword: v(product.demo_password),
    reviewNotes: [v(product.demo_instructions), v(product.demo_details)]
      .filter(Boolean)
      .join("\n"),
  };
}

/** What's filled for App Store Connect, in the order it's used. */
export function publishChecksIos(data: PublishAppDataIos): PublishCheck[] {
  const has = (x: string) => x.length > 0;
  return [
    { label: "App name", where: "app", ok: has(data.appName), required: true },
    { label: "Bundle ID", where: "app", ok: has(data.bundleId), required: true },
    { label: "Subtitle", where: "app", ok: has(data.subtitle), required: false },
    { label: "Category", where: "app", ok: has(data.primaryCategory), required: false },
    { label: "Privacy policy URL", where: "client", ok: has(data.privacyUrl), required: false },
    { label: "Support URL", where: "client", ok: has(data.supportUrl), required: false },
    { label: "Description", where: "app", ok: has(data.description), required: false },
    { label: "Keywords", where: "app", ok: has(data.keywords), required: false },
    {
      label: "App Review contact",
      where: "client",
      ok:
        has(data.reviewFirstName) &&
        has(data.reviewLastName) &&
        has(data.reviewPhone) &&
        has(data.reviewEmail),
      required: false,
    },
    {
      label: "App Review demo login",
      where: "app",
      ok: has(data.demoLogin) && has(data.demoPassword),
      required: false,
    },
  ];
}
