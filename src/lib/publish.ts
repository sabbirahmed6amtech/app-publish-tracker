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
