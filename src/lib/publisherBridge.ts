"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublishAppData, PublishAppDataIos } from "./publish";

/**
 * Talks to the "Play Console Publisher" Chrome extension.
 *
 * A web page can't drive another site's tab, so the extension does the
 * filling. Its small "bridge" content script runs on this page and relays
 * window.postMessage traffic to and from its background worker — which means
 * the page never needs the extension's id (an unpacked extension gets a
 * different one on every machine).
 *
 *   page → extension   { source: "publish-tracker", type: HELLO | GET_STATE | START | CONTINUE | STOP | RESET }
 *   extension → page   { source: "play-publisher",  type: READY | STATE | RESULT | GONE }
 */

const PAGE = "publish-tracker";
const EXTENSION = "play-publisher";

export type PublisherStep = {
  name: string;
  status: "pending" | "running" | "done" | "failed";
  error?: string;
};

export type PublisherState = {
  phase: "idle" | "starting" | "running" | "paused" | "done";
  appData: { appName?: string; packageName?: string } | null;
  steps: PublisherStep[];
  logs: { type: string; msg: string; at: number }[];
  pauseMessage: string;
  /** Which tracker app started the run, so other apps don't show its progress. */
  jobId?: string | null;
};

type Inbound =
  | { source: typeof EXTENSION; type: "READY"; version: string }
  | { source: typeof EXTENSION; type: "STATE"; state: PublisherState }
  | { source: typeof EXTENSION; type: "RESULT"; requestId: string; ok: boolean; error?: string }
  | { source: typeof EXTENSION; type: "GONE" };

export type Bridge = {
  /** null while still checking; false when the extension isn't installed. */
  installed: boolean | null;
  /** The extension was reloaded or updated since this page loaded. */
  stale: boolean;
  version: string | null;
  state: PublisherState | null;
  start: (job: {
    jobId: string;
    appData: PublishAppData | PublishAppDataIos;
    expectedAccount: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  send: (type: "CONTINUE" | "STOP" | "RESET") => void;
};

let counter = 0;

export function usePublisherBridge(): Bridge {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [state, setState] = useState<PublisherState | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Only this window, and only the extension's own messages.
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as Inbound | undefined;
      if (!data || data.source !== EXTENSION) return;

      if (data.type === "READY") {
        setInstalled(true);
        setVersion(data.version);
      }
      if (data.type === "STATE") setState(data.state);
      if (data.type === "GONE") setStale(true);
    }

    window.addEventListener("message", onMessage);
    post({ type: "HELLO" });
    post({ type: "GET_STATE" });

    // No answer means no extension (or not enabled for this site).
    const timer = setTimeout(() => setInstalled((v) => (v === null ? false : v)), 1200);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, []);

  const start = useCallback<Bridge["start"]>((job) => {
    const requestId = `req-${Date.now()}-${++counter}`;
    return new Promise((resolve) => {
      const done = (result: { ok: boolean; error?: string }) => {
        window.removeEventListener("message", onResult);
        clearTimeout(timer);
        resolve(result);
      };
      function onResult(event: MessageEvent) {
        const data = event.data as Inbound | undefined;
        if (event.source !== window || event.origin !== window.location.origin) return;
        if (data?.source !== EXTENSION) return;
        if (data.type === "RESULT" && data.requestId === requestId) {
          done({ ok: data.ok, error: data.error });
        }
      }
      const timer = setTimeout(
        () => done({ ok: false, error: "The extension didn't answer. Is it enabled?" }),
        15000,
      );
      window.addEventListener("message", onResult);
      post({ type: "START", requestId, ...job });
    });
  }, []);

  const send = useCallback<Bridge["send"]>((type) => post({ type }), []);

  return { installed, stale, version, state, start, send };
}

function post(message: Record<string, unknown>) {
  window.postMessage({ source: PAGE, ...message }, window.location.origin);
}
