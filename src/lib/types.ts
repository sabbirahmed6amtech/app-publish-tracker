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
