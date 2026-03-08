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
  note?: string;
}

export type GeneratorStatus = "idle" | "connecting" | "resolving" | "downloading" | "merging" | "done" | "error";

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
  error: string | null;
}

const INITIAL: GeneratorState = {
  status: "idle", total: 0, downloaded: 0,
  fallbacks: 0, failed: 0, ayahs: [],
  downloadUrl: null, filename: null, sizeKb: null, error: null,
};

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useAudioGenerator() {
  const [state, setState] = useState<GeneratorState>(INITIAL);
  const wsRef = useRef<WebSocket | null>(null);

  const reset = useCallback(() => {
    wsRef.current?.close();
    setState(INITIAL);
  }, []);

  const generate = useCallback((req: AudioGeneratorRequest) => {
    return new Promise<string>((resolve, reject) => {
      wsRef.current?.close();
      setState({ ...INITIAL, status: "connecting" });

      const ws = new WebSocket(`${WS_BASE}/ws/generate-audio`);
      wsRef.current = ws;

      ws.onopen = () => {
        setState(s => ({ ...s, status: "resolving" }));
        ws.send(JSON.stringify(req));
      };

      ws.onmessage = (e) => {
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
            failed: p.status === "failed" ? s.failed + 1 : s.failed,
            ayahs: [...s.ayahs, p],
          }));
        } else if (msg.type === "merging") {
          setState(s => ({ ...s, status: "merging" }));
        } else if (msg.type === "done") {
          const url = `${API_BASE}${msg.download_url}`;
          setState(s => ({
            ...s, status: "done",
            downloadUrl: url,
            filename: msg.filename,
            sizeKb: msg.size_kb,
          }));
          resolve(url);
          ws.close();
        } else if (msg.type === "error") {
          setState(s => ({ ...s, status: "error", error: msg.message }));
          reject(new Error(msg.message));
          ws.close();
        }
      };

      ws.onerror = () => {
        setState(s => ({ ...s, status: "error", error: "فشل الاتصال بالخادم" }));
        reject(new Error("WebSocket connection failed"));
      };

      ws.onclose = () => {
        setState(s => {
          if (["connecting", "resolving", "downloading"].includes(s.status)) {
            reject(new Error("انقطع الاتصال"));
            return { ...s, status: "error", error: "انقطع الاتصال بشكل غير متوقع" };
          }
          return s;
        });
      };
    });
  }, []);

  const percent = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
  return { ...state, percent, generate, reset };
}
