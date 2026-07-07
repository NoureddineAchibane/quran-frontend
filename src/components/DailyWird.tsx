'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  DAILY_DUAS, MORNING_ADHKAR, EVENING_ADHKAR, WIRD_ROUTINES, dayIndex, Dhikr,
} from '@/lib/islamic/content';
import { fetchPrayerTimes, adhkarPeriod } from '@/lib/islamic/prayer';

type Tab = 'adhkar' | 'wird' | 'dua';

/** A single dhikr card with tap-to-count tasbīḥ when repeat > 1. */
function DhikrCard({ d, idx }: { d: Dhikr; idx: number }) {
  const target = d.repeat ?? 1;
  const [count, setCount] = useState(0);
  const done = count >= target;
  const bump = () => setCount(c => (c >= target ? 0 : c + 1));
  return (
    <div className={`wz-card${done ? ' wz-done' : ''}`} style={{ ['--i' as any]: idx }}>
      <p className="wz-text" dir="rtl">{d.ar}</p>
      <div className="wz-foot">
        <span className="wz-src">{d.source}</span>
        {target > 1 && (
          <button className="wz-counter" onClick={bump} aria-label={`تكرار ${target} — عدّاد التسبيح`}>
            <span className="wz-tick">{done ? '✓' : '○'}</span>
            <span className="wz-count"><bdi dir="ltr">{count} / {target}</bdi></span>
          </button>
        )}
      </div>
      {d.note && <div className="wz-note">✦ {d.note}</div>}
    </div>
  );
}

export default function DailyWird({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('adhkar');
  const [period, setPeriod] = useState<'morning' | 'evening'>('morning');
  const [routine, setRoutine] = useState(WIRD_ROUTINES[0].key);
  const [mounted, setMounted] = useState(false);

  // slide-in transition
  useEffect(() => { if (open) requestAnimationFrame(() => setMounted(true)); else setMounted(false); }, [open]);

  // pick morning/evening from the user's local prayer window (cached city)
  useEffect(() => {
    if (!open) return;
    let city = 'casablanca';
    try { city = localStorage.getItem('quran.prayer.city.v1') || city; } catch {}
    fetchPrayerTimes(city).then(d => setPeriod(adhkarPeriod(d))).catch(() => {});
  }, [open]);

  const dua = useMemo(() => DAILY_DUAS[dayIndex(DAILY_DUAS.length)], []);
  const adhkar = period === 'morning' ? MORNING_ADHKAR : EVENING_ADHKAR;
  const activeRoutine = WIRD_ROUTINES.find(r => r.key === routine) ?? WIRD_ROUTINES[0];

  if (!open) return null;

  return (
    <>
      <div className={`wz-overlay${mounted ? ' show' : ''}`} onClick={onClose} />
      <aside className={`wz-panel${mounted ? ' open' : ''}`} role="dialog" aria-label="الورد والأذكار">
        <header className="wz-head">
          <div className="wz-head-title">
            <span className="wz-head-orn">﷽</span>
            <h2>الوِرد والأذكار</h2>
          </div>
          <button className="wz-close" onClick={onClose} aria-label="إغلاق">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </header>

        <div className="wz-tabs" role="tablist">
          <button className={`wz-tab${tab === 'adhkar' ? ' on' : ''}`} onClick={() => setTab('adhkar')} role="tab" aria-selected={tab === 'adhkar'}>
            أذكار {period === 'morning' ? 'الصباح' : 'المساء'}
          </button>
          <button className={`wz-tab${tab === 'wird' ? ' on' : ''}`} onClick={() => setTab('wird')} role="tab" aria-selected={tab === 'wird'}>الورد اليومي</button>
          <button className={`wz-tab${tab === 'dua' ? ' on' : ''}`} onClick={() => setTab('dua')} role="tab" aria-selected={tab === 'dua'}>دعاء اليوم</button>
        </div>

        <div className="wz-body">
          {tab === 'adhkar' && (
            <>
              <div className="wz-period">
                <span className="wz-period-glyph">{period === 'morning' ? '🌅' : '🌙'}</span>
                <span>{period === 'morning' ? 'وقت أذكار الصباح' : 'وقت أذكار المساء'} — تُقرأ حسب وقتك المحلّي</span>
              </div>
              {adhkar.map((d, i) => <DhikrCard key={i} d={d} idx={i} />)}
            </>
          )}

          {tab === 'wird' && (
            <>
              <div className="wz-routines" role="tablist">
                {WIRD_ROUTINES.map(r => (
                  <button key={r.key} className={`wz-chip${routine === r.key ? ' on' : ''}`} onClick={() => setRoutine(r.key)}>
                    <span className="wz-chip-ic">{r.icon}</span>{r.title}
                  </button>
                ))}
              </div>
              <div className="wz-routine-title">{activeRoutine.icon} {activeRoutine.title}</div>
              {activeRoutine.items.map((d, i) => <DhikrCard key={activeRoutine.key + i} d={d} idx={i} />)}
            </>
          )}

          {tab === 'dua' && (
            <div className="wz-dua">
              <div className="wz-dua-label">دعاء اليوم · يتجدّد كل يوم</div>
              <p className="wz-dua-text" dir="rtl">{dua.ar}</p>
              <div className="wz-dua-src">{dua.source}</div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
