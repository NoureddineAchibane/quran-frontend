"use client";
import { useState, useRef, useCallback } from "react";

export interface AudioGeneratorRequest {
  recitation_id: number;
  surah_number: number;
  whole_surah: boolean;
  ayah_min?: number;
  ayah_max?: number;
}

export interface HizbGeneratorRequest {
  recitation_id: number;
  hizb_num: number;
  start_surah: number;
  start_ayah: number;
  end_surah: number;
  end_ayah: number;
}

export interface ProgressEvent {
  type: "progress";
  ayah: number;
  index: number;
  total: number;
  status: "ok" | "fallback" | "failed";
}

export interface AyahTiming {
  ayah: number;
  surah?: number;
  ayah_in_surah?: number;
  start_ms: number;
  end_ms: number;
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function estimateTimings(
  buffers: (ArrayBuffer | null)[],
  ayahNumbers: number[],
  surahAyahPairs?: Array<{ surah: number; ayah_in_surah: number }>,
): AyahTiming[] {
  const timings: AyahTiming[] = [];
  let cursor = 0;
  buffers.forEach((buf, i) => {
    if (!buf) return;
    // 128 kbps CBR → 16 000 bytes/s
    const dur_ms = Math.round(buf.byteLength / 16000 * 1000);
    const t: AyahTiming = { ayah: ayahNumbers[i], start_ms: cursor, end_ms: cursor + dur_ms };
    if (surahAyahPairs?.[i]) {
      t.surah = surahAyahPairs[i].surah;
      t.ayah_in_surah = surahAyahPairs[i].ayah_in_surah;
    }
    timings.push(t);
    cursor += dur_ms;
  });
  return timings;
}

export function useAudioGenerator() {
  const [state, setState] = useState<GeneratorState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(prev => {
      if (prev.downloadUrl) URL.revokeObjectURL(prev.downloadUrl);
      return INITIAL;
    });
  }, []);

  const _run = useCallback(async (
    endpoint: string,
    payload: object,
    filenameHint: string,
  ): Promise<string> => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ ...INITIAL, status: "resolving" });

    try {
      // Step 1: resolve CDN URLs from backend
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `خطأ HTTP ${res.status}`);
      }
      const { urls, ayah_numbers, surah_ayah_pairs } = await res.json();

      setState(s => ({ ...s, status: "downloading", total: urls.length }));

      // Step 2: fetch each MP3 from everyayah CDN in parallel, track progress
      const buffers: (ArrayBuffer | null)[] = new Array(urls.length).fill(null);
      let completed = 0;

      await Promise.all(
        (urls as string[]).map(async (url, i) => {
          try {
            const r = await fetch(url, { signal: ctrl.signal });
            if (r.ok) {
              buffers[i] = await r.arrayBuffer();
              completed++;
              setState(s => ({
                ...s,
                downloaded: completed,
                ayahs: [...s.ayahs, {
                  type: "progress" as const,
                  ayah: ayah_numbers[i],
                  index: i + 1,
                  total: urls.length,
                  status: "ok" as const,
                }],
              }));
            } else {
              completed++;
              setState(s => ({ ...s, downloaded: completed }));
            }
          } catch {
            completed++;
            setState(s => ({ ...s, downloaded: completed }));
          }
        })
      );

      setState(s => ({ ...s, status: "merging" }));

      // Step 3: concatenate valid buffers in order
      const totalBytes = buffers.reduce((sum, b) => sum + (b?.byteLength ?? 0), 0);
      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const buf of buffers) {
        if (buf) { merged.set(new Uint8Array(buf), offset); offset += buf.byteLength; }
      }

      const blob = new Blob([merged], { type: "audio/mpeg" });
      const downloadUrl = URL.createObjectURL(blob);
      const timings = estimateTimings(buffers, ayah_numbers, surah_ayah_pairs);

      setState(s => ({
        ...s, status: "done", downloadUrl,
        filename: filenameHint,
        sizeKb: Math.round(blob.size / 1024),
        timings,
      }));
      return downloadUrl;
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") throw err;
      const msg = (err as Error)?.message ?? "خطأ غير معروف";
      setState(s => ({ ...s, status: "error", error: msg }));
      throw err;
    }
  }, []);

  const generate = useCallback(
    (req: AudioGeneratorRequest) =>
      _run("/resolve-audio", req, `surah_${req.surah_number}.mp3`),
    [_run],
  );

  const generateHizb = useCallback(
    (req: HizbGeneratorRequest) =>
      _run("/resolve-hizb", req, `hizb_${req.hizb_num}.mp3`),
    [_run],
  );

  const percent = state.total > 0
    ? Math.round((state.downloaded / state.total) * 100) : 0;

  return { ...state, percent, generate, generateHizb, reset };
}
