import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Files on disk under UPLOAD_DIR (default ./uploads):
 *   jks/    keystore files — private, downloaded only by signed-in team members
 *   logos/  product-line logos — public, shown on the tracker and the client form
 * Paths stored in the database are relative to their folder.
 */
export type UploadKind = "jks" | "logos";

const ROOT = path.resolve(process.env.UPLOAD_DIR || "./uploads");

/** The absolute path of a stored file; refuses anything that leaves its folder. */
export function uploadPath(kind: UploadKind, relative: string): string {
  const base = path.join(ROOT, kind);
  const full = path.resolve(base, relative);
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error("Bad file path.");
  return full;
}

/** A file name safe to keep on disk. */
export const safeFileName = (name: string) => name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";

export async function saveUpload(kind: UploadKind, relative: string, file: File): Promise<void> {
  const full = uploadPath(kind, relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
}

export async function readUpload(kind: UploadKind, relative: string): Promise<Buffer | null> {
  try {
    return await readFile(uploadPath(kind, relative));
  } catch {
    return null;
  }
}

/** Remove a stored file; a file that's already gone is fine. */
export async function removeUpload(kind: UploadKind, relative: string | null | undefined) {
  if (!relative) return;
  try {
    await rm(uploadPath(kind, relative), { force: true });
  } catch {
    // Not worth failing the action over.
  }
}

/** The public address of a product-line logo. */
export const logoUrl = (logoPath: string | null) =>
  logoPath ? `/uploads/logos/${logoPath.split("/").map(encodeURIComponent).join("/")}` : null;
