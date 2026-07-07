'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CITIES, PRAYER_ORDER, PRAYER_AR, PrayerData, PrayerKey,
  fetchPrayerTimes, nextPrayer, currentPrayer, nowSecondsInTz, fmtCountdown,
} from '@/lib/islamic/prayer';

const CITY_KEY = 'quran.prayer.city.v1';

// fixed positions so SSR/CSR match (no hydration drift)
const PARTICLES = [
  { l: '11%', t: '34%', d: '0s', u: '13s' }, { l: '27%', t: '64%', d: '3s', u: '15s' },
  { l: '46%', t: '24%', d: '5s', u: '12s' }, { l: '64%', t: '58%', d: '1.5s', u: '16s' },
  { l: '81%', t: '32%', d: '4s', u: '14s' }, { l: '92%', t: '66%', d: '6s', u: '17s' },
];

/** Countdown with a gentle per-digit transition on change (key-swap → CSS enter). */
function Countdown({ value }: { value: string }) {
  return (
    <div className="pbar-hero-cd" dir="ltr" aria-label={`العد التنازلي ${value}`}>
      {value.split('').map((ch, i) =>
        ch === ':'
          ? <span key={`c${i}`} className="cd-colon">:</span>
          : <span key={`${i}:${ch}`} className="cd-digit">{ch}</span>
      )}
    </div>
  );
}

export default function PrayerBar() {
  const [data, setData] = useState<PrayerData | null>(null);
  const [err, setErr] = useState(false);
  const [cityKey, setCityKey] = useState('casablanca');
  const [, forceTick] = useState(0);
  const loadedCity = useRef<string | null>(null);

  useEffect(() => { try { const c = localStorage.getItem(CITY_KEY); if (c) setCityKey(c); } catch {} }, []);

  useEffect(() => {
    if (loadedCity.current === cityKey) return;
    loadedCity.current = cityKey;
    let alive = true; setErr(false);
    fetchPrayerTimes(cityKey).then(d => alive && setData(d)).catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [cityKey]);

  useEffect(() => { const id = setInterval(() => forceTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  const pickCity = (k: string) => { setCityKey(k); try { localStorage.setItem(CITY_KEY, k); } catch {} };

  const nowFrac = useMemo(() => {
    if (!data) return 0;
    const secs = PRAYER_ORDER.map(k => { const [h, m] = data.timings[k].split(':').map(Number); return h * 3600 + m * 60; });
    const now = nowSecondsInTz(data.timezone);
    const n = secs.length;
    if (now <= secs[0]) return 0;
    if (now >= secs[n - 1]) return 1;
    for (let i = 0; i < n - 1; i++) if (now >= secs[i] && now < secs[i + 1]) {
      return (i + (now - secs[i]) / (secs[i + 1] - secs[i])) / (n - 1);
    }
    return 1;
  }, [data, Math.floor(Date.now() / 30000)]);

  if (err) return (
    <section className="pbar pbar-msg" role="status"><span>تعذّر جلب مواقيت الصلاة — تحقّق من الاتصال</span></section>
  );
  if (!data) return (
    <section className="pbar pbar-skeleton" aria-hidden="true"><span className="pbar-shimmer" /></section>
  );

  const next = nextPrayer(data);
  const cur = currentPrayer(data);
  const curIdx = PRAYER_ORDER.indexOf(cur);
  const city = CITIES.find(c => c.key === cityKey) ?? CITIES[0];

  return (
    <section className="pbar" role="region" aria-label="لوحة مواقيت الصلاة">
      <div className="pbar-pattern" aria-hidden="true" />
      <div className="pbar-aura" aria-hidden="true" />
      <div className="pbar-particles" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <span key={i} style={{ insetInlineStart: p.l, top: p.t, ['--pd' as any]: p.d, ['--pu' as any]: p.u }} />
        ))}
      </div>
      <div className="pbar-vignette" aria-hidden="true" />

      {/* ── meta: city · dates · source ── */}
      <div className="pbar-meta">
        <label className="pbar-chip pbar-city">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <select value={cityKey} onChange={e => pickCity(e.target.value)} aria-label="اختر المدينة">
            {CITIES.map(c => <option key={c.key} value={c.key}>{c.ar}</option>)}
          </select>
        </label>

        <div className="pbar-dates">
          <span className="pbar-hijri"><bdi dir="ltr">{data.hijri.day}</bdi> {data.hijri.monthAr} <bdi dir="ltr">{data.hijri.year}</bdi> هـ</span>
          <span className="pbar-greg">{data.gregorian.weekdayAr} · <bdi dir="ltr">{data.gregorian.day} {data.gregorian.monthEn} {data.gregorian.year}</bdi></span>
        </div>

        <span className="pbar-chip pbar-source" title="وزارة الأوقاف والشؤون الإسلامية — المملكة المغربية">
          <span className="pbar-source-dot" aria-hidden="true" /> وزارة الأوقاف
        </span>
      </div>

      {/* ── hero: next-prayer countdown ── */}
      <div className="pbar-hero">
        <span className="pbar-hero-lbl">متبقٍّ على صلاة {next.ar}</span>
        <Countdown value={fmtCountdown(next.secUntil)} />
        <span className="pbar-hero-at">
          <span className="pbar-hero-mosque" aria-hidden="true">🕌</span>
          <span className="pbar-hero-name">{next.ar}</span>
          <span className="pbar-hero-dot">•</span>
          <bdi dir="ltr" className="pbar-hero-time">{data.timings[next.key]}</bdi>
        </span>
      </div>

      {/* ── divider ── */}
      <div className="pbar-divider" aria-hidden="true"><span /></div>

      {/* ── timeline ── */}
      <div className="pbar-timeline" role="list" aria-label="مواقيت اليوم">
        <div className="pbar-track">
          <div className="pbar-track-fill" style={{ inlineSize: `${nowFrac * 100}%` }} />
          <div className="pbar-now" style={{ insetInlineStart: `${nowFrac * 100}%` }} />
        </div>
        <div className="pbar-nodes">
          {PRAYER_ORDER.map((k, i) => {
            const state = i < curIdx ? 'past' : i === curIdx ? 'cur' : 'future';
            return (
              <div key={k} role="listitem" className={`pbar-node ${state}${next.key === k ? ' next' : ''}`}>
                <span className="pbar-dot" />
                <span className="pbar-nname">{PRAYER_AR[k as PrayerKey]}</span>
                <span className="pbar-ntime"><bdi dir="ltr">{data.timings[k as PrayerKey]}</bdi></span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
