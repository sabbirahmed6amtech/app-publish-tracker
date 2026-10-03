import { timingSafeEqual } from "node:crypto";
import { runStoreWatch } from "@/lib/storeWatchRun";

// Store checks take a while (one app at a time, gently).
export const maxDuration = 300;

/**
 * The hourly Store Watch run, called by the server's cron:
 *   curl -X POST -H "x-store-watch-key: $STORE_WATCH_KEY" https://<site>/api/store-watch
 */
export async function POST(req: Request) {
  const expected = process.env.STORE_WATCH_KEY ?? "";
  const given = req.headers.get("x-store-watch-key") ?? "";
  const ok =
    expected.length > 0 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return Response.json({ error: "Not allowed." }, { status: 401 });

  const results = await runStoreWatch();
  return Response.json({ checked: results.length, results });
}
