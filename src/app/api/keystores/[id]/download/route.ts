import { getSession } from "@/lib/auth";
import { row } from "@/lib/db";
import { readUpload } from "@/lib/uploads";

/** A keystore file, for signed-in team members only, under its original name. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  const keystore = await row<{ file_path: string | null; file_name: string | null }>(
    "SELECT file_path, file_name FROM keystores WHERE id = ?",
    [id],
  );
  if (!keystore?.file_path) return new Response("This keystore has no file.", { status: 404 });
  const file = await readUpload("jks", keystore.file_path);
  if (!file) return new Response("The file is missing on the server.", { status: 404 });
  const name = (keystore.file_name || "keystore.jks").replace(/["\r\n]/g, "");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
