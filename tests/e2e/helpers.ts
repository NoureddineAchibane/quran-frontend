import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const SILENT_MP3 = fs.readFileSync(
  path.join(__dirname, '..', 'fixtures', 'silent.mp3'),
);

/** Mock surah catalog — 3 surahs is enough for every flow. */
export const SURAHS = [
  { id: 1, name_arabic: 'الفاتحة', name_simple: 'Al-Fatihah', translated_name: 'The Opener', verses_count: 7, revelation_place: 'makkah' },
  { id: 112, name_arabic: 'الإخلاص', name_simple: 'Al-Ikhlas', translated_name: 'The Sincerity', verses_count: 4, revelation_place: 'makkah' },
  { id: 2, name_arabic: 'البقرة', name_simple: 'Al-Baqarah', translated_name: 'The Cow', verses_count: 286, revelation_place: 'madinah' },
];

export const RECITERS = [
  { id: 1, reciter_name: 'Alafasy' },
  { id: 2, reciter_name: 'Husary' },
  { id: 3, reciter_name: 'Abdul Basit' },
];

/** 60 ahzab, two per juz. */
export const AHZAB = Array.from({ length: 60 }, (_, i) => ({
  hizb_num: i + 1,
  juz_num: Math.floor(i / 2) + 1,
  start_surah: 2,
  start_ayah: i * 4 + 1,
  end_surah: 2,
  end_ayah: i * 4 + 4,
}));

function quranCloudBody(surahNum: number, count: number) {
  return {
    data: {
      ayahs: Array.from({ length: count }, (_, i) => ({
        number: surahNum * 1000 + i + 1,
        numberInSurah: i + 1,
        text: `نص الآية رقم ${i + 1} من سورة ${surahNum}`,
      })),
    },
  };
}

export interface MockOptions {
  history?: object[];
  /** Fail the backend catalog endpoints (reciters/surahs/ahzab). */
  failCatalog?: boolean;
  /** Fail alquran.cloud text fetches. */
  failQuranText?: boolean;
}

/**
 * Install network mocks for the whole app surface:
 * backend API (localhost:8000), alquran.cloud, everyayah CDN, jsDelivr tafsir.
 * Returns setters to flip failure modes at runtime (for retry tests).
 */
export async function mockNetwork(page: Page, opts: MockOptions = {}) {
  const state = {
    failCatalog: opts.failCatalog ?? false,
    failQuranText: opts.failQuranText ?? false,
  };

  const json = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/localhost:8000/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/history')) {
      if (route.request().method() === 'POST') {
        const posted = route.request().postDataJSON();
        return route.fulfill(json({ ...posted, id: 999, completed_at: new Date().toISOString() }));
      }
      return route.fulfill(json(opts.history ?? []));
    }
    if (url.includes('/notes')) return route.fulfill(json([]));
    if (url.includes('/recitations')) {
      return state.failCatalog ? route.abort() : route.fulfill(json(RECITERS));
    }
    if (url.includes('/surahs')) {
      return state.failCatalog ? route.abort() : route.fulfill(json(SURAHS));
    }
    if (url.includes('/ahzab')) {
      return state.failCatalog ? route.abort() : route.fulfill(json(AHZAB));
    }
    if (url.includes('/resolve-audio')) {
      const req = route.request().postDataJSON();
      const min = req.whole_surah ? 1 : req.ayah_min;
      const max = req.whole_surah
        ? (SURAHS.find((s) => s.id === req.surah_number)?.verses_count ?? 3)
        : req.ayah_max;
      const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return route.fulfill(json({
        urls: nums.map((n) => `https://everyayah.com/data/test/${String(req.surah_number).padStart(3, '0')}${String(n).padStart(3, '0')}.mp3`),
        ayah_numbers: nums,
      }));
    }
    if (url.includes('/resolve-hizb')) {
      const req = route.request().postDataJSON();
      const nums = Array.from({ length: 4 }, (_, i) => req.start_ayah + i);
      return route.fulfill(json({
        urls: nums.map((n) => `https://everyayah.com/data/test/h${n}.mp3`),
        ayah_numbers: nums,
        surah_ayah_pairs: nums.map((n) => ({ surah: req.start_surah, ayah_in_surah: n })),
      }));
    }
    return route.fulfill(json({}));
  });

  await page.route('**/api.alquran.cloud/**', async (route) => {
    if (state.failQuranText) return route.abort();
    const m = route.request().url().match(/\/surah\/(\d+)\//);
    const surahNum = m ? Number(m[1]) : 1;
    const count = SURAHS.find((s) => s.id === surahNum)?.verses_count ?? 7;
    return route.fulfill(json(quranCloudBody(surahNum, Math.min(count, 10))));
  });

  await page.route('**/everyayah.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/mpeg', body: SILENT_MP3 }),
  );

  await page.route('**/cdn.jsdelivr.net/**', (route) =>
    route.fulfill(json({ text: 'تفسير تجريبي للآية.' })),
  );

  return {
    setFailCatalog: (v: boolean) => { state.failCatalog = v; },
    setFailQuranText: (v: boolean) => { state.failQuranText = v; },
  };
}

/** Click through mode selection → reciter → surah, landing on step 3 (range). */
export async function goToRangeStep(page: Page, mode: RegExp | string = /قراءة حرة/) {
  await page.goto('/');
  await page.getByRole('button', { name: mode }).click();
  await page.getByRole('button', { name: /القارئ عبد الباسط/ }).first().click();
  await page.getByRole('button', { name: /اختر السورة/ }).click();
  await page.getByRole('option', { name: /الإخلاص/ }).click();
  await page.getByRole('button', { name: /حدد الآيات/ }).click();
}
