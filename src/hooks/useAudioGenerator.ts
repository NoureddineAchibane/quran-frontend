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

/**
 * Read the bitrate (kbps) from an MP3 file's first frame header.
 * Reads at most 4 KB — instant, synchronous, zero memory overhead.
 * Works for CBR files (all everyayah.com reciters are CBR).
 * Falls back to 128 kbps if the header can't be parsed.
 */
function readMp3BitrateKbps(buf: ArrayBuffer): number {
  const b = new Uint8Array(buf, 0, Math.min(buf.byteLength, 4096));
  let i = 0;

  // Skip ID3v2 tag if present (starts with "ID3")
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 && b.length >= 10) {
    const id3Size =
      ((b[6] & 0x7F) << 21) | ((b[7] & 0x7F) << 14) |
      ((b[8] & 0x7F) << 7)  |  (b[9] & 0x7F);
    i = 10 + id3Size;
  }

  // Scan for MP3 sync word (0xFF followed by 0xE0–0xFF)
  for (; i < b.length - 3; i++) {
    if (b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) continue;

    // bits [4:3] of byte1 = MPEG version  (3=MPEG1, 2=MPEG2, 0=MPEG2.5)
    // bits [2:1] of byte1 = layer         (1=Layer III = MP3)
    // bits [7:4] of byte2 = bitrate index
    const version = (b[i + 1] >> 3) & 0x3;
    const layer   = (b[i + 1] >> 1) & 0x3;
    const biIdx   = (b[i + 2] >> 4) & 0xF;

    if (layer !== 1) continue; // must be Layer III (MP3)

    const kbps = version === 3
      // MPEG1 Layer III
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0][biIdx]
      // MPEG2 / MPEG2.5 Layer III
      : [0,  8, 16, 24, 32, 40, 48, 56,  64,  80,  96, 112, 128, 144, 160, 0][biIdx];

    if (kbps > 0) return kbps;
  }

  return 128; // fallback
}

/**
 * Build per-ayah timings from the real MP3 bitrate (read from each buffer's
 * frame header). Synchronous and ~instant — no audio decoding needed.
 */
function buildTimings(
  buffers: (ArrayBuffer | null)[],
  ayahNumbers: number[],
  surahAyahPairs?: Array<{ surah: number; ayah_in_surah: number }>,
): AyahTiming[] {
  const timings: AyahTiming[] = [];
  let cursor = 0;

  buffers.forEach((buf, i) => {
    if (!buf) return;
    const bitrateKbps = readMp3BitrateKbps(buf);
    const dur_ms = Math.round(buf.byteLength * 8 / (bitrateKbps * 1000) * 1000);
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
      const timings = buildTimings(buffers, ayah_numbers, surah_ayah_pairs);

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
