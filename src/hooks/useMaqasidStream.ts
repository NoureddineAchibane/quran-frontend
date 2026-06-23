"use client";

import { useCallback, useRef, useState } from "react";

export interface MaqasidData {
  ayah: number;
  meaning: string;
  maqsad: string;
  fa2ida: string;
  asbab?: string;
  topic: string;
}

export interface MaqasidStreamRequest {
  surahNum: number;
  surahName: string;
  ayahNum: number;
  ayahText: string;
}

// Keep the same status names so page.tsx JSX needs no changes
type StreamStatus = "idle" | "connecting" | "streaming" | "done" | "error";

interface StreamState {
  status: StreamStatus;
  draft: string;
  data: MaqasidData | null;
  error: string | null;
  model: string;
  cached: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const INITIAL: StreamState = {
  status: "idle",
  draft: "",
  data: null,
  error: null,
  model: "",
  cached: false,
};

export function useMaqasidStream() {
  const [state, setState] = useState<StreamState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const analyze = useCallback(async (req: MaqasidStreamRequest): Promise<MaqasidData> => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ ...INITIAL, status: "connecting" });

    try {
      setState(s => ({ ...s, status: "streaming" }));

      const res = await fetch(`${API_BASE}/maqasid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surah_number: req.surahNum,
          surah_name:   req.surahName,
          ayah_number:  req.ayahNum,
          ayah_text:    req.ayahText,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `خطأ HTTP ${res.status}`);
      }

      const data = (await res.json()) as MaqasidData;
      setState(s => ({ ...s, status: "done", data, cached: false }));
      return data;
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") throw err;
      const message = (err as Error)?.message ?? "تعذّر إكمال التحليل.";
      setState(s => ({ ...s, status: "error", error: message }));
      throw err;
    }
  }, []);

  return { ...state, analyze, reset };
}
