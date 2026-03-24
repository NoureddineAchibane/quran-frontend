"use client";
import { useState, useRef, useCallback } from "react";

export interface AudioGeneratorRequest {
  recitation_id: number;
  surah_number: number;
  whole_surah: boolean;
  ayah_min?: number;
  ayah_max?: number;
}

export interface ProgressEvent {
  type: "progress";
  ayah: number;
  index: number;
  total: number;
  status: "ok" | "fallback" | "failed";
}

export interface AyahTiming {
  ayah: number;      // ayah number in surah
  start_ms: number;  // start offset in merged MP3 (ms)
  end_ms: number;    // end offset in merged MP3 (ms)
}

export type GeneratorStatus =
  | "idle" | "connecting" | "resolving"
  | "downloading" | "merging" | "done" | "error";

export interface GeneratorState {
  status: GeneratorStatus;
  total: number;
  downloaded: number;
  fallbacks: number;
  failed: number;
  ayahs: ProgressEvent[];
  downloadUrl: string | null;
  filename: string | null;
  sizeKb: number | null;
  timings: AyahTiming[];
  error: string | null;
}

const INITIAL: GeneratorState = {
  status: "idle", total: 0, downloaded: 0,
  fallbacks: 0, failed: 0, ayahs: [],
  downloadUrl: null, filename: null, sizeKb: null,
  timings: [], error: null,
};

const WS_BASE  = process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useAudioGenerator() {
  const [state, setState] = useState<GeneratorState>(INITIAL);
  const wsRef = useRef<WebSocket | null>(null);

  const reset = useCallback(() => {
    // Null out the ref first so stale onclose handlers ignore the event
    const old = wsRef.current;
    wsRef.current = null;
    old?.close();
    setState(INITIAL);
  }, []);

  const generate = useCallback((req: AudioGeneratorRequest) => {
    return new Promise<string>((resolve, reject) => {
      // Close any in-flight WebSocket without letting its onclose set an error
      const old = wsRef.current;
      wsRef.current = null;
      old?.close();

      setState({ ...INITIAL, status: "connecting" });

      // `settled` — a plain closure boolean (not React state) so it is always
      // current when WebSocket event handlers run, regardless of React batching.
      // It guards both the promise and the setState so only the first terminal
      // event (done / server-error / unexpected-close) wins.
      let settled = false;

      const ws = new WebSocket(`${WS_BASE}/ws/generate-audio`);
      wsRef.current = ws;

      // Returns true if this WebSocket is still the active one (not replaced by
      // a subsequent generate() call or nulled by reset()).
      const isCurrent = () => ws === wsRef.current;

      ws.onopen = () => {
        setState(s => ({ ...s, status: "resolving" }));
        ws.send(JSON.stringify(req));
      };

      ws.onmessage = (e) => {
        if (!isCurrent()) return;
        let msg: any;
        try { msg = JSON.parse(e.data); } catch { return; }

        if (msg.type === "start") {
          setState(s => ({ ...s, status: "downloading", total: msg.total }));

        } else if (msg.type === "progress") {
          const p = msg as ProgressEvent;
          setState(s => ({
            ...s,
            downloaded: s.downloaded + 1,
            fallbacks: p.status === "fallback" ? s.fallbacks + 1 : s.fallbacks,
            failed:    p.status === "failed"   ? s.failed    + 1 : s.failed,
            ayahs: [...s.ayahs, p],
          }));

        } else if (msg.type === "merging") {
          setState(s => ({ ...s, status: "merging" }));

        } else if (msg.type === "done") {
          if (settled) return;
          settled = true;
          const url = `${API_BASE}${msg.download_url}`;
          setState(s => ({
            ...s, status: "done",
            downloadUrl: url,
            filename:    msg.filename,
            sizeKb:      msg.size_kb,
            timings:     msg.timings ?? [],
          }));
          // Resolve BEFORE closing so the consumer gets the URL immediately.
          resolve(url);
          // Null the ref before ws.close() so the onclose handler sees
          // isCurrent()=false and exits without touching state.
          wsRef.current = null;
          ws.close();

        } else if (msg.type === "error") {
          if (settled) return;
          settled = true;
          const msg_text = msg.message ?? "خطأ غير معروف من الخادم";
          setState(s => ({ ...s, status: "error", error: msg_text }));
          wsRef.current = null;
          ws.close();
          reject(new Error(msg_text));
        }
      };

      ws.onerror = () => {
        // onerror always fires just before onclose on a failed connection.
        // We handle the error definitively in onclose to avoid double-handling.
        // Just log so it's visible in DevTools if needed.
        if (!isCurrent() || settled) return;
        // Don't set state here — let onclose do it once cleanly.
      };

      ws.onclose = (ev) => {
        if (!isCurrent() || settled) return;
        settled = true;
        // Determine a useful message: use the close reason if the server sent one
        const reason = ev.reason
          ? ev.reason
          : ev.code === 1006
            ? "انقطع الاتصال بشكل مفاجئ (رمز ١٠٠٦)"
            : "انقطع الاتصال بشكل غير متوقع";
        setState(s => {
          const mid = ["connecting","resolving","downloading","merging"];
          if (mid.includes(s.status)) {
            return { ...s, status: "error", error: reason };
          }
          return s;
        });
        reject(new Error(reason));
      };
    });
  }, []);

  const percent = state.total > 0
    ? Math.round((state.downloaded / state.total) * 100) : 0;

  return { ...state, percent, generate, reset };
}
