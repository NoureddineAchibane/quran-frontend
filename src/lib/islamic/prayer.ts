// ─────────────────────────────────────────────────────────────────────────
// Prayer times — official Moroccan Ministry of Habous & Islamic Affairs.
// Source: Aladhan API, calculation method 21 ("Morocco"), which mirrors the
// Ministry of Habous timetable. Returns Hijri + Gregorian dates too.
// Docs: https://aladhan.com/prayer-times-api
// ─────────────────────────────────────────────────────────────────────────

export interface MoroccanCity { key: string; ar: string; lat: number; lng: number; }

// Major Moroccan cities (Habous timetable is published per-city).
export const CITIES: MoroccanCity[] = [
  { key: 'casablanca', ar: 'الدار البيضاء', lat: 33.5731, lng: -7.5898 },
  { key: 'rabat',      ar: 'الرباط',         lat: 34.0209, lng: -6.8416 },
  { key: 'fes',        ar: 'فاس',            lat: 34.0181, lng: -5.0078 },
  { key: 'marrakech',  ar: 'مراكش',          lat: 31.6295, lng: -7.9811 },
  { key: 'tanger',     ar: 'طنجة',           lat: 35.7595, lng: -5.8340 },
  { key: 'agadir',     ar: 'أكادير',         lat: 30.4278, lng: -9.5981 },
  { key: 'meknes',     ar: 'مكناس',          lat: 33.8935, lng: -5.5473 },
  { key: 'oujda',      ar: 'وجدة',           lat: 34.6867, lng: -1.9114 },
  { key: 'tetouan',    ar: 'تطوان',          lat: 35.5785, lng: -5.3684 },
  { key: 'laayoune',   ar: 'العيون',         lat: 27.1253, lng: -13.1625 },
];

export const PRAYER_ORDER = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'] as const;
export type PrayerKey = typeof PRAYER_ORDER[number];

export const PRAYER_AR: Record<PrayerKey, string> = {
  Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر',
  Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء',
};

export interface PrayerData {
  timings: Record<PrayerKey, string>;    // "HH:MM" local to `timezone`
  timezone: string;                       // e.g. "Africa/Casablanca"
  hijri: { day: string; monthAr: string; year: string };
  gregorian: { day: string; monthEn: string; weekdayAr: string; year: string };
  cityKey: string;
  fetchedFor: string;                     // "DD-MM-YYYY"
}

const WEEKDAY_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const CACHE_KEY = 'quran.prayer.v1';

function ddmmyyyy(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function getCity(key: string): MoroccanCity {
  return CITIES.find(c => c.key === key) ?? CITIES[0];
}

/** Fetch (with 1-day localStorage cache) the Habous prayer times + dates. */
export async function fetchPrayerTimes(cityKey: string): Promise<PrayerData> {
  const today = ddmmyyyy();
  // serve from cache when it's the same city + same day
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as PrayerData;
      if (c.cityKey === cityKey && c.fetchedFor === today) return c;
    }
  } catch { /* ignore */ }

  const city = getCity(cityKey);
  const url = `https://api.aladhan.com/v1/timings/${today}`
    + `?latitude=${city.lat}&longitude=${city.lng}&method=21`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`prayer API ${res.status}`);
  const { data } = await res.json();

  const timings = {} as Record<PrayerKey, string>;
  for (const k of PRAYER_ORDER) timings[k] = (data.timings[k] ?? '').slice(0, 5);

  const out: PrayerData = {
    timings,
    timezone: data.meta?.timezone ?? 'Africa/Casablanca',
    hijri: {
      day: data.date.hijri.day,
      monthAr: data.date.hijri.month.ar,
      year: data.date.hijri.year,
    },
    gregorian: {
      day: data.date.gregorian.day,
      monthEn: data.date.gregorian.month.en,
      weekdayAr: WEEKDAY_AR[new Date().getDay()],
      year: data.date.gregorian.year,
    },
    cityKey,
    fetchedFor: today,
  };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(out)); } catch { /* ignore */ }
  return out;
}

/** Seconds since midnight, right now, in the given IANA timezone. */
export function nowSecondsInTz(tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  return get('hour') * 3600 + get('minute') * 60 + get('second');
}

const toSec = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
};

export interface NextPrayer {
  key: PrayerKey; ar: string; time: string;
  secUntil: number;               // seconds remaining until it starts
}

/** The next upcoming prayer (skips Sunrise) and seconds until it. */
export function nextPrayer(data: PrayerData): NextPrayer {
  const now = nowSecondsInTz(data.timezone);
  const seq = (['Fajr','Dhuhr','Asr','Maghrib','Isha'] as PrayerKey[])
    .map(k => ({ key: k, ar: PRAYER_AR[k], time: data.timings[k], sec: toSec(data.timings[k]) }));
  for (const p of seq) {
    if (p.sec > now) return { key: p.key, ar: p.ar, time: p.time, secUntil: p.sec - now };
  }
  // past Isha → next is tomorrow's Fajr
  const f = seq[0];
  return { key: 'Fajr', ar: f.ar, time: f.time, secUntil: (86400 - now) + f.sec };
}

/** Which prayer window are we in right now (for highlighting). */
export function currentPrayer(data: PrayerData): PrayerKey {
  const now = nowSecondsInTz(data.timezone);
  const seq = PRAYER_ORDER.map(k => ({ k, sec: toSec(data.timings[k]) }));
  let cur: PrayerKey = 'Isha';
  for (const p of seq) if (now >= p.sec) cur = p.k;
  return cur;
}

/**
 * Adhkar window based on local time:
 *  - Morning  (أذكار الصباح): from Fajr until ʿAsr
 *  - Evening  (أذكار المساء): from ʿAsr until the next Fajr
 */
export function adhkarPeriod(data: PrayerData): 'morning' | 'evening' {
  const now = nowSecondsInTz(data.timezone);
  const fajr = toSec(data.timings.Fajr);
  const asr = toSec(data.timings.Asr);
  return (now >= fajr && now < asr) ? 'morning' : 'evening';
}

/** Format seconds → "H:MM:SS" (Western digits, for the countdown). */
export function fmtCountdown(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}
