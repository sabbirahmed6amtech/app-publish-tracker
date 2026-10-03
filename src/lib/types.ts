export type Platform = "play_store" | "app_store";
export type AccountType = "organization" | "personal";
export type AppStatus =
  | "ongoing"
  | "in_review"
  | "closed_testing"
  | "rejected"
  | "production"
  | "on_hold";

/** Someone work can be assigned to. Synced from Supabase Auth users. */
export type TeamMember = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  ticket: string;
  name: string;
  note: string | null;
  archived: boolean;
  /** Play Console details shared by every app of this client. */
  play_privacy_url: string | null;
  play_delete_account_url: string | null;
  play_contact_email: string | null;
  play_listing_email: string | null;
  play_contact_phone: string | null;
  play_website: string | null;
  play_default_language: string | null;
  /** App Store Connect details shared by every App Store app of this client. */
  store_support_url: string | null;
  store_marketing_url: string | null;
  review_contact_first_name: string | null;
  review_contact_last_name: string | null;
  review_contact_phone: string | null;
  review_contact_email: string | null;
  created_at: string;
  updated_at: string;
};

export type PublisherAccount = {
  id: string;
  client_id: string;
  platform: Platform;
  account_name: string;
  account_type: AccountType;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** A product the team sells (6amMart, StackFood …), with its projects and logo. */
export type ProductLine = {
  id: string;
  name: string;
  logo_path: string | null;
  /** Public URL of the logo, resolved on the server. */
  logo_url: string | null;
  sort_order: number;
  projects: string[];
};

/** What an app shows for its product line: the line's name and logo. */
export type LineBadge = { line: string; logo: string | null };

/** One of a client's permanent apps — set up once, submitted every release. */
export type Product = {
  id: string;
  client_id: string;
  account_id: string;
  project_name: string;
  app_name: string;
  keystore_id: string | null;
  store_url: string | null;
  note: string | null;
  sort_order: number;
  archived: boolean;
  /** What Play Console needs for this app. */
  package_name: string | null;
  play_category: string | null;
  short_description: string | null;
  long_description: string | null;
  demo_instructions: string | null;
  demo_login: string | null;
  demo_password: string | null;
  demo_details: string | null;
  /** App Store Connect listing; package_name holds the bundle ID. */
  ios_sku: string | null;
  ios_subtitle: string | null;
  ios_keywords: string | null;
  ios_promo_text: string | null;
  ios_primary_category: string | null;
  ios_secondary_category: string | null;
  ios_copyright: string | null;
  created_at: string;
  updated_at: string;
};

/** The signing keystore a client's apps share. */
export type Keystore = {
  id: string;
  client_id: string;
  name: string;
  details: string | null;
  file_path: string | null;
  file_name: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** One versioned release for one client. */
export type Release = {
  id: string;
  client_id: string;
  version: string;
  title: string | null;
  assigned_to: string | null;
  note: string | null;
  started_on: string;
  released_on: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * One submission of a product in one release. The identity fields (project,
 * app name, account, keystore, store link) mirror the product.
 */
export type App = {
  id: string;
  release_id: string;
  product_id: string;
  account_id: string;
  project_name: string;
  app_name: string;
  status: AppStatus;
  assigned_to: string | null;
  build_version: string | null;
  flutter_version: string | null;
  keystore_id: string | null;
  /** Legacy — superseded by keystore_id. */
  jks: string | null;
  store_url: string | null;
  note: string | null;
  sort_order: number;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
};

export type AppEvent = {
  id: string;
  app_id: string;
  kind: string;
  from_status: AppStatus | null;
  to_status: AppStatus | null;
  message: string | null;
  actor: string | null;
  created_at: string;
};

export type ReleaseWithApps = Release & { apps: App[] };

export type ClientFull = Client & {
  publisher_accounts: PublisherAccount[];
  keystores: Keystore[];
  products: Product[];
  releases: ReleaseWithApps[];
};

/** One flattened row per app — everything about it, for the sheet view. */
export type AppRow = App & {
  client_id: string;
  ticket: string;
  client_name: string;
  release_version: string;
  release_title: string | null;
  release_note: string | null;
  /** Resolved display names, so tables and CSV do not each re-join. */
  assignee_name: string | null;
  release_assignee_name: string | null;
  platform: Platform;
  account_name: string;
  account_type: AccountType;
};

/** A release's state, derived from its apps rather than stored. */
export type ReleaseState =
  | "empty"
  | "in_progress"
  | "attention"
  | "waiting"
  | "complete";
