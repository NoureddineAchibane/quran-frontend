"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAudioGenerator, AyahTiming } from "@/hooks/useAudioGenerator";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const QURAN_TEXT_API  = "https://api.alquran.cloud/v1";

/* ════════════════════════════════════════════════════════════
   RECITER DATA — static, never 404
   SVG avatars with calligraphic initials + unique color scheme
════════════════════════════════════════════════════════════ */
interface ReciterMeta {
  nameAr: string; style: string; initials: string;
  color1: string; color2: string; country: string; born: string;
}
const RECITERS_META: Record<number, ReciterMeta> = {
  1:  { nameAr:"عبد الباسط عبد الصمد", style:"مرتّل",  initials:"عب", color1:"#2a5f4a",color2:"#c9a84c", country:"مصر",         born:"١٩٢٧" },
  2:  { nameAr:"عبد الباسط عبد الصمد", style:"مجوّد",  initials:"عب", color1:"#3a4f2a",color2:"#e2c06a", country:"مصر",         born:"١٩٢٧" },
  3:  { nameAr:"عبد الرحمن السديس",    style:"مرتّل",  initials:"عس", color1:"#4a2a2a",color2:"#c97a4c", country:"السعودية",    born:"١٩٦٠" },
  4:  { nameAr:"أبو بكر الشاطري",      style:"مرتّل",  initials:"أش", color1:"#1a3a5a",color2:"#7ab4e2", country:"السعودية",    born:"١٩٧٠" },
  5:  { nameAr:"هاني الرفاعي",         style:"مرتّل",  initials:"هر", color1:"#2a2a5a",color2:"#a07adf", country:"السعودية",    born:"١٩٧٢" },
  6:  { nameAr:"محمود خليل الحصري",    style:"مرتّل",  initials:"مح", color1:"#4a3a1a",color2:"#d4a848", country:"مصر",         born:"١٩١٧" },
  7:  { nameAr:"مشاري راشد العفاسي",   style:"مرتّل",  initials:"مع", color1:"#1a4a4a",color2:"#2ec9b8", country:"الكويت",      born:"١٩٧٦" },
  8:  { nameAr:"محمد صديق المنشاوي",   style:"مجوّد",  initials:"مم", color1:"#3a1a4a",color2:"#c06ad4", country:"مصر",         born:"١٩٢٠" },
  9:  { nameAr:"محمد صديق المنشاوي",   style:"مرتّل",  initials:"مم", color1:"#2a3a1a",color2:"#8fd45a", country:"مصر",         born:"١٩٢٠" },
  10: { nameAr:"سعود الشريم",          style:"مرتّل",  initials:"سش", color1:"#4a1a2a",color2:"#e27090", country:"السعودية",    born:"١٩٦٦" },
  11: { nameAr:"ماهر المعيقلي",        style:"مرتّل",  initials:"مم", color1:"#1a4a2a",color2:"#4acea8", country:"السعودية",    born:"١٩٦٩" },
  12: { nameAr:"محمود خليل الحصري",    style:"معلّم",  initials:"مح", color1:"#3a2a1a",color2:"#d4944c", country:"مصر",         born:"١٩١٧" },
  13: { nameAr:"سعد الغامدي",          style:"مرتّل",  initials:"سغ", color1:"#1a2a4a",color2:"#5a9adf", country:"السعودية",    born:"١٩٦٧" },
  14: { nameAr:"ياسر الدوسري",         style:"مرتّل",  initials:"يد", color1:"#2a4a1a",color2:"#7dce3a", country:"السعودية",    born:"١٩٧٩" },
  15: { nameAr:"ناصر القطامي",         style:"مرتّل",  initials:"نق", color1:"#4a2a3a",color2:"#d46a8a", country:"السعودية",    born:"١٩٧٢" },
};

// everyayah.com folder names — exact match with backend
const EVERYAYAH = "https://everyayah.com/data";
const RECITER_FOLDERS: Record<number,string> = {
  1:  "Abdul_Basit_Murattal_192kbps",
  2:  "Abdul_Basit_Mujawwad_128kbps",
  3:  "Abdurrahmaan_As-Sudais_192kbps",
  4:  "Abu_Bakr_Ash-Shaatree_128kbps",
  5:  "Hani_Rifai_192kbps",
  6:  "Husary_128kbps",
  7:  "Alafasy_128kbps",
  8:  "Minshawy_Mujawwad_128kbps",
  9:  "Minshawy_Murattal_128kbps",
  10: "Saud_Al-Shuraym_128kbps",
  11: "Maher_AlMuaiqly_128kbps",
  12: "Husary_128kbps",
  13: "Saad_Al-Ghamdi_128kbps",
  14: "Yasser_Ad-Dussary_128kbps",
  15: "Nasser_Alqatami_128kbps",
};
// 15 famous ayahs for random preview (surah*1000+ayah → 6-digit filename)
const PREVIEW_AYAHS = [
  "002255", // آية الكرسي — البقرة 255
  "003185", // كل نفس ذائقة الموت — آل عمران 185
  "002286", // لا يكلف الله نفسا — البقرة 286
  "059023", // هو الله الذي لا إله إلا هو — الحشر 23
  "036040", // لا الشمس ينبغي لها — يس 40 (قصيرة)
  "112001", // قل هو الله أحد — الإخلاص 1
  "055026", // كل من عليها فان — الرحمن 26
  "021035", // كل نفس ذائقة الموت — الأنبياء 35
  "039042", // الله يتوفى الأنفس — الزمر 42
  "002152", // فاذكروني أذكركم — البقرة 152
  "013028", // ألا بذكر الله تطمئن القلوب — الرعد 28
  "065003", // ومن يتوكل على الله — الطلاق 3
  "094005", // فإن مع العسر يسرا — الشرح 5
  "003173", // حسبنا الله ونعم الوكيل — آل عمران 173
  "039053", // لا تقنطوا من رحمة الله — الزمر 53
];
function previewUrl(id:number){
  const ayah = PREVIEW_AYAHS[Math.floor(Math.random()*PREVIEW_AYAHS.length)];
  return `${EVERYAYAH}/${RECITER_FOLDERS[id]}/${ayah}.mp3`;
}

const STEPS = [
  { id:1, ar:"القارئ",    icon:"🎙️" },
  { id:2, ar:"السورة",   icon:"📖" },
  { id:3, ar:"الآيات",   icon:"🔢" },
  { id:4, ar:"الاستماع", icon:"🎧" },
];

interface AyahText { number:number; text:string; numberInSurah:number; }
interface MaqasidData { ayah:number; meaning:string; maqsad:string; fa2ida:string; asbab?:string; topic:string; }

function toAr(n:number){ return String(n).replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[+d]); }

/* ════════════════════════════════════════════════════════════
   RECITER PHOTOS — Wikipedia REST API page/summary (free, CORS-enabled)
   Falls back to SVG avatar on error
════════════════════════════════════════════════════════════ */

// Wikipedia English article titles for pageimages lookup
const RECITER_WIKI: Record<number,string> = {
  1:  "Abdul_Basit_%27Abd_us-Samad",
  2:  "Abdul_Basit_%27Abd_us-Samad",
  3:  "Abdul_Rahman_Al-Sudais",
  4:  "Abu_Bakr_al-Shatri",
  5:  "Hani_ar-Rifai",
  6:  "Mahmoud_Khalil_Al-Hussary",
  7:  "Mishari_bin_Rashid_Alafasy",
  8:  "Mohamed_Siddiq_El-Minshawi",
  9:  "Mohamed_Siddiq_El-Minshawi",
  10: "Saud_Al-Shuraim",
  11: "Maher_Al-Muaiqly",
  12: "Mahmoud_Khalil_Al-Hussary",
  13: "Saad_Al-Ghamdi",
  14: "Yasser_Ad-Dussary",
  15: "Nasser_Al-Qatami",
};

const wikiPhotoCache: Record<number,string|null> = {};

async function fetchWikiPhoto(id: number): Promise<string|null> {
  if (id in wikiPhotoCache) return wikiPhotoCache[id];
  const title = RECITER_WIKI[id];
  if (!title) { wikiPhotoCache[id] = null; return null; }
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
    if (!res.ok) { wikiPhotoCache[id] = null; return null; }
    const data = await res.json();
    const url = data?.thumbnail?.source ?? null;
    wikiPhotoCache[id] = url;
    return url;
  } catch { wikiPhotoCache[id] = null; return null; }
}

function ReciterAvatar({ id, size=64 }:{ id:number; size?:number }) {
  const m = RECITERS_META[id];
  const [photoUrl, setPhotoUrl] = useState<string|null>(wikiPhotoCache[id] ?? null);
  const [imgOk, setImgOk] = useState(true);

  useEffect(()=>{
    if (photoUrl || id in wikiPhotoCache) return;
    fetchWikiPhoto(id).then(url => { if(url) setPhotoUrl(url); });
  }, [id]);

  if(!m) return null;

  if (!photoUrl || !imgOk) {
    const r = size/2, fs = size*0.32;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`rg${id}`} cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor={m.color1} stopOpacity="1"/>
            <stop offset="100%" stopColor="#050a12" stopOpacity="1"/>
          </radialGradient>
          <filter id={`gl${id}`}>
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>
        <circle cx={r} cy={r} r={r} fill={`url(#rg${id})`}/>
        <circle cx={r} cy={r} r={r-2} fill="none" stroke={m.color2} strokeWidth="0.6" opacity="0.5"/>
        <circle cx={r} cy={r} r={r*0.55} fill="none" stroke={m.color2} strokeWidth="0.4" opacity="0.3"/>
        <text x={r} y={r+fs*0.36} textAnchor="middle"
          fill={m.color2} fontSize={fs} fontFamily="'Noto Naskh Arabic',serif" fontWeight="700"
          filter={`url(#gl${id})`}>
          {m.initials}
        </text>
      </svg>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={m.nameAr}
      width={size}
      height={size}
      style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",objectPosition:"top center",display:"block"}}
      onError={()=>setImgOk(false)}
    />
  );
}


/* ════════ ISLAMIC PATTERN ════════ */
function IslamicPattern({ opacity=0.035 }:{ opacity?:number }) {
  return (
    <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",pointerEvents:"none",
      opacity, zIndex:0, fill:"none", stroke:"currentColor"}} viewBox="0 0 200 200">
      <defs>
        <pattern id="isl" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <polygon points="40,3 77,21 77,59 40,77 3,59 3,21" strokeWidth="0.5"/>
          <polygon points="40,14 66,28 66,52 40,66 14,52 14,28" strokeWidth="0.3"/>
          <circle cx="40" cy="40" r="6" strokeWidth="0.35"/>
          <line x1="40" y1="3" x2="40" y2="14" strokeWidth="0.25"/>
          <line x1="77" y1="21" x2="66" y2="28" strokeWidth="0.25"/>
          <line x1="77" y1="59" x2="66" y2="52" strokeWidth="0.25"/>
          <line x1="40" y1="77" x2="40" y2="66" strokeWidth="0.25"/>
          <line x1="3" y1="59" x2="14" y2="52" strokeWidth="0.25"/>
          <line x1="3" y1="21" x2="14" y2="28" strokeWidth="0.25"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#isl)"/>
    </svg>
  );
}

/* ════════ STARS ════════ */
function Stars({ show }:{ show:boolean }) {
  const [stars,setStars] = useState<any[]>([]);
  useEffect(()=>{
    setStars(Array.from({length:65},(_,i)=>({
      id:i, top:`${Math.random()*100}%`, left:`${Math.random()*100}%`,
      w:Math.random()*2.5+0.5, dur:`${Math.random()*5+2}s`, delay:`${Math.random()*10}s`,
    })));
  },[]);
  if(!show) return null;
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      {stars.map(s=>( <div key={s.id} className="star"
        style={{top:s.top,left:s.left,width:s.w,height:s.w,"--dur":s.dur,"--delay":s.delay} as any}/> ))}
    </div>
  );
}

/* ════════ STEP BAR — segmented pill design ════════ */
function StepBar({ current, maxReached }:{ current:number; maxReached:number }) {
  return (
    <div className="stepbar">
      <div className="sb-track">
        {STEPS.map((s,i)=>{
          const done = maxReached > s.id;
          const active = current === s.id;
          const locked = s.id > maxReached;
          return (
            <div key={s.id} className={`sb-seg${active?" active":done?" done":locked?" locked":""}`}>
              <span className="sb-icon">
                {done ? (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2 6.5L5.2 10L11 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : s.icon}
              </span>
              <span className="sb-lbl">{s.ar}</span>
              {i < STEPS.length-1 && (
                <span className={`sb-sep${(done||active)?" lit":""}`}>›</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════ RECITER CARD ════════ */
function ReciterCard({ r, selected, playing, onClick }:{
  r:any; selected:boolean; playing:boolean; onClick:()=>void
}) {
  const m = RECITERS_META[r.id];
  return (
    <div className={`rc${selected?" sel":""}${playing?" previewing":""}`} onClick={onClick}>
      <div className="rc-avatar-wrap" style={{borderColor: selected?(m?.color2??"var(--gold)"):"transparent"}}>
        <ReciterAvatar id={r.id} size={62}/>
        {selected && !playing && <div className="rc-check">✓</div>}
        {playing && (
          <div className="rc-wave">
            <span/><span/><span/><span/><span/>
          </div>
        )}
      </div>
      <div className="rc-name">{m?.nameAr??r.reciter_name}</div>
      <div className="rc-row">
        <span className="rc-style">{m?.style??"مرتّل"}</span>
        <span className="rc-country">{m?.country??""}</span>
      </div>
      {playing && <div className="rc-preview-lbl">▶ معاينة</div>}
    </div>
  );
}

/* ════════ AYAH RANGE PICKER ════════ */
function AyahRangePicker({ total,min,max,whole,onMin,onMax,onWhole }:{
  total:number;min:number;max:number;whole:boolean;
  onMin:(v:number)=>void;onMax:(v:number)=>void;onWhole:(v:boolean)=>void;
}) {
  const cnt = whole?total:(max-min+1);
  const pct = (whole?100:((cnt/total)*100)).toFixed(1);
  return (
    <div className="arp">
      <div className="arp-toggle-row">
        <button className={`arp-tog${whole?" active":""}`} onClick={()=>onWhole(true)}>السورة كاملة</button>
        <button className={`arp-tog${!whole?" active":""}`} onClick={()=>onWhole(false)}>نطاق مخصص</button>
      </div>
      {!whole && (
        <div className="arp-selects">
          <div className="arp-field">
            <label>من الآية</label>
            <div className="arp-sw">
              <select className="arp-sel" value={min}
                onChange={e=>{const v=+e.target.value;onMin(v);if(v>max)onMax(v);}}>
                {Array.from({length:total},(_,i)=>i+1).map(n=>(
                  <option key={n} value={n}>آية {toAr(n)}</option>
                ))}
              </select>
              <span className="arp-arr">▾</span>
            </div>
          </div>
          <span className="arp-dash">←</span>
          <div className="arp-field">
            <label>إلى الآية</label>
            <div className="arp-sw">
              <select className="arp-sel" value={max}
                onChange={e=>{const v=+e.target.value;onMax(v);if(v<min)onMin(v);}}>
                {Array.from({length:total},(_,i)=>i+1).filter(n=>n>=min).map(n=>(
                  <option key={n} value={n}>آية {toAr(n)}</option>
                ))}
              </select>
              <span className="arp-arr">▾</span>
            </div>
          </div>
        </div>
      )}
      <div className="arp-bar-wrap">
        <div className="arp-bar">
          <div className="arp-fill" style={{
            left:`${whole?0:((min-1)/total)*100}%`,
            width:`${whole?100:((cnt/total)*100)}%`
          }}/>
          {total<=80 && Array.from({length:total},(_,i)=>i+1).map(n=>(
            <div key={n} className={`arp-tick${(whole||(n>=min&&n<=max))?" in":""}`}
              style={{left:`${((n-0.5)/total)*100}%`}}/>
          ))}
        </div>
        <div className="arp-blabels">
          <span>١</span>
          <span className="arp-binfo">{whole?`كاملة · ${toAr(total)} آية`:`${toAr(min)}←${toAr(max)} · ${toAr(cnt)} آية (${pct}%)`}</span>
          <span>{toAr(total)}</span>
        </div>
      </div>
      <div className="arp-summary">
        <div className="arp-sc"><span>من</span><strong>{toAr(whole?1:min)}</strong></div>
        <div className="arp-sc"><span>إلى</span><strong>{toAr(whole?total:max)}</strong></div>
        <div className="arp-sc"><span>المجموع</span><strong>{toAr(cnt)} آية</strong></div>
      </div>
    </div>
  );
}

/* ════════ TAFSIR PANEL — التفسير الميسر ════════ */


const TAFSIR_CDN = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/ar-tafsir-muyassar";

const tafsirCache: Record<string,string> = {};

function TafsirPanel({ surahNum, ayahNum, autoLoad=false, onToggle }:{
  surahNum:number; ayahNum:number; autoLoad?:boolean; onToggle?:(open:boolean)=>void;
}) {
  const key = `${surahNum}:${ayahNum}`;
  const [text,setText] = useState<string|null>(tafsirCache[key]??null);
  const [loading,setLoading] = useState(false);
  const [open,setOpen] = useState(false);

  const load = useCallback(async()=>{
    if(tafsirCache[key]){ setText(tafsirCache[key]); setOpen(true); onToggle?.(true); return; }
    setLoading(true); setOpen(true); onToggle?.(true);
    try {
      const res = await fetch(`${TAFSIR_CDN}/${surahNum}/${ayahNum}.json`);
      if(!res.ok) throw new Error("failed");
      const d = await res.json();
      const t = d?.text ?? d?.tafsir ?? "—";
      tafsirCache[key] = t;
      setText(t);
    } catch { setText("تعذّر تحميل التفسير، يرجى المحاولة لاحقاً."); }
    setLoading(false);
  },[key,surahNum,ayahNum]);

  // auto-trigger on mount and whenever ayahNum changes while tafsir is open
  useEffect(()=>{ if(autoLoad) load(); },[ayahNum, autoLoad]);

  if(!open) return (
    <button className="tf-trigger" onClick={load}>
      <span>📚</span> التفسير الميسر
    </button>
  );

  return (
    <div className="tf-panel">
      <div className="tf-header">
        <span>📚 التفسير الميسر — آية {toAr(ayahNum)}</span>
        <button className="tf-close" onClick={()=>{ setOpen(false); onToggle?.(false); }}>✕</button>
      </div>
      {loading
        ? <div className="tf-loading"><span className="mq-spin"/>جارٍ تحميل التفسير...</div>
        : <p className="tf-text">{text}</p>
      }
      <p className="tf-source">التفسير الميسر — نخبة من العلماء · jsDelivr CDN</p>
    </div>
  );
}

/* ════════ MAQASID PANEL — Google Gemini 2.0 Flash (مجاني) ════════ */
const maqasidCache: Record<string,MaqasidData> = {};
let _geminiKey = "";

function MaqasidPanel({ surahNum, surahName, ayahNum, ayahText }:{
  surahNum:number; surahName:string; ayahNum:number; ayahText:string;
}) {
  const cacheKey = `${surahNum}:${ayahNum}`;
  const [data,setData] = useState<MaqasidData|null>(maqasidCache[cacheKey]??null);
  const [loading,setLoading] = useState(false);
  const [open,setOpen] = useState(false);
  const [apiKey,setApiKey] = useState(_geminiKey);
  const [keyInput,setKeyInput] = useState("");
  const [keyError,setKeyError] = useState("");

  const doFetch = useCallback(async(k:string)=>{
    if(maqasidCache[cacheKey]){ setData(maqasidCache[cacheKey]); setOpen(true); return; }
    setLoading(true); setOpen(true); setKeyError("");
    const prompt = `أنت عالم إسلامي في التفسير ومقاصد الشريعة. حلّل هذه الآية:
السورة: ${surahName} (${surahNum}) — الآية ${ayahNum}: ${ayahText}
أجب بـ JSON فقط، بدون أي نص خارجه:
{"meaning":"معنى الآية في جملتين","maqsad":"المقصد الشرعي الرئيسي","fa2ida":"الفائدة العملية للمسلم","asbab":"سبب النزول إن وُجد وإلا: لم يُذكر سبب نزول خاص","topic":"الموضوع في كلمتين"}`;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${k}`,
        { method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ contents:[{parts:[{text:prompt}]}],
            generationConfig:{ responseMimeType:"application/json", maxOutputTokens:600 } }) }
      );
      const d = await res.json();
      if(!res.ok){
        setKeyError(res.status===400||res.status===403
          ? "مفتاح API غير صالح — تأكد من نسخه بشكل صحيح"
          : d?.error?.message??"خطأ في الاتصال");
        setLoading(false); return;
      }
      const raw = d?.candidates?.[0]?.content?.parts?.[0]?.text??"{}";
      const parsed:MaqasidData = { ayah:ayahNum, ...JSON.parse(raw.replace(/```json|```/g,"").trim()) };
      maqasidCache[cacheKey] = parsed;
      setData(parsed);
    } catch { setKeyError("تعذّر الاتصال — تحقق من اتصال الإنترنت"); }
    setLoading(false);
  },[cacheKey,surahName,surahNum,ayahNum,ayahText]);

  const submit = ()=>{
    const k=keyInput.trim();
    if(!k){ setKeyError("الرجاء إدخال مفتاح API"); return; }
    _geminiKey=k; setApiKey(k); setKeyInput(""); doFetch(k);
  };

  if(!open) return (
    <button className="mq-trigger" onClick={()=>apiKey?doFetch(apiKey):setOpen(true)}>
      🌙 المقاصد والفوائد
    </button>
  );

  return (
    <div className="mq-panel">
      <div className="mq-hdr">
        <span className="mq-title">🌙 مقاصد الآية {toAr(ayahNum)}</span>
        <button className="mq-x" onClick={()=>setOpen(false)}>✕</button>
      </div>

      {/* Key entry */}
      {!apiKey && !loading && !data && (
        <div className="mq-keybox">
          <p className="mq-keyinfo">
            تستخدم هذه الميزة <strong>Google Gemini</strong> — مجاني تماماً.{" "}
            احصل على مفتاحك من{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="mq-a">
              aistudio.google.com ↗
            </a>
          </p>
          <div className="mq-keyrow">
            <input className="mq-kinput" type="password" dir="ltr" placeholder="AIzaSy..."
              value={keyInput} onChange={e=>setKeyInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&submit()}/>
            <button className="mq-kbtn" onClick={submit}>تحليل</button>
          </div>
          {keyError&&<p className="mq-kerr">{keyError}</p>}
        </div>
      )}

      {loading&&<div className="mq-loading"><span className="spin"/>جارٍ التحليل الشرعي بـ Gemini...</div>}

      {keyError&&apiKey&&!loading&&(
        <div className="mq-keybox">
          <p className="mq-kerr">{keyError}</p>
          <button className="mq-kbtn" style={{marginTop:8}}
            onClick={()=>{ _geminiKey=""; setApiKey(""); setKeyError(""); }}>
            تغيير المفتاح
          </button>
        </div>
      )}

      {data&&!loading&&(
        <div className="mq-body">
          <div className="mq-row mq-topic">
            <span className="mq-badge">الموضوع</span>
            <strong className="mq-topicval">{data.topic}</strong>
          </div>
          <div className="mq-row">
            <span className="mq-badge">المعنى</span>
            <p className="mq-txt">{data.meaning}</p>
          </div>
          <div className="mq-row">
            <span className="mq-badge mq-b2">المقصد الشرعي</span>
            <p className="mq-txt">{data.maqsad}</p>
          </div>
          <div className="mq-row">
            <span className="mq-badge mq-b3">الفائدة العملية</span>
            <p className="mq-txt">{data.fa2ida}</p>
          </div>
          {data.asbab&&(
            <div className="mq-row">
              <span className="mq-badge mq-b4">سبب النزول</span>
              <p className="mq-txt">{data.asbab}</p>
            </div>
          )}
          <p className="mq-src">مدعوم بـ Google Gemini 2.0 Flash</p>
        </div>
      )}
    </div>
  );
}

/* ════════ QURAN TEXT PANEL ════════ */
function QuranTextPanel({ ayahs, surahNum, surahName, activeAyah, onAyahClick }:{
  ayahs:AyahText[]; surahNum:number; surahName:string;
  activeAyah:number|null; onAyahClick?:(n:number)=>void;
}) {
  const [selectedAyah,setSelectedAyah] = useState<number|null>(null);
  const [tafsirWasOpen,setTafsirWasOpen] = useState(false);
  const activeRef = useRef<HTMLSpanElement|null>(null);

  useEffect(()=>{ activeRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"}); },[activeAyah]);

  if(!ayahs.length) return null;

  const handleClick = (n:number)=>{
    setSelectedAyah(selectedAyah===n?null:n);
    onAyahClick?.(n);
  };

  return (
    <div className="qtext-outer">
      <div className="qtext-wrap">
        <p className="qtext">
          {ayahs.map(a=>(
            <span key={a.numberInSurah}
              ref={a.numberInSurah===activeAyah?activeRef:null}
              className={`qayah${a.numberInSurah===activeAyah?" playing":""}${a.numberInSurah===selectedAyah?" selected":""}`}
              onClick={()=>handleClick(a.numberInSurah)}
            >
              {a.text}
              <span className="qnum">{String.fromCodePoint(0x06DD)}{toAr(a.numberInSurah)}</span>
              {" "}
            </span>
          ))}
        </p>
      </div>

      {/* Ayah detail drawer */}
      {selectedAyah && (
        <div className="ayah-drawer">
          <div className="ayah-drawer-header">
            <span className="ayah-drawer-num">آية {toAr(selectedAyah)}</span>
            <button className="ayah-drawer-close" onClick={()=>setSelectedAyah(null)}>✕</button>
          </div>
          <div className="ayah-actions">
            <TafsirPanel
              key={selectedAyah}
              surahNum={surahNum} ayahNum={selectedAyah}
              autoLoad={tafsirWasOpen}
              onToggle={setTafsirWasOpen}
            />
            <MaqasidPanel surahNum={surahNum} surahName={surahName}
              ayahNum={selectedAyah}
              ayahText={ayahs.find(a=>a.numberInSurah===selectedAyah)?.text??""}/>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════ SYNCED PLAYER ════════ */
function SyncPlayer({ url, filename, sizeKb, timings, onAyahChange, onSeekToAyah }:{
  url:string; filename:string; sizeKb:number|null;
  timings:AyahTiming[];
  onAyahChange:(n:number|null)=>void;
  onSeekToAyah:(fn:(ayah:number)=>void)=>void;
}) {
  const aRef = useRef<HTMLAudioElement|null>(null);
  const cvRef = useRef<HTMLCanvasElement|null>(null);
  const bars = useRef<number[]>([]);
  const [playing,setPlaying]=useState(false);
  const [cur,setCur]=useState(0);
  const [dur,setDur]=useState(0);
  const [vol,setVol]=useState(1);
  const [curIdx,setCurIdx]=useState(0);

  const draw = useCallback((pct:number)=>{
    const cv=cvRef.current;if(!cv)return;
    const ctx=cv.getContext("2d");if(!ctx)return;
    const W=cv.offsetWidth,H=cv.offsetHeight;cv.width=W;cv.height=H;
    ctx.clearRect(0,0,W,H);
    const B=bars.current,bw=W/B.length-1,pi=Math.floor(pct*B.length);
    B.forEach((h,i)=>{
      const x=i*(bw+1),bh=h*H*.82,y=(H-bh)/2,r=2;
      ctx.fillStyle=i<=pi?`rgba(201,168,76,${.5+h*.5})`:`rgba(100,120,140,${.15+h*.12})`;
      ctx.beginPath();
      ctx.moveTo(x+r,y);ctx.lineTo(x+bw-r,y);ctx.quadraticCurveTo(x+bw,y,x+bw,y+r);
      ctx.lineTo(x+bw,y+bh-r);ctx.quadraticCurveTo(x+bw,y+bh,x+bw-r,y+bh);
      ctx.lineTo(x+r,y+bh);ctx.quadraticCurveTo(x,y+bh,x,y+bh-r);
      ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
      ctx.closePath();ctx.fill();
    });
    if(timings.length>1&&dur>0){
      timings.slice(1).forEach(t=>{
        const mx=Math.floor((t.start_ms/1000/dur)*W);
        ctx.strokeStyle="rgba(201,168,76,0.4)";ctx.lineWidth=1;
        ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(mx,4);ctx.lineTo(mx,H-4);ctx.stroke();
        ctx.setLineDash([]);
      });
    }
  },[timings,dur]);

  useEffect(()=>{ bars.current=Array.from({length:130},()=>0.1+Math.random()*.9); setTimeout(()=>draw(0),60); },[url]);

  const getActiveIdx=useCallback((s:number)=>{
    if(!timings.length)return 0;
    const ms=s*1000;
    for(let i=timings.length-1;i>=0;i--){if(ms>=timings[i].start_ms)return i;}
    return 0;
  },[timings]);

  useEffect(()=>{
    const a=new Audio(url);aRef.current=a;a.volume=vol;
    a.onloadedmetadata=()=>setDur(a.duration);
    a.ontimeupdate=()=>{
      const t=a.currentTime,d=a.duration||1;setCur(t);draw(t/d);
      const idx=getActiveIdx(t);
      if(idx!==curIdx){setCurIdx(idx);onAyahChange(timings[idx]?.ayah??null);}
    };
    a.onended=()=>{setPlaying(false);setCur(0);draw(0);onAyahChange(null);};
    return()=>{a.pause();a.src="";};
  },[url,timings]);

  useEffect(()=>{
    onSeekToAyah((n:number)=>{
      const a=aRef.current;if(!a)return;
      const t=timings.find(t=>t.ayah===n);
      if(t){a.currentTime=t.start_ms/1000;if(!playing){a.play();setPlaying(true);}}
    });
  },[timings,playing]);

  const toggle=()=>{const a=aRef.current;if(!a)return;playing?a.pause():a.play();setPlaying(!playing);};
  const skip=(s:number)=>{const a=aRef.current;if(a)a.currentTime=Math.max(0,Math.min(a.duration,a.currentTime+s));};
  const seek=(e:React.MouseEvent<HTMLDivElement>)=>{
    const a=aRef.current;if(!a||!a.duration)return;
    const rc=e.currentTarget.getBoundingClientRect();
    a.currentTime=((e.clientX-rc.left)/rc.width)*a.duration;
  };
  const fmt=(s:number)=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;
  const pct=dur>0?(cur/dur)*100:0;

  return (
    <div className="splayer">
      <div className="sp-meta"><span className="sp-fname">{filename}</span>{sizeKb&&<span className="sp-size">{sizeKb} KB</span>}</div>
      <div className="sp-wf" onClick={seek}>
        <div className="sp-prog" style={{width:`${pct}%`}}/>
        <canvas ref={cvRef} className="sp-cv"/>
        <div className="sp-cursor" style={{left:`${pct}%`}}/>
      </div>
      <div className="sp-time"><span dir="ltr">{fmt(cur)}</span><span dir="ltr">{fmt(dur)}</span></div>
      <div className="sp-ctrl">
        <button className="sp-skip" onClick={()=>skip(-10)}>«&nbsp;١٠ث</button>
        <button className="sp-play" onClick={toggle}>{playing?"⏸":"▶"}</button>
        <button className="sp-skip" onClick={()=>skip(10)}>١٠ث&nbsp;»</button>
      </div>
      <div className="sp-vol">
        <span>🔊</span>
        <input type="range" min={0} max={1} step={0.05} value={vol} className="sp-vrange"
          onChange={e=>{setVol(+e.target.value);if(aRef.current)aRef.current.volume=+e.target.value;}}/>
        <span style={{fontSize:".68rem",color:"var(--textD)"}}>{Math.round(vol*100)}%</span>
      </div>
      {timings.length>1&&(
        <div className="sp-jumps">
          <div className="sp-jlbl">انتقل إلى آية</div>
          <div className="sp-jbtns">
            {timings.map((t,i)=>(
              <button key={t.ayah} className={`sp-jbtn${i===curIdx?" active":""}`}
                onClick={()=>{const a=aRef.current;if(!a)return;a.currentTime=t.start_ms/1000;if(!playing){a.play();setPlaying(true);}}}>
                {toAr(t.ayah)}
              </button>
            ))}
          </div>
        </div>
      )}
      <a href={url} download={filename} className="sp-dl">⬇ تحميل الملف الصوتي</a>
    </div>
  );
}

/* ════════ PROGRESS ════════ */
function ProgressPanel({ gen }:{ gen:ReturnType<typeof useAudioGenerator> }) {
  const {status,total,downloaded,percent,ayahs}=gen;
  const msgs:Record<string,string>={connecting:"جارٍ الاتصال...",resolving:"جارٍ التحليل...",downloading:`جارٍ التحميل ${percent}%`,merging:"دمج الملفات..."};
  const done=status==="done",err=status==="error";
  return (
    <div className="prog-panel">
      <div className="prog-head">
        <div className={`prog-status${done?" done":err?" err":""}`}>
          {!done&&!err&&<span className="pulse-dot"/>}
          {done?"✓ اكتمل":err?"✕ خطأ":(msgs[status]??status)}
        </div>
        {total>0&&!done&&<span className="prog-cnt">{downloaded}/{total}</span>}
      </div>
      {!err&&<div className="prog-bg"><div className={`prog-bar${done?" done":""}`} style={{width:`${done?100:status==="merging"?96:percent}%`}}/></div>}
      {ayahs.length>0&&<>
        <div className="prog-dots">{ayahs.map(a=><div key={a.index} className={`prog-dot ${a.status}`} title={`آية ${a.ayah}`}/>)}</div>
        <div className="prog-leg">
          <span><i className="ld ok"/>موفق ({ayahs.filter(a=>a.status==="ok").length})</span>
          <span><i className="ld fallback"/>بديل ({ayahs.filter(a=>a.status==="fallback").length})</span>
          {ayahs.filter(a=>a.status==="failed").length>0&&<span><i className="ld failed"/>فشل</span>}
        </div>
      </>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════ */
export default function Home() {
  const [dark,setDark]=useState(true);
  const [reciters,setReciters]=useState<any[]>([]);
  const [surahs,setSurahs]=useState<any[]>([]);
  const [ayahTexts,setAyahTexts]=useState<AyahText[]>([]);
  const [loadingText,setLoadingText]=useState(false);
  const [step,setStep]=useState(1);
  const [maxStep,setMaxStep]=useState(1);
  const [dir,setDir]=useState<"fwd"|"bwd">("fwd");
  const [selR,setSelR]=useState<number|null>(null);
  const [selS,setSelS]=useState<any|null>(null);
  const [whole,setWhole]=useState(true);
  const [aMin,setAMin]=useState(1);
  const [aMax,setAMax]=useState(7);
  const [search,setSearch]=useState("");
  const [activeAyah,setActiveAyah]=useState<number|null>(null);
  const [previewingId,setPreviewingId]=useState<number|null>(null);
  const seekRef=useRef<((n:number)=>void)|null>(null);
  const previewRef=useRef<HTMLAudioElement|null>(null);
  const previewTimerRef=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const gen=useAudioGenerator();

  // Apply theme to <html> so body background inherits CSS vars
  useEffect(()=>{
    document.documentElement.className = dark ? "dark" : "light";
  },[dark]);

  useEffect(()=>{
    fetch(`${API}/recitations`).then(r=>r.json()).then(setReciters).catch(()=>{});
    fetch(`${API}/surahs`).then(r=>r.json()).then(setSurahs).catch(()=>{});
  },[]);

  // Stop preview when leaving step 1
  useEffect(()=>{ if(step!==1) stopPreview(); },[step]);

  const stopPreview = ()=>{
    if(previewRef.current){ previewRef.current.pause(); previewRef.current.src=""; previewRef.current=null; }
    clearTimeout(previewTimerRef.current);
    setPreviewingId(null);
  };

  const playPreview = (id:number)=>{
    stopPreview();
    const audio = new Audio(previewUrl(id));
    audio.volume = 0.85;
    previewRef.current = audio;
    setPreviewingId(id);
    audio.play().catch(()=>setPreviewingId(null));
    audio.onended = ()=>setPreviewingId(null);
    // Auto-stop after 5s max
    previewTimerRef.current = setTimeout(()=>{
      audio.pause(); audio.src=""; setPreviewingId(null);
    }, 5000);
  };

  const handleSelectReciter = (id:number)=>{
    setSelR(id);
    playPreview(id);
  };

  useEffect(()=>{ if(selS){setAMin(1);setAMax(Math.min(7,selS.verses_count));} },[selS]);

  const fetchText=useCallback(async(surahNum:number,min:number,max:number)=>{
    setLoadingText(true);
    try {
      const res=await fetch(`${QURAN_TEXT_API}/surah/${surahNum}/quran-uthmani`);
      const data=await res.json();
      const all:AyahText[]=data.data.ayahs;
      setAyahTexts(all.filter(a=>a.numberInSurah>=min&&a.numberInSurah<=max));
    } catch{setAyahTexts([]);}
    finally{setLoadingText(false);}
  },[]);

  const goTo=(s:number)=>{setDir(s<step?"bwd":"fwd");setStep(s);if(s>maxStep)setMaxStep(s);};
  const confirmRange=()=>{fetchText(selS!.id,whole?1:aMin,whole?(selS?.verses_count??1):aMax);goTo(4);};
  const handleGenerate=()=>{
    setActiveAyah(whole?1:aMin);
    gen.generate({recitation_id:selR!,surah_number:selS!.id,whole_surah:whole,
      ayah_min:whole?undefined:aMin,ayah_max:whole?undefined:aMax}).catch(()=>{});
  };
  const handleReset=()=>{
    gen.reset();setStep(1);setMaxStep(1);
    setSelR(null);setSelS(null);setAyahTexts([]);setActiveAyah(null);setSearch("");
  };

  const filtered=useMemo(()=>
    surahs.filter(s=>s.name_arabic.includes(search)||
      s.name_simple.toLowerCase().includes(search.toLowerCase())||
      String(s.id).includes(search)),[surahs,search]);

  const dMin=whole?1:aMin, dMax=whole?(selS?.verses_count??1):aMax;

  return (
    <div className={`app${dark?" dark":" light"}`}>
      <Stars show={dark}/>
      <IslamicPattern opacity={dark?0.032:0.05}/>

      {/* HEADER */}
      <header className="hdr">
        <div className="hdr-inner">
          <button className="theme-btn" onClick={()=>setDark(!dark)} title="تبديل المظهر">
            {dark?"☀️":"🌙"}
          </button>
          <div className="hdr-center">
            <div className="hdr-orn">
              <svg viewBox="0 0 260 30" width="240" height="28">
                <g stroke="currentColor" fill="none" strokeWidth="0.7" opacity="0.6">
                  <line x1="0" y1="15" x2="85" y2="15"/>
                  <line x1="175" y1="15" x2="260" y2="15"/>
                  <path d="M85,15 C100,2 120,2 130,2 C140,2 160,2 175,15"/>
                  <circle cx="130" cy="15" r="4" fill="currentColor" opacity="0.4"/>
                  <circle cx="50" cy="15" r="2" fill="currentColor" opacity="0.35"/>
                  <circle cx="210" cy="15" r="2" fill="currentColor" opacity="0.35"/>
                  <path d="M130,2 L133,10 L142,10 L135,15 L138,24 L130,19 L122,24 L125,15 L118,10 L127,10 Z" strokeWidth="0.4" opacity="0.3"/>
                </g>
              </svg>
            </div>
            <h1 className="hdr-title">مُصحف الصوت</h1>
            <p className="hdr-sub">استمع إلى القرآن الكريم بأصوات كبار القراء</p>
            <div className="hdr-orn" style={{opacity:.4,transform:"scaleY(-1)"}}>
              <svg viewBox="0 0 260 20" width="240" height="16">
                <g stroke="currentColor" fill="none" strokeWidth="0.6" opacity="0.7">
                  <line x1="0" y1="10" x2="90" y2="10"/>
                  <line x1="170" y1="10" x2="260" y2="10"/>
                  <path d="M90,10 C105,2 120,2 130,2 C140,2 155,2 170,10"/>
                  <circle cx="130" cy="10" r="2.5" fill="currentColor" opacity="0.4"/>
                </g>
              </svg>
            </div>
          </div>
          <div style={{width:42}}/>
        </div>
      </header>

      {/* STEP BAR */}
      <div className="sb-wrap">
        <StepBar current={step} maxReached={maxStep}/>
      </div>

      {/* WIZARD */}
      <main className="wizard">

        {/* STEP 1 */}
        {step===1&&(
          <div className={`wcard slide-${dir}`}>
            <div className="wcard-hdr"><span className="wcard-icon">🎙️</span>
              <div><div className="wcard-title">اختر القارئ</div>
                <div className="wcard-sub">اختر صوتًا من أجمل أصوات تلاوة القرآن الكريم</div></div>
            </div>
            <div className="wcard-body">
              <div className="rg">
                {reciters.map(r=><ReciterCard key={r.id} r={r} selected={selR===r.id} playing={previewingId===r.id} onClick={()=>handleSelectReciter(r.id)}/>)}
              </div>
            </div>
            <div className="wcard-footer">
              <div/>
              <button className="btn-next" disabled={!selR} onClick={()=>goTo(2)}>التالي ← اختر السورة</button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step===2&&(
          <div className={`wcard slide-${dir}`}>
            <div className="wcard-hdr"><span className="wcard-icon">📖</span>
              <div><div className="wcard-title">اختر السورة</div>
                <div className="wcard-sub">القارئ: <strong>{RECITERS_META[selR!]?.nameAr}</strong></div></div>
            </div>
            <div className="wcard-body">
              <div className="search-wrap">
                <span className="si-icon">🔍</span>
                <input className="srch" placeholder="ابحث بالاسم أو الرقم..." value={search} onChange={e=>setSearch(e.target.value)}/>
                {search&&<button className="srch-x" onClick={()=>setSearch("")}>✕</button>}
              </div>
              <div className="sg">
                {filtered.map((s,i)=>(
                  <div key={s.id} className={`si${selS?.id===s.id?" sel":""}`} style={{"--idx":i} as any} onClick={()=>setSelS(s)}>
                    <span className="si-n">{toAr(s.id)}</span>
                    <div className="si-body"><span className="si-ar">{s.name_arabic}</span>
                      <span className="si-en">{s.translated_name} · {toAr(s.verses_count)} آية</span></div>
                    <span className={`si-bdg${s.revelation_place==="makkah"?" mk":" md"}`}>
                      {s.revelation_place==="makkah"?"مكية":"مدنية"}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="wcard-footer">
              <button className="btn-prev" onClick={()=>goTo(1)}>→ السابق</button>
              <button className="btn-next" disabled={!selS} onClick={()=>goTo(3)}>التالي ← حدد الآيات</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step===3&&(
          <div className={`wcard slide-${dir}`}>
            <div className="wcard-hdr"><span className="wcard-icon">🔢</span>
              <div><div className="wcard-title">نطاق الآيات</div>
                <div className="wcard-sub">سورة <strong>{selS?.name_arabic}</strong> — {toAr(selS?.verses_count??0)} آية</div></div>
            </div>
            <div className="wcard-body">
              <AyahRangePicker total={selS?.verses_count??0} min={aMin} max={aMax} whole={whole}
                onMin={setAMin} onMax={setAMax} onWhole={setWhole}/>
            </div>
            <div className="wcard-footer">
              <button className="btn-prev" onClick={()=>goTo(2)}>→ السابق</button>
              <button className="btn-next" onClick={confirmRange}>تأكيد ← استمع الآن</button>
            </div>
          </div>
        )}

        {/* STEP 4 — Listen + Tafsir + Maqasid */}
        {step===4&&(
          <div className={`wcard wide slide-${dir}`}>
            <div className="wcard-hdr">
              <span className="wcard-icon">🎧</span>
              <div>
                <div className="wcard-title">الاستماع والتدبر</div>
                <div className="wcard-sub">
                  {selS?.name_arabic} · {RECITERS_META[selR!]?.nameAr} · آية {toAr(dMin)}–{toAr(dMax)}
                </div>
              </div>
              <button className="btn-edit" onClick={()=>goTo(1)}>✏ تعديل</button>
            </div>

            <div className="listen-layout">
              {/* LEFT: Quran text + tafsir */}
              <div className="qtext-col">
                <div className="qtext-hdr">
                  <span>النص القرآني</span>
                  {activeAyah&&<span className="active-badge"><span className="active-dot"/>الآية {toAr(activeAyah)}</span>}
                </div>
                {loadingText
                  ? <div className="qloading"><span className="mq-spin"/>جارٍ تحميل النص...</div>
                  : <QuranTextPanel
                      ayahs={ayahTexts} surahNum={selS?.id??1} surahName={selS?.name_arabic??""}
                      activeAyah={activeAyah}
                      onAyahClick={(n)=>{ setActiveAyah(n); seekRef.current?.(n); }}/>
                }
                {!loadingText&&ayahTexts.length>0&&(
                  <div className="qtext-hint">✦ انقر على أي آية للتدبر والتفسير والمقاصد</div>
                )}
              </div>

              {/* RIGHT: Player */}
              <div className="player-col">
                {gen.status==="idle"&&(
                  <div className="gen-idle">
                    <div className="gen-summary">
                      <div className="gs-row"><span>القارئ</span><strong>{RECITERS_META[selR!]?.nameAr}</strong></div>
                      <div className="gs-row"><span>الرواية</span><strong>{RECITERS_META[selR!]?.style}</strong></div>
                      <div className="gs-row"><span>البلد</span><strong>{RECITERS_META[selR!]?.country}</strong></div>
                      <div className="gs-row"><span>السورة</span><strong>{selS?.name_arabic}</strong></div>
                      <div className="gs-row"><span>الآيات</span><strong>{toAr(dMin)} – {toAr(dMax)}</strong></div>
                      <div className="gs-row"><span>العدد</span><strong>{toAr(dMax-dMin+1)} آية</strong></div>
                    </div>
                    <button className="btn-gen" onClick={handleGenerate}><span>▶</span> توليد الملف الصوتي</button>
                    <button className="btn-prev" onClick={()=>goTo(3)} style={{marginTop:8,width:"100%",textAlign:"center"}}>→ العودة للتعديل</button>
                  </div>
                )}
                {gen.status!=="idle"&&gen.status!=="done"&&(
                  <div><ProgressPanel gen={gen}/>
                    {gen.status==="error"&&<button className="btn-prev" onClick={gen.reset} style={{marginTop:12,width:"100%"}}>↺ إعادة</button>}
                  </div>
                )}
                {gen.status==="done"&&gen.downloadUrl&&(
                  <SyncPlayer url={gen.downloadUrl} filename={gen.filename??"quran.mp3"} sizeKb={gen.sizeKb}
                    timings={gen.timings} onAyahChange={setActiveAyah}
                    onSeekToAyah={fn=>{seekRef.current=fn;}}/>
                )}
                {gen.status==="done"&&<button className="btn-reset" onClick={handleReset}>↺ جلسة جديدة</button>}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-orn">✦ ✦ ✦</div>
        <p className="footer-copy">© {new Date().getFullYear()} <strong>Noureddine Achibane</strong> — جميع الحقوق محفوظة</p>
        <p className="footer-sub">
          النص القرآني من <span className="fl">alquran.cloud</span> ·
          الصوت من <span className="fl">everyayah.com</span> ·
          التفسير الميسر من <span className="fl">jsDelivr CDN</span>
        </p>
        <p className="footer-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
      </footer>

{/* ═══════════════════ STYLES ═══════════════════ */}
<style>{`
@import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Amiri:wght@400;700&display=swap');
@font-face{font-family:'UthmanicHafs';src:url('https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2') format('woff2');font-display:swap}
/* extra vars not in globals */
:root{--fq:'UthmanicHafs','Scheherazade New','Traditional Arabic',serif;--r:16px;--r8:8px;--r24:24px;--trans:.28s}
.star{position:absolute;background:var(--gold3);border-radius:50%;opacity:0;animation:tw var(--dur,3s) var(--delay,0s) infinite ease-in-out}
@keyframes tw{0%,100%{opacity:0;transform:scale(.3)}50%{opacity:.55;transform:scale(1)}}
svg.pattern-bg,svg[style*="fixed"]{color:var(--pat-color)}
.app{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column}

/* HEADER */
.hdr{background:var(--hdr-bg);backdrop-filter:blur(16px) saturate(1.4);border-bottom:1px solid var(--border);z-index:10;position:relative}
.hdr-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:22px 28px 18px;gap:16px}
.hdr-center{text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;gap:3px}
.hdr-orn{color:var(--gold)}
.hdr-title{font-family:var(--ff);font-size:clamp(1.8rem,4vw,3rem);font-weight:700;color:var(--gold2);text-shadow:0 0 40px rgba(201,168,76,.22),0 2px 0 rgba(0,0,0,.3);line-height:1.1}
.light .hdr-title{text-shadow:0 1px 2px rgba(255,255,255,.6);color:var(--gold2)}
.hdr-sub{font-size:.78rem;color:var(--textD)}
.theme-btn{background:var(--bg3);border:1px solid var(--border);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;cursor:pointer;flex-shrink:0;transition:all .25s}
.theme-btn:hover{border-color:var(--gold);transform:rotate(20deg) scale(1.1)}

/* STEP BAR — segmented pill */
.sb-wrap{position:sticky;top:0;z-index:20;background:var(--hdr-bg);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:10px 24px}
.stepbar{display:flex;justify-content:center}
.sb-track{display:inline-flex;align-items:center;background:var(--bg3);border:1px solid var(--border);border-radius:40px;padding:4px;gap:0;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.sb-seg{display:flex;align-items:center;gap:6px;padding:7px 16px;border-radius:32px;font-size:.78rem;color:var(--textD);transition:all .28s;user-select:none;white-space:nowrap}
.sb-seg.active{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#fff;font-weight:700;box-shadow:0 3px 12px rgba(201,168,76,.3)}
.dark .sb-seg.active{color:#0d1826}
.sb-seg.done{color:var(--teal2);font-weight:500}
.sb-seg.locked{opacity:.4}
.sb-icon{font-size:.85rem;line-height:1;display:flex;align-items:center}
.sb-sep{color:var(--border2);font-size:.8rem;margin:0 -4px;flex-shrink:0;transition:color .3s;opacity:.6}
.sb-sep.lit{color:var(--gold);opacity:1}

/* WIZARD */
.wizard{flex:1;display:flex;justify-content:center;align-items:flex-start;padding:28px 16px 100px}
@keyframes sFwd{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:translateX(0)}}
@keyframes sBwd{from{opacity:0;transform:translateX(-48px)}to{opacity:1;transform:translateX(0)}}
.slide-fwd{animation:sFwd .32s cubic-bezier(.22,.68,0,1.2) both}
.slide-bwd{animation:sBwd .32s cubic-bezier(.22,.68,0,1.2) both}

/* CARD */
.wcard{width:100%;max-width:720px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r24);overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.3),0 0 40px rgba(201,168,76,.08);transition:background var(--trans)}
.light .wcard{box-shadow:0 4px 24px rgba(90,69,32,.12),0 1px 4px rgba(0,0,0,.06)}
.wcard.wide{max-width:1120px}
.wcard-hdr{display:flex;align-items:center;gap:14px;padding:20px 26px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(201,168,76,.06),transparent 60%);position:relative}
.wcard-hdr::before{content:'';position:absolute;top:0;right:0;left:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.35}
.wcard-icon{font-size:1.9rem;flex-shrink:0}
.wcard-title{font-size:1.05rem;font-weight:700;color:var(--gold2);margin-bottom:3px}
.light .wcard-title{color:var(--gold2)}
.wcard-sub{font-size:.75rem;color:var(--textD)}.wcard-sub strong{color:var(--teal3)}
.wcard-body{padding:22px 26px;max-height:calc(100vh - 330px);overflow-y:auto}
.wcard-footer{display:flex;justify-content:space-between;align-items:center;padding:14px 26px;border-top:1px solid var(--border);background:rgba(0,0,0,.04)}
.light .wcard-footer{background:rgba(90,69,32,.03)}
.btn-edit{background:none;border:1px solid var(--border);border-radius:20px;color:var(--gold);font-family:var(--ff);font-size:.72rem;padding:5px 14px;cursor:pointer;transition:all .2s;margin-right:auto}
.btn-edit:hover{background:rgba(201,168,76,.1);border-color:var(--gold)}

/* BUTTONS */
.btn-next{background:linear-gradient(135deg,var(--teal),var(--teal2));border:none;border-radius:10px;color:#fff;font-family:var(--ff);font-size:.9rem;font-weight:600;padding:11px 22px;cursor:pointer;transition:all .25s;box-shadow:0 4px 14px rgba(42,157,143,.25)}
.btn-next:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(42,157,143,.4)}
.btn-next:disabled{opacity:.28;cursor:not-allowed}
.btn-prev{background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--textD);font-family:var(--ff);font-size:.84rem;padding:10px 18px;cursor:pointer;transition:all .22s}
.btn-prev:hover{border-color:rgba(201,168,76,.3);color:var(--text)}
.btn-gen{width:100%;padding:15px;background:linear-gradient(135deg,var(--goldD),var(--gold));border:none;border-radius:12px;color:#0c1020;font-family:var(--ff);font-size:1rem;font-weight:700;cursor:pointer;transition:all .25s;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 20px rgba(201,168,76,.25)}
.btn-gen:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(201,168,76,.35)}
.btn-reset{width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--textD);font-family:var(--ff);font-size:.82rem;cursor:pointer;margin-top:10px;transition:all .2s}
.btn-reset:hover{border-color:var(--gold);color:var(--gold)}

/* RECITER GRID */
.rg{display:grid;grid-template-columns:repeat(auto-fill,minmax(124px,1fr));gap:10px}
.rc{background:var(--bg3);border:1.5px solid var(--border);border-radius:14px;padding:13px 10px 10px;cursor:pointer;text-align:center;transition:all .22s;position:relative;overflow:hidden}
.rc:hover{border-color:rgba(201,168,76,.3);transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.2)}
.rc.sel{box-shadow:0 0 0 2px rgba(201,168,76,.25),0 8px 24px rgba(0,0,0,.2)}
.rc-avatar-wrap{width:66px;height:66px;border-radius:50%;margin:0 auto 10px;position:relative;border:2px solid transparent;transition:border-color .25s;overflow:hidden}
.rc-check{position:absolute;bottom:1px;right:1px;width:19px;height:19px;border-radius:50%;background:var(--teal2);color:#fff;font-size:.6rem;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg-card)}
.rc-name{font-size:.7rem;font-weight:600;color:var(--text);line-height:1.3;margin-bottom:3px}
.rc.sel .rc-name{color:var(--gold2)}
.light .rc.sel .rc-name{color:var(--gold2)}
.rc-row{display:flex;justify-content:center;gap:5px;align-items:center;flex-wrap:wrap}
.rc-style{font-size:.58rem;color:var(--textD);background:var(--bg5);padding:1px 6px;border-radius:10px}
.rc-country{font-size:.58rem;color:var(--teal3)}
.rc.previewing{border-color:var(--teal2);box-shadow:0 0 0 2px rgba(42,157,143,.3),0 8px 28px rgba(42,157,143,.15)}
.rc-wave{position:absolute;bottom:3px;left:50%;transform:translateX(-50%);display:flex;align-items:flex-end;gap:2px;height:18px}
.rc-wave span{display:block;width:3px;border-radius:3px;background:var(--teal3);animation:rcwave .7s ease-in-out infinite alternate}
.rc-wave span:nth-child(1){animation-delay:.0s;height:5px}
.rc-wave span:nth-child(2){animation-delay:.1s;height:10px}
.rc-wave span:nth-child(3){animation-delay:.2s;height:16px}
.rc-wave span:nth-child(4){animation-delay:.1s;height:10px}
.rc-wave span:nth-child(5){animation-delay:.0s;height:5px}
@keyframes rcwave{from{transform:scaleY(.4)}to{transform:scaleY(1)}}
.rc-preview-lbl{font-size:.55rem;color:var(--teal3);margin-top:3px;letter-spacing:.02em}

/* SURAH SEARCH */
.search-wrap{position:relative;margin-bottom:12px;display:flex;align-items:center}
.si-icon{position:absolute;right:12px;font-size:.85rem;pointer-events:none;opacity:.5}
.srch{width:100%;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;padding:10px 38px 10px 36px;color:var(--text);font-family:var(--ff);font-size:.88rem;outline:none;direction:rtl;transition:border-color .2s}
.srch:focus{border-color:var(--border2)}.srch::placeholder{color:var(--textDD)}
.srch-x{position:absolute;left:10px;background:none;border:none;color:var(--textD);cursor:pointer;font-size:.75rem;padding:4px;transition:color .2s}
.srch-x:hover{color:var(--text)}
.sg{display:flex;flex-direction:column;gap:4px;max-height:400px;overflow-y:auto}
.si{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .16s;animation:fadeUp .2s calc(var(--idx,0)*.015s) both}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.si:hover{border-color:rgba(201,168,76,.25);background:var(--bg4)}
.si.sel{border-color:var(--gold);background:rgba(201,168,76,.06);box-shadow:0 0 0 2px rgba(201,168,76,.1)}
.si-n{min-width:30px;height:30px;border-radius:50%;background:var(--bg5);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--textD);flex-shrink:0;transition:all .2s}
.si.sel .si-n{border-color:var(--gold);color:var(--gold);background:rgba(201,168,76,.1)}
.si-body{flex:1;display:flex;flex-direction:column}
.si-ar{font-size:.95rem;font-weight:600;color:var(--gold2)}
.si-en{font-size:.63rem;color:var(--textD);margin-top:1px}
.si-bdg{font-size:.58rem;padding:2px 7px;border-radius:20px;flex-shrink:0;font-weight:600}
.si-bdg.mk{background:rgba(201,168,76,.1);color:var(--gold);border:1px solid rgba(201,168,76,.2)}
.si-bdg.md{background:rgba(42,157,143,.1);color:var(--teal3);border:1px solid rgba(42,157,143,.2)}

/* AYAH RANGE PICKER */
.arp{display:flex;flex-direction:column;gap:16px}
.arp-toggle-row{display:flex;gap:8px;background:var(--bg4);border-radius:10px;padding:4px;border:1px solid var(--border)}
.arp-tog{flex:1;padding:9px;border:none;border-radius:7px;font-family:var(--ff);font-size:.85rem;color:var(--textD);background:transparent;cursor:pointer;transition:all .22s}
.arp-tog.active{background:linear-gradient(135deg,var(--teal),var(--teal2));color:#fff;box-shadow:0 3px 10px rgba(42,157,143,.3)}
.arp-selects{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:end}
.arp-dash{color:var(--textD);font-size:1rem;text-align:center;padding-bottom:10px}
.arp-field label{display:block;font-size:.7rem;color:var(--textD);margin-bottom:5px}
.arp-sw{position:relative}
.arp-sel{width:100%;background:var(--input-bg);border:1px solid var(--border);border-radius:9px;padding:10px 14px 10px 30px;color:var(--text);font-family:var(--ff);font-size:.9rem;appearance:none;-webkit-appearance:none;outline:none;cursor:pointer;transition:border-color .2s;direction:rtl}
.arp-sel:focus{border-color:var(--border2)}
.arp-arr{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--textD);font-size:.75rem;pointer-events:none}
.arp-bar-wrap{display:flex;flex-direction:column;gap:5px}
.arp-bar{height:34px;background:var(--bg4);border-radius:8px;border:1px solid var(--border);position:relative;overflow:hidden}
.arp-fill{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,rgba(201,168,76,.18),rgba(201,168,76,.38));border-radius:6px;transition:all .4s cubic-bezier(.22,.68,0,1.2);border-right:2px solid rgba(201,168,76,.55)}
.arp-tick{position:absolute;top:22%;bottom:22%;width:1px;background:var(--border);transform:translateX(-50%);transition:background .3s}
.arp-tick.in{background:rgba(201,168,76,.55)}
.arp-blabels{display:flex;justify-content:space-between;font-size:.63rem;color:var(--textD);padding:0 2px}
.arp-binfo{color:var(--gold);font-weight:600}
.arp-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.arp-sc{background:var(--bg4);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;display:flex;flex-direction:column;gap:4px}
.arp-sc span{font-size:.65rem;color:var(--textD)}.arp-sc strong{font-size:1.1rem;color:var(--gold2);font-weight:700}
.light .arp-sc strong{color:#7a5018}

/* LISTEN LAYOUT */
.listen-layout{display:grid;grid-template-columns:1fr 1fr;min-height:520px}

/* QURAN TEXT */
.qtext-col{padding:20px 24px;border-left:1px solid var(--border);display:flex;flex-direction:column;gap:10px}
.qtext-hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--border)}
.qtext-hdr>span:first-child{font-size:.78rem;color:var(--textD);font-weight:600}
.active-badge{display:flex;align-items:center;gap:5px;font-size:.68rem;color:var(--teal3);background:rgba(42,157,143,.1);border:1px solid rgba(42,157,143,.22);padding:3px 10px;border-radius:20px;animation:fadeIn .3s ease}
.active-dot{width:6px;height:6px;border-radius:50%;background:var(--teal3);animation:pulse 1.5s infinite}
@keyframes fadeIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}
.qloading{display:flex;align-items:center;gap:10px;font-size:.82rem;color:var(--textD);padding:30px 0}
.qtext-hint{font-size:.63rem;color:var(--textDD);text-align:center;padding:6px;border-top:1px solid var(--border)}
.qtext-outer{flex:1;display:flex;flex-direction:column;gap:0;overflow:visible}
.qtext-wrap{flex:1;overflow-y:auto;max-height:360px;padding-left:4px}
.qtext{font-family:var(--fq);font-size:1.55rem;line-height:2.7;text-align:right;direction:rtl;color:var(--text);word-break:break-word;padding:4px 2px}
.light .qtext{color:#1e1608}
.qayah{cursor:pointer;border-radius:6px;transition:background .2s,box-shadow .2s;padding:2px 3px;display:inline}
.qayah:hover{background:rgba(201,168,76,.09)}
.qayah.playing{background:rgba(201,168,76,.2);box-shadow:0 0 0 2px rgba(201,168,76,.35);border-radius:8px;color:var(--gold2);animation:aLight .35s ease}
.qayah.selected{background:rgba(42,157,143,.15);box-shadow:0 0 0 2px rgba(42,157,143,.3);border-radius:8px}
.qayah.playing.selected{background:rgba(201,168,76,.25)}
.light .qayah.playing{background:rgba(201,168,76,.25);color:#7a5018}
@keyframes aLight{from{background:rgba(201,168,76,.5)}to{background:rgba(201,168,76,.2)}}
.qnum{font-family:var(--ff);font-size:.72rem;color:var(--gold);vertical-align:middle;margin-right:2px;opacity:.7}

/* AYAH DRAWER */
.ayah-drawer{background:var(--bg3);border-top:1px solid var(--border);border-radius:0 0 var(--r8) var(--r8);overflow:hidden;animation:drawerIn .25s ease}
@keyframes drawerIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
.ayah-drawer-header{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:linear-gradient(90deg,rgba(201,168,76,.08),transparent);border-bottom:1px solid var(--border)}
.ayah-drawer-num{font-size:.8rem;font-weight:700;color:var(--gold2)}
.ayah-drawer-close{background:none;border:none;color:var(--textD);cursor:pointer;font-size:.75rem;padding:3px 7px;border-radius:5px;transition:all .15s}
.ayah-drawer-close:hover{background:rgba(201,168,76,.1);color:var(--text)}
.ayah-actions{padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap}

/* TAFSIR TRIGGER / PANEL */
.tf-trigger{background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:7px 14px;color:var(--textD);font-family:var(--ff);font-size:.78rem;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .2s}
.tf-trigger:hover{border-color:rgba(201,168,76,.3);color:var(--text)}
.tf-panel{background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;width:100%;margin-top:4px}
.tf-header{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:rgba(201,168,76,.06);border-bottom:1px solid var(--border);font-size:.75rem;color:var(--gold2);font-weight:600}
.light .tf-header{color:var(--gold2)}
.tf-close{background:none;border:none;color:var(--textD);cursor:pointer;font-size:.72rem;padding:2px 6px;border-radius:4px;transition:all .15s}
.tf-close:hover{color:var(--text);background:rgba(201,168,76,.1)}
.tf-loading{display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--textD);padding:14px}
.tf-text{padding:12px 14px;font-size:.88rem;line-height:2;color:var(--text);direction:rtl}
.light .tf-text{color:#1e1608}
.tf-source{padding:6px 14px 10px;font-size:.62rem;color:var(--textDD);border-top:1px solid var(--border);text-align:center}

/* SPINNER (used by tafsir loading) */
.mq-spin{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--gold);animation:spin .8s linear infinite;margin-inline-end:8px;flex-shrink:0;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}

/* MAQASID */
.mq-trigger{background:linear-gradient(135deg,rgba(201,168,76,.1),rgba(201,168,76,.05));border:1px solid rgba(201,168,76,.28);border-radius:8px;padding:7px 14px;color:var(--gold);font-family:var(--ff);font-size:.78rem;cursor:pointer;transition:all .2s}
.mq-trigger:hover{background:rgba(201,168,76,.16);box-shadow:0 3px 12px rgba(201,168,76,.15)}
.mq-panel{background:var(--bg2);border:1px solid rgba(201,168,76,.2);border-radius:10px;overflow:hidden;width:100%;margin-top:4px;box-shadow:0 4px 20px rgba(201,168,76,.08)}
.mq-hdr{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:linear-gradient(90deg,rgba(201,168,76,.1),transparent);border-bottom:1px solid rgba(201,168,76,.12)}
.mq-title{font-size:.78rem;color:var(--gold2);font-weight:700}.light .mq-title{color:var(--gold2)}
.mq-x{background:none;border:none;color:var(--textD);cursor:pointer;font-size:.72rem;padding:2px 6px;border-radius:4px;transition:all .15s}
.mq-x:hover{color:var(--text);background:rgba(201,168,76,.1)}
.mq-keybox{padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.mq-keyinfo{font-size:.76rem;line-height:1.65;color:var(--textD)}.mq-keyinfo strong{color:var(--text)}
.mq-a{color:var(--teal3);text-decoration:none}.mq-a:hover{text-decoration:underline}
.mq-keyrow{display:flex;gap:6px}
.mq-kinput{flex:1;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:.8rem;outline:none;font-family:monospace;transition:border-color .2s}
.mq-kinput:focus{border-color:var(--border2)}.mq-kinput::placeholder{color:var(--textDD)}
.mq-kbtn{background:linear-gradient(135deg,var(--goldD),var(--gold));border:none;border-radius:8px;color:#0c1020;font-family:var(--ff);font-size:.8rem;font-weight:700;padding:8px 14px;cursor:pointer;white-space:nowrap;transition:all .2s}
.mq-kbtn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(201,168,76,.3)}
.mq-kerr{font-size:.72rem;color:#e07060;background:rgba(224,112,96,.08);border:1px solid rgba(224,112,96,.2);border-radius:6px;padding:6px 10px}
.mq-loading{display:flex;align-items:center;font-size:.8rem;color:var(--textD);padding:14px;gap:8px}
.mq-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.mq-row{display:flex;flex-direction:column;gap:4px}
.mq-topic{flex-direction:row;align-items:center;gap:8px}
.mq-topicval{font-size:.88rem;color:var(--gold2)}
.mq-badge{font-size:.62rem;font-weight:700;padding:2px 9px;border-radius:20px;background:rgba(201,168,76,.1);color:var(--gold);border:1px solid rgba(201,168,76,.2);flex-shrink:0;white-space:nowrap}
.mq-b2{background:rgba(42,157,143,.1);color:var(--teal3);border-color:rgba(42,157,143,.2)}
.mq-b3{background:rgba(107,80,180,.12);color:#a07adf;border-color:rgba(107,80,180,.2)}
.mq-b4{background:rgba(201,115,76,.1);color:#d4944c;border-color:rgba(201,115,76,.2)}
.mq-txt{font-size:.84rem;line-height:1.75;color:var(--text);direction:rtl}.light .mq-txt{color:#1e1608}
.mq-src{font-size:.6rem;color:var(--textDD);text-align:center;margin-top:2px;border-top:1px solid var(--border);padding-top:6px}

/* PLAYER */
.player-col{padding:20px 24px;display:flex;flex-direction:column;gap:12px}
.gen-idle{display:flex;flex-direction:column;gap:12px}
.gen-summary{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:16px;position:relative;overflow:hidden}
.gen-summary::before{content:'';position:absolute;top:0;right:0;left:0;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.3}
.gs-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(201,168,76,.05)}
.gs-row:last-child{border:none}
.gs-row span{font-size:.72rem;color:var(--textD)}.gs-row strong{font-size:.82rem;color:var(--text)}
.splayer{display:flex;flex-direction:column;gap:10px}
.sp-meta{display:flex;justify-content:space-between;font-size:.68rem;color:var(--textD)}
.sp-fname{direction:ltr;unicode-bidi:isolate;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:74%}
.sp-size{color:var(--gold);flex-shrink:0}
.sp-wf{height:74px;background:var(--bg3);border-radius:10px;position:relative;overflow:hidden;cursor:pointer;border:1px solid var(--border)}
.sp-prog{position:absolute;top:0;bottom:0;left:0;background:rgba(201,168,76,.07);pointer-events:none}
.sp-cv{width:100%;height:100%;display:block}
.sp-cursor{position:absolute;top:0;bottom:0;width:2px;background:var(--gold);pointer-events:none;transition:left .08s linear;box-shadow:0 0 8px var(--gold)}
.sp-time{display:flex;justify-content:space-between;font-size:.62rem;color:var(--textD)}
.sp-ctrl{display:flex;align-items:center;justify-content:center;gap:10px}
.sp-skip{background:var(--bg3);border:1px solid var(--border);border-radius:20px;height:34px;padding:0 13px;cursor:pointer;color:var(--textD);font-size:.76rem;font-family:var(--ff);transition:all .18s}
.sp-skip:hover{border-color:var(--gold);color:var(--gold)}
.sp-play{background:linear-gradient(135deg,var(--teal),var(--teal2));border:none;border-radius:50%;width:48px;height:48px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;font-size:1rem;transition:all .22s;box-shadow:0 4px 16px rgba(42,157,143,.4)}
.sp-play:hover{transform:scale(1.1)}
.sp-vol{display:flex;align-items:center;gap:8px;font-size:.82rem}
.sp-vrange{flex:1;-webkit-appearance:none;height:3px;border-radius:2px;background:var(--bg5);outline:none;cursor:pointer}
.sp-vrange::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:var(--gold);cursor:pointer;box-shadow:0 0 6px rgba(201,168,76,.4)}
.sp-jumps{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px}
.sp-jlbl{font-size:.66rem;color:var(--textD);margin-bottom:7px}
.sp-jbtns{display:flex;flex-wrap:wrap;gap:5px}
.sp-jbtn{background:var(--bg4);border:1px solid var(--border);border-radius:7px;padding:4px 11px;font-size:.76rem;font-family:var(--ff);color:var(--textD);cursor:pointer;transition:all .15s}
.sp-jbtn:hover{border-color:rgba(201,168,76,.3);color:var(--text)}
.sp-jbtn.active{background:rgba(201,168,76,.17);border-color:var(--gold);color:var(--gold);font-weight:700;box-shadow:0 0 10px rgba(201,168,76,.18)}
.sp-dl{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:9px;background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.25);border-radius:8px;color:var(--gold2);font-family:var(--ff);font-size:.82rem;font-weight:600;text-decoration:none;transition:all .18s}
.light .sp-dl{color:var(--gold2)}
.sp-dl:hover{background:rgba(201,168,76,.14);border-color:rgba(201,168,76,.4)}

/* PROGRESS */
.prog-panel{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:16px}
.prog-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.prog-status{display:flex;align-items:center;gap:8px;font-size:.84rem;color:var(--gold2)}
.prog-status.done{color:var(--teal3)}.prog-status.err{color:#d06050}
.pulse-dot{width:8px;height:8px;border-radius:50%;background:var(--gold);animation:pulse 1.3s infinite;flex-shrink:0}
.prog-cnt{font-size:.7rem;color:var(--textD)}
.prog-bg{background:var(--bg5);border-radius:4px;height:7px;overflow:hidden;margin-bottom:10px}
.prog-bar{height:100%;border-radius:4px;transition:width .5s ease;background:linear-gradient(90deg,var(--gold),var(--gold2))}
.prog-bar.done{background:linear-gradient(90deg,var(--teal),var(--teal2))}
.prog-dots{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px}
.prog-dot{width:9px;height:9px;border-radius:50%}.prog-dot.ok{background:var(--teal2)}.prog-dot.fallback{background:var(--gold)}.prog-dot.failed{background:#c0392b}
.prog-leg{display:flex;gap:12px;font-size:.63rem;color:var(--textD)}.prog-leg span{display:flex;align-items:center;gap:3px}
.ld{display:inline-block;width:6px;height:6px;border-radius:50%}.ld.ok{background:var(--teal2)}.ld.fallback{background:var(--gold)}.ld.failed{background:#c0392b}

/* FOOTER */
.footer{border-top:1px solid var(--border);padding:28px 24px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;background:linear-gradient(0deg,rgba(201,168,76,.04),transparent)}
.footer-orn{color:var(--gold);opacity:.4;letter-spacing:8px;font-size:.8rem}
.footer-copy{font-size:.78rem;color:var(--textD)}.footer-copy strong{color:var(--gold2)}
.footer-sub{font-size:.66rem;color:var(--textDD)}.fl{color:var(--teal3)}
.footer-bismillah{font-family:var(--fq);font-size:1.1rem;color:var(--gold);opacity:.5;margin-top:4px}

/* RESPONSIVE */
@media(max-width:768px){
  .listen-layout{grid-template-columns:1fr}
  .qtext-col{border-left:none;border-bottom:1px solid var(--border)}
  .qtext-wrap{max-height:200px}
  .wcard{border-radius:14px}.wcard.wide{border-radius:14px}
  .rg{grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:8px}
  .wcard-body{max-height:calc(100vh - 280px)}
  .arp-selects{grid-template-columns:1fr 1fr;gap:8px}.arp-dash{display:none}
  .sb-track{flex-wrap:wrap;justify-content:center;gap:2px}
  .sb-seg{padding:5px 11px;font-size:.72rem}
  .hdr-inner{padding:16px 16px 14px}.hdr-title{font-size:1.7rem}
  .ayah-actions{flex-direction:column}
}
@media(max-width:480px){
  .rg{grid-template-columns:repeat(3,1fr)}.arp-summary{grid-template-columns:1fr 1fr}
}
`}</style>
    </div>
  );
}