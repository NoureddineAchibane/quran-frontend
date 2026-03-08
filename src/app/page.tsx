"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useAudioGenerator } from "@/hooks/useAudioGenerator";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const META: Record<number, { nameAr: string; style: string; photo: string }> = {
  1:  { nameAr:"عبد الباسط عبد الصمد", style:"مرتّل", photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Abdul_Basit_Abdus_Samad.jpg/200px-Abdul_Basit_Abdus_Samad.jpg" },
  2:  { nameAr:"عبد الباسط عبد الصمد", style:"مجوّد",  photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Abdul_Basit_Abdus_Samad.jpg/200px-Abdul_Basit_Abdus_Samad.jpg" },
  3:  { nameAr:"عبد الرحمن السديس",    style:"مرتّل", photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Abdul_Rahman_Al-Sudais.jpg/200px-Abdul_Rahman_Al-Sudais.jpg" },
  4:  { nameAr:"أبو بكر الشاطري",      style:"مرتّل", photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Abu_Bakr_al-Shatri.jpg/200px-Abu_Bakr_al-Shatri.jpg" },
  5:  { nameAr:"هاني الرفاعي",         style:"مرتّل", photo:"" },
  6:  { nameAr:"محمود خليل الحصري",    style:"مرتّل", photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Mahmoud_Khalil_Al-Husary.jpg/200px-Mahmoud_Khalil_Al-Husary.jpg" },
  7:  { nameAr:"مشاري راشد العفاسي",   style:"مرتّل", photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Mishary_Rashid_Alafasy.jpg/200px-Mishary_Rashid_Alafasy.jpg" },
  8:  { nameAr:"محمد صديق المنشاوي",   style:"مجوّد",  photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Muhammed_Siddiq_Al-Minshawi.jpg/200px-Muhammed_Siddiq_Al-Minshawi.jpg" },
  9:  { nameAr:"محمد صديق المنشاوي",   style:"مرتّل", photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Muhammed_Siddiq_Al-Minshawi.jpg/200px-Muhammed_Siddiq_Al-Minshawi.jpg" },
  10: { nameAr:"سعود الشريم",          style:"مرتّل", photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Saud_Al-Shuraim.jpg/200px-Saud_Al-Shuraim.jpg" },
  11: { nameAr:"ماهر المعيقلي",        style:"مرتّل", photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Maher_Al-Muaiqly.jpg/200px-Maher_Al-Muaiqly.jpg" },
  12: { nameAr:"محمود خليل الحصري",    style:"معلّم",  photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Mahmoud_Khalil_Al-Husary.jpg/200px-Mahmoud_Khalil_Al-Husary.jpg" },
  13: { nameAr:"سعد الغامدي",          style:"مرتّل", photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Saad_Al-Ghamdi.jpg/200px-Saad_Al-Ghamdi.jpg" },
  14: { nameAr:"ياسر الدوسري",         style:"مرتّل", photo:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Yasser_Al-Dosari.jpg/200px-Yasser_Al-Dosari.jpg" },
  15: { nameAr:"ناصر القطامي",         style:"مرتّل", photo:"" },
};
const ACOLORS = ["#c9a84c","#2a9d8f","#e76f51","#457b9d","#6d6875","#f4a261","#2a9d8f","#c9a84c","#e63946","#06d6a0","#118ab2","#ffd166"];
const AC = (id:number) => ACOLORS[id % ACOLORS.length];

const STATUS_AR: Record<string,string> = {
  connecting:"جارٍ الاتصال...", resolving:"جارٍ تحليل الآيات...",
  downloading:"جارٍ تحميل الآيات...", merging:"جارٍ دمج الصوت...",
  done:"اكتمل!", error:"خطأ",
};

/* ───── Stars ───── */
function Stars() {
  const [s,setS]=useState<any[]>([]);
  useEffect(()=>{setS(Array.from({length:60},(_,i)=>({id:i,
    top:`${Math.random()*100}%`,left:`${Math.random()*100}%`,
    w:Math.random()*2+0.5,dur:`${Math.random()*4+2}s`,delay:`${Math.random()*8}s`})));},[]);
  return <div className="stars">{s.map(x=><div key={x.id} className="star" style={{top:x.top,left:x.left,width:x.w,height:x.w,"--dur":x.dur,"--delay":x.delay} as any}/>)}</div>;
}

/* ───── Horizontal Step Bar (matches screenshot exactly) ───── */
function StepBar({step}:{step:number}) {
  const steps=[{n:1,ar:"اختر القارئ"},{n:2,ar:"اختر السورة"},{n:3,ar:"نطاق الآيات"},{n:4,ar:"استمع"}];
  return (
    <div className="sb">
      {steps.map((s,i)=>{
        const done=step>s.n, active=step===s.n;
        return (
          <div key={s.n} className="sb-item">
            {i>0 && <div className={`sb-line${done||active?" lit":""}`}/>}
            <div className={`sb-dot${active?" active":done?" done":""}`}>
              {done?"✓":s.n}
            </div>
            <span className={`sb-lbl${active?" active":done?" done":""}`}>{s.ar}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ───── Reciter Card ───── */
function RC({r,selected,onClick}:{r:any;selected:boolean;onClick:()=>void}) {
  const m=META[r.id]; const [err,setErr]=useState(false);
  return (
    <div className={`rc${selected?" sel":""}`} onClick={onClick}>
      {m?.photo&&!err
        ? <img src={m.photo} alt={m.nameAr} className="rc-img" onError={()=>setErr(true)}/>
        : <div className="rc-av" style={{background:`linear-gradient(135deg,${AC(r.id)}44,#111c2a)`}}>
            <span style={{color:AC(r.id)}}>{(m?.nameAr??r.reciter_name??"؟")[0]}</span>
          </div>
      }
      <div className="rc-name">{m?.nameAr??r.reciter_name}</div>
      <div className="rc-style">{m?.style??"مرتّل"}</div>
    </div>
  );
}

/* ───── Ayah Visualizer ───── */
function AyahViz({total,min,max}:{total:number;min:number;max:number}) {
  if(!total||!min||!max) return null;
  const cnt=max-min+1,pL=((min-1)/total)*100,pW=(cnt/total)*100;
  const dots=Math.min(total,100),dMin=Math.floor(((min-1)/total)*dots),dMax=Math.floor((max/total)*dots);
  return (
    <div className="aviz">
      <div className="aviz-bar">
        <div className="aviz-fill" style={{left:`${pL}%`,width:`${pW}%`}}/>
        <span className="aviz-lbl">الآيات {min}–{max} من {total} ({cnt} آية)</span>
      </div>
      <div className="aviz-dots">{Array.from({length:dots},(_,i)=><div key={i} className={`adot${i>=dMin&&i<dMax?" in":" out"}`}/>)}</div>
    </div>
  );
}

/* ───── Audio Player ───── */
function Player({url,filename,sizeKb}:{url:string;filename:string;sizeKb:number|null}) {
  const aRef=useRef<HTMLAudioElement|null>(null);
  const cvRef=useRef<HTMLCanvasElement|null>(null);
  const bars=useRef<number[]>([]);
  const [play,setPlay]=useState(false);
  const [cur,setCur]=useState(0);
  const [dur,setDur]=useState(0);
  const [vol,setVol]=useState(1);

  const draw=useCallback((p:number)=>{
    const cv=cvRef.current; if(!cv) return;
    const ctx=cv.getContext("2d"); if(!ctx) return;
    const W=cv.offsetWidth,H=cv.offsetHeight; cv.width=W; cv.height=H;
    ctx.clearRect(0,0,W,H);
    const B=bars.current,bw=W/B.length-1,pi=Math.floor(p*B.length);
    B.forEach((h,i)=>{
      const x=i*(bw+1),bh=h*H*.8,y=(H-bh)/2,r=2;
      ctx.fillStyle=i<=pi?`rgba(201,168,76,${.5+h*.5})`:`rgba(42,57,80,${.4+h*.3})`;
      ctx.beginPath();
      ctx.moveTo(x+r,y);ctx.lineTo(x+bw-r,y);ctx.quadraticCurveTo(x+bw,y,x+bw,y+r);
      ctx.lineTo(x+bw,y+bh-r);ctx.quadraticCurveTo(x+bw,y+bh,x+bw-r,y+bh);
      ctx.lineTo(x+r,y+bh);ctx.quadraticCurveTo(x,y+bh,x,y+bh-r);
      ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
      ctx.closePath();ctx.fill();
    });
  },[]);

  useEffect(()=>{bars.current=Array.from({length:120},()=>0.15+Math.random()*.85);setTimeout(()=>draw(0),50);},[url]);
  useEffect(()=>{
    const a=new Audio(url); aRef.current=a; a.volume=vol;
    a.onloadedmetadata=()=>setDur(a.duration);
    a.ontimeupdate=()=>{setCur(a.currentTime);draw(a.duration?a.currentTime/a.duration:0);};
    a.onended=()=>{setPlay(false);setCur(0);draw(0);};
    return ()=>{a.pause();a.src="";};
  },[url]);

  const toggle=()=>{const a=aRef.current;if(!a)return;play?a.pause():a.play();setPlay(!play);};
  const skip=(s:number)=>{const a=aRef.current;if(a)a.currentTime=Math.max(0,Math.min(a.duration,a.currentTime+s));};
  const seek=(e:React.MouseEvent<HTMLDivElement>)=>{const a=aRef.current;if(!a||!a.duration)return;const rc=e.currentTarget.getBoundingClientRect();a.currentTime=((e.clientX-rc.left)/rc.width)*a.duration;};
  const fmt=(s:number)=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;
  const pct=dur>0?(cur/dur)*100:0;

  return (
    <div className="player">
      <div className="pl-meta"><span className="pl-fn">{filename}</span>{sizeKb&&<span className="pl-sz">{sizeKb} KB</span>}</div>
      <div className="pl-wf" onClick={seek}>
        <div className="pl-prog" style={{width:`${pct}%`}}/>
        <canvas ref={cvRef} className="pl-cv"/>
        <div className="pl-cur" style={{left:`${pct}%`}}/>
      </div>
      <div className="pl-time"><span>{fmt(cur)}</span><span>{fmt(dur)}</span></div>
      <div className="pl-ctrl">
        <button className="pl-skip" onClick={()=>skip(-10)}>«&nbsp;١٠</button>
        <button className="pl-play" onClick={toggle}>{play?"⏸":"▶"}</button>
        <button className="pl-skip" onClick={()=>skip(10)}>١٠&nbsp;»</button>
      </div>
      <div className="pl-vol"><span>🔊</span><input type="range" min={0} max={1} step={0.05} value={vol} className="pl-vs" onChange={e=>{setVol(+e.target.value);if(aRef.current)aRef.current.volume=+e.target.value;}}/></div>
      <a href={url} download={filename} className="pl-dl">⬇ تحميل الملف الصوتي</a>
    </div>
  );
}

/* ───── Progress Panel ───── */
function Progress({gen}:{gen:ReturnType<typeof useAudioGenerator>}) {
  const {status,total,downloaded,fallbacks,failed,ayahs,percent,downloadUrl,filename,sizeKb,error,reset}=gen;
  if(status==="idle") return null;
  const done=status==="done",err=status==="error";
  return (
    <div className="pp">
      <div className="pp-head">
        <div className={`pp-st${done?" done":err?" err":""}`}>
          <span className="pp-dot"/>{STATUS_AR[status]??status}{status==="downloading"&&` (${percent}%)`}
        </div>
        {!done&&!err&&<button className="pp-cancel" onClick={reset}>إلغاء</button>}
      </div>
      {!err&&<div className="pp-bw"><div className={`pp-b${done?" done":""}`} style={{width:`${done?100:status==="merging"?95:percent}%`}}/></div>}
      {total>0&&<div className="pp-cnt"><span>{downloaded}/{total} آية</span>{fallbacks>0&&<span className="pp-fb">↩ {fallbacks} بديل</span>}{failed>0&&<span className="pp-fail">✕ {failed} فشل</span>}</div>}
      {ayahs.length>0&&<div className="pp-dots">{ayahs.map(a=><div key={a.index} className={`sdt ${a.status}`} title={`آية ${a.ayah}`}/>)}</div>}
      {ayahs.length>0&&<div className="pp-leg"><span><i className="ld ok"/>موفق</span><span><i className="ld fallback"/>بديل</span><span><i className="ld failed"/>فشل</span></div>}
      {err&&<div className="pp-err">{error}</div>}
      {done&&downloadUrl&&<Player url={downloadUrl} filename={filename??"quran.mp3"} sizeKb={sizeKb}/>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function Home() {
  const [reciters,setReciters]=useState<any[]>([]);
  const [surahs,setSurahs]=useState<any[]>([]);
  const [search,setSearch]=useState("");
  const [selR,setSelR]=useState<number|null>(null);
  const [selS,setSelS]=useState<any|null>(null);
  const [whole,setWhole]=useState(true);
  const [aMin,setAMin]=useState(1);
  const [aMax,setAMax]=useState(1);
  const gen=useAudioGenerator();

  const ref2=useRef<HTMLDivElement>(null);
  const ref3=useRef<HTMLDivElement>(null);
  const ref4=useRef<HTMLDivElement>(null);
  const scroll=(r:React.RefObject<HTMLDivElement>)=>setTimeout(()=>r.current?.scrollIntoView({behavior:"smooth",block:"start"}),150);

  const step=gen.status!=="idle"?4:selS?3:selR?2:1;

  useEffect(()=>{
    fetch(`${API}/recitations`).then(r=>r.json()).then(setReciters).catch(()=>{});
    fetch(`${API}/surahs`).then(r=>r.json()).then(setSurahs).catch(()=>{});
  },[]);
  useEffect(()=>{if(selS){setAMin(1);setAMax(Math.min(10,selS.verses_count));}},[selS]);

  const filtered=surahs.filter(s=>s.name_arabic.includes(search)||s.name_simple.toLowerCase().includes(search.toLowerCase())||String(s.id).includes(search));
  const canGen=selR!==null&&selS!==null&&gen.status==="idle";

  const handleGen=()=>{
    if(!canGen)return;
    scroll(ref4);
    gen.generate({recitation_id:selR!,surah_number:selS!.id,whole_surah:whole,
      ayah_min:whole?undefined:aMin,ayah_max:whole?undefined:aMax}).catch(()=>{});
  };

  return (
    <div className="app">
      <Stars/>
      <div className="geo"/>

      {/* Header */}
      <header className="hdr">
        <div className="hdr-moon">☽</div>
        <h1 className="hdr-title">مُصحف الصوت</h1>
        <p className="hdr-sub">استمع إلى القرآن الكريم بأصوات كبار القراء</p>
      </header>

      {/* ── Sticky Step Bar ── */}
      <div className="sb-wrap">
        <StepBar step={step}/>
      </div>

      <main className="main">

        {/* Step 1 — Reciter */}
        <section className={`panel${step===1?" active":step>1?" done":""}`}>
          <div className="ph">
            <span className="ph-n">١</span>
            <span className="ph-t">اختر القارئ</span>
            {selR&&<span className="ph-badge">{META[selR]?.nameAr}</span>}
          </div>
          <div className="pb">
            <div className="rg">
              {reciters.map(r=>(
                <RC key={r.id} r={r} selected={selR===r.id} onClick={()=>{setSelR(r.id);scroll(ref2);}}/>
              ))}
            </div>
          </div>
        </section>

        {/* Step 2 — Surah */}
        <section ref={ref2} className={`panel${!selR?" locked":step===2?" active":step>2?" done":""}`}>
          <div className="ph">
            <span className="ph-n">٢</span>
            <span className="ph-t">اختر السورة</span>
            {selS&&<span className="ph-badge">{selS.name_arabic}</span>}
          </div>
          {selR?(
            <div className="pb">
              <input className="srch" type="text" placeholder="ابحث عن سورة..." value={search} onChange={e=>setSearch(e.target.value)}/>
              <div className="sg">
                {filtered.map(s=>(
                  <div key={s.id} className={`si${selS?.id===s.id?" sel":""}`} onClick={()=>{setSelS(s);scroll(ref3);}}>
                    <span className="si-n">{s.id}</span>
                    <span className="si-ar">{s.name_arabic}</span>
                    <span className={s.revelation_place==="makkah"?"si-mk":"si-md"}/>
                  </div>
                ))}
              </div>
            </div>
          ):<div className="plocked">اختر القارئ أولاً</div>}
        </section>

        {/* Step 3 — Ayah Range */}
        <section ref={ref3} className={`panel${!selS?" locked":step===3?" active":step>3?" done":""}`}>
          <div className="ph">
            <span className="ph-n">٣</span>
            <span className="ph-t">نطاق الآيات</span>
          </div>
          {selS?(
            <div className="pb">
              <div className="tog-row">
                <div className={`tog${whole?" on":""}`} onClick={()=>setWhole(!whole)}/>
                <span className="tog-lbl" onClick={()=>setWhole(!whole)}>
                  {whole?`السورة كاملة (${selS.verses_count} آية)`:"تحديد نطاق"}
                </span>
              </div>
              {!whole&&(
                <>
                  <div className="rr">
                    <div className="rg2"><label>من الآية</label><input type="number" className="ri" min={1} max={selS.verses_count} value={aMin} onChange={e=>{const v=Math.max(1,Math.min(+e.target.value||1,aMax));setAMin(v);}}/></div>
                    <div className="rg2"><label>إلى الآية</label><input type="number" className="ri" min={aMin} max={selS.verses_count} value={aMax} onChange={e=>{const v=Math.max(aMin,Math.min(+e.target.value||aMin,selS.verses_count));setAMax(v);}}/></div>
                  </div>
                  <AyahViz total={selS.verses_count} min={aMin} max={aMax}/>
                </>
              )}
            </div>
          ):<div className="plocked">اختر السورة أولاً</div>}
        </section>

        {/* Step 4 — Generate */}
        <section ref={ref4} className={`panel${!canGen&&gen.status==="idle"?" locked":" active"}`}>
          <div className="ph">
            <span className="ph-n">٤</span>
            <span className="ph-t">استمع</span>
          </div>
          <div className="pb">
            {gen.status==="idle"
              ?<button className="gen-btn" disabled={!canGen} onClick={handleGen}>▶ توليد الملف الصوتي</button>
              :<button className="gen-btn reset" onClick={gen.reset}>↺ بدء من جديد</button>
            }
            <Progress gen={gen}/>
          </div>
        </section>

      </main>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --bg0:#05080c;--bg1:#080d14;--bg2:#0c1420;--bg3:#111c2a;--bg4:#16222e;
          --gold:#c9a84c;--gold2:#e8c97a;--goldD:#7a6020;
          --teal:#1d7a72;--teal2:#2a9d8f;--teal3:#3fbfb0;
          --red:#c0392b;--text:#d4c5a0;--textD:#8a7d60;
          --border:rgba(201,168,76,.13);
          --font:'Noto Naskh Arabic','Amiri',serif;
        }
        html{scroll-behavior:smooth}
        body{background:var(--bg0);color:var(--text);font-family:var(--font);min-height:100vh;direction:rtl;overflow-x:hidden}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:var(--bg1)}::-webkit-scrollbar-thumb{background:var(--goldD);border-radius:3px}

        /* Stars */
        .stars{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
        .star{position:absolute;background:var(--gold2);border-radius:50%;opacity:0;animation:tw var(--dur,3s) var(--delay,0s) infinite ease-in-out}
        @keyframes tw{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:.5;transform:scale(1)}}
        .geo{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.022;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cpath d='M60 8L112 36v48L60 112 8 84V36Z' fill='none' stroke='%23c9a84c' stroke-width='.7'/%3E%3Ccircle cx='60' cy='60' r='20' fill='none' stroke='%23c9a84c' stroke-width='.5'/%3E%3C/svg%3E");
          background-size:120px 120px}
        .app{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column}

        /* Header */
        .hdr{text-align:center;padding:40px 24px 22px;border-bottom:1px solid var(--border);
          background:linear-gradient(180deg,rgba(201,168,76,.06) 0%,transparent 100%)}
        .hdr-moon{font-size:1.8rem;color:var(--gold);filter:drop-shadow(0 0 10px rgba(201,168,76,.5));margin-bottom:4px}
        .hdr-title{font-size:clamp(1.7rem,4vw,2.7rem);font-weight:700;color:var(--gold2);text-shadow:0 0 40px rgba(201,168,76,.3);margin-bottom:4px}
        .hdr-sub{font-size:.82rem;color:var(--textD)}

        /* ═══ STEP BAR — exact match to screenshot ═══ */
        .sb-wrap{
          position:sticky;top:0;z-index:20;
          background:rgba(8,13,20,.92);
          backdrop-filter:blur(12px);
          border-bottom:1px solid var(--border);
          padding:20px 32px 18px;
        }
        .sb{
          display:flex;align-items:flex-start;justify-content:center;
          max-width:560px;margin:0 auto;
          position:relative;
        }
        .sb-item{
          display:flex;flex-direction:column;align-items:center;
          flex:1;position:relative;
        }
        /* horizontal connecting line */
        .sb-line{
          position:absolute;
          height:1px;
          top:17px;
          right:50%;left:-50%;
          background:rgba(201,168,76,.18);
          transition:background .4s;
        }
        .sb-line.lit{background:linear-gradient(90deg,rgba(201,168,76,.25),var(--gold));}

        /* circle */
        .sb-dot{
          position:relative;z-index:1;
          width:35px;height:35px;border-radius:50%;
          border:1.5px solid rgba(201,168,76,.22);
          display:flex;align-items:center;justify-content:center;
          font-size:.88rem;color:var(--textD);
          background:var(--bg2);
          font-family:var(--font);
          transition:all .35s;
          user-select:none;
        }
        .sb-dot.active{
          border-color:var(--gold);color:var(--gold);font-weight:700;
          background:radial-gradient(circle,rgba(201,168,76,.14),var(--bg2));
          box-shadow:0 0 0 5px rgba(201,168,76,.1),0 0 20px rgba(201,168,76,.18);
        }
        .sb-dot.done{
          border-color:var(--teal2);background:var(--teal2);color:#fff;font-size:.78rem;
          box-shadow:0 0 14px rgba(42,157,143,.3);
        }
        /* label */
        .sb-lbl{
          margin-top:8px;font-size:.7rem;color:rgba(138,125,96,.5);
          text-align:center;white-space:nowrap;transition:color .3s;
        }
        .sb-lbl.active{color:var(--gold);font-weight:600}
        .sb-lbl.done{color:var(--teal3)}

        /* ═══ Panels ═══ */
        .main{flex:1;max-width:900px;margin:0 auto;padding:24px 18px 80px;width:100%;display:flex;flex-direction:column;gap:10px}
        .panel{border-radius:14px;border:1px solid var(--border);background:var(--bg2);overflow:hidden;transition:all .3s}
        .panel.active{border-color:rgba(201,168,76,.28);box-shadow:0 0 24px rgba(201,168,76,.04)}
        .panel.done{border-color:rgba(42,157,143,.22);background:linear-gradient(135deg,rgba(42,157,143,.025),var(--bg2))}
        .panel.locked{opacity:.4;pointer-events:none}

        .ph{display:flex;align-items:center;gap:11px;padding:14px 20px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.01)}
        .ph-n{width:28px;height:28px;border-radius:50%;background:rgba(201,168,76,.09);border:1px solid rgba(201,168,76,.28);display:flex;align-items:center;justify-content:center;font-size:.78rem;color:var(--gold);font-weight:700;flex-shrink:0}
        .ph-t{font-size:.96rem;font-weight:600;color:var(--gold2);flex:1}
        .ph-badge{font-size:.72rem;color:var(--teal3);background:rgba(42,157,143,.09);border:1px solid rgba(42,157,143,.22);padding:2px 10px;border-radius:20px}
        .pb{padding:18px 20px}
        .plocked{padding:12px 20px 16px;font-size:.8rem;color:var(--textD);text-align:center}

        /* Reciter grid */
        .rg{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px}
        .rc{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:13px 10px;cursor:pointer;text-align:center;transition:all .2s;position:relative;overflow:hidden}
        .rc::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(201,168,76,.06),transparent);opacity:0;transition:.25s}
        .rc:hover{border-color:rgba(201,168,76,.32);transform:translateY(-2px)}.rc:hover::before{opacity:1}
        .rc.sel{border-color:var(--gold);background:linear-gradient(135deg,rgba(201,168,76,.11),var(--bg3));box-shadow:0 0 14px rgba(201,168,76,.13)}
        .rc-img,.rc-av{width:60px;height:60px;border-radius:50%;margin:0 auto 9px;display:block;border:2px solid var(--border);object-fit:cover;transition:border-color .25s}
        .rc-av{display:flex;align-items:center;justify-content:center;font-size:1.45rem;font-weight:700;background:var(--bg4)}
        .rc.sel .rc-img,.rc.sel .rc-av{border-color:var(--gold)}
        .rc-name{font-size:.73rem;font-weight:600;color:var(--text);line-height:1.3;margin-bottom:2px}
        .rc-style{font-size:.62rem;color:var(--textD)}.rc.sel .rc-name{color:var(--gold2)}

        /* Surah */
        .srch{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 13px;color:var(--text);font-family:var(--font);font-size:.88rem;margin-bottom:10px;outline:none;direction:rtl;transition:border-color .2s}
        .srch:focus{border-color:rgba(201,168,76,.4)}.srch::placeholder{color:var(--textD)}
        .sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px;max-height:290px;overflow-y:auto;padding-left:2px}
        .si{background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:8px 11px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .16s}
        .si:hover{border-color:rgba(201,168,76,.26);background:var(--bg4)}.si.sel{border-color:var(--gold);background:rgba(201,168,76,.07)}
        .si-n{min-width:22px;height:22px;border-radius:50%;background:var(--bg4);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.62rem;color:var(--textD);flex-shrink:0}
        .si.sel .si-n{border-color:var(--gold);color:var(--gold)}
        .si-ar{font-size:.9rem;font-weight:600;color:var(--gold2);flex:1}
        .si-mk{width:5px;height:5px;border-radius:50%;background:var(--gold);flex-shrink:0}
        .si-md{width:5px;height:5px;border-radius:50%;background:var(--teal2);flex-shrink:0}

        /* Toggle */
        .tog-row{display:flex;align-items:center;gap:12px;margin-bottom:14px}
        .tog{width:40px;height:22px;background:var(--bg4);border:1px solid var(--border);border-radius:11px;position:relative;cursor:pointer;transition:background .25s;flex-shrink:0}
        .tog.on{background:var(--teal2);border-color:var(--teal2)}
        .tog::after{content:'';position:absolute;top:3px;right:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .25s}
        .tog.on::after{transform:translateX(-18px)}
        .tog-lbl{font-size:.83rem;color:var(--text);cursor:pointer}
        .rr{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:13px}
        .rg2 label{display:block;font-size:.7rem;color:var(--textD);margin-bottom:4px}
        .ri{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:7px 11px;color:var(--text);font-family:var(--font);font-size:.88rem;outline:none;transition:border-color .2s}
        .ri:focus{border-color:rgba(201,168,76,.4)}

        /* Ayah viz */
        .aviz{margin-top:4px}
        .aviz-bar{width:100%;height:30px;background:var(--bg3);border-radius:7px;border:1px solid var(--border);position:relative;overflow:hidden;margin-bottom:7px}
        .aviz-fill{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,rgba(201,168,76,.15),rgba(201,168,76,.27));border-radius:7px;transition:all .3s}
        .aviz-lbl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--gold)}
        .aviz-dots{display:flex;flex-wrap:wrap;gap:2px;max-height:48px;overflow:hidden}
        .adot{width:6px;height:6px;border-radius:50%}.adot.in{background:var(--gold);opacity:.7}.adot.out{background:var(--bg4)}

        /* Generate */
        .gen-btn{width:100%;padding:13px;background:linear-gradient(135deg,#1a6b60,var(--teal2));border:none;border-radius:11px;color:#fff;font-family:var(--font);font-size:.98rem;font-weight:600;cursor:pointer;transition:all .25s;letter-spacing:.03em}
        .gen-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 22px rgba(42,157,143,.28)}
        .gen-btn:disabled{opacity:.33;cursor:not-allowed}
        .gen-btn.reset{background:var(--bg3);color:var(--textD)}.gen-btn.reset:hover{background:var(--bg4);color:var(--text);transform:none}

        /* Progress */
        .pp{margin-top:16px}
        .pp-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
        .pp-st{display:flex;align-items:center;gap:8px;font-size:.86rem;color:var(--gold2)}
        .pp-dot{width:7px;height:7px;border-radius:50%;background:var(--gold);animation:pulse 1.2s infinite;flex-shrink:0}
        .pp-st.done .pp-dot{background:var(--teal2);animation:none}.pp-st.err .pp-dot{background:var(--red);animation:none}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.7)}}
        .pp-cancel{background:none;border:1px solid rgba(192,57,43,.3);color:var(--red);font-family:var(--font);font-size:.7rem;padding:3px 10px;border-radius:20px;cursor:pointer}
        .pp-bw{background:var(--bg3);border-radius:5px;height:7px;overflow:hidden;margin-bottom:9px}
        .pp-b{height:100%;border-radius:5px;transition:width .4s;background:linear-gradient(90deg,var(--gold),var(--gold2))}
        .pp-b.done{background:linear-gradient(90deg,var(--teal),var(--teal2))}
        .pp-cnt{font-size:.7rem;color:var(--textD);margin-bottom:10px;display:flex;gap:10px}
        .pp-fb{color:var(--gold)}.pp-fail{color:var(--red)}
        .pp-dots{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px}
        .sdt{width:9px;height:9px;border-radius:50%;transition:transform .1s;cursor:default}.sdt:hover{transform:scale(1.5)}
        .sdt.ok{background:var(--teal2)}.sdt.fallback{background:var(--gold)}.sdt.failed{background:var(--red)}.sdt.pending{background:var(--bg4);border:1px solid var(--border)}
        .pp-leg{display:flex;gap:12px;font-size:.66rem;color:var(--textD);margin-bottom:10px}
        .pp-leg span{display:flex;align-items:center;gap:4px}
        .ld{display:inline-block;width:7px;height:7px;border-radius:50%}
        .ld.ok{background:var(--teal2)}.ld.fallback{background:var(--gold)}.ld.failed{background:var(--red)}
        .pp-err{background:rgba(192,57,43,.07);border:1px solid rgba(192,57,43,.26);border-radius:7px;padding:10px 13px;color:#e07060;font-size:.8rem}

        /* Player */
        .player{background:linear-gradient(135deg,var(--bg3),var(--bg4));border:1px solid rgba(201,168,76,.23);border-radius:13px;padding:17px;margin-top:10px}
        .pl-meta{font-size:.7rem;color:var(--textD);margin-bottom:11px;display:flex;justify-content:space-between}
        .pl-fn{direction:ltr;unicode-bidi:isolate;font-size:.65rem}.pl-sz{color:var(--gold)}
        .pl-wf{position:relative;height:68px;background:var(--bg2);border-radius:7px;overflow:hidden;margin-bottom:8px;cursor:pointer}
        .pl-prog{position:absolute;top:0;bottom:0;left:0;background:rgba(201,168,76,.07);pointer-events:none}
        .pl-cv{width:100%;height:100%;display:block}
        .pl-cur{position:absolute;top:0;bottom:0;width:2px;background:var(--gold);pointer-events:none;transition:left .1s linear;box-shadow:0 0 6px var(--gold)}
        .pl-time{display:flex;justify-content:space-between;font-size:.65rem;color:var(--textD);margin-bottom:11px;direction:ltr}
        .pl-ctrl{display:flex;align-items:center;justify-content:center;gap:11px;margin-bottom:11px}
        .pl-skip{background:var(--bg2);border:1px solid var(--border);border-radius:18px;height:32px;padding:0 11px;display:flex;align-items:center;gap:3px;cursor:pointer;color:var(--textD);font-size:.78rem;transition:all .18s}
        .pl-skip:hover{border-color:var(--gold);color:var(--gold)}
        .pl-play{background:linear-gradient(135deg,var(--teal),var(--teal2));border:none;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;font-size:.95rem;transition:all .2s;box-shadow:0 3px 11px rgba(42,157,143,.4)}
        .pl-play:hover{transform:scale(1.07);box-shadow:0 5px 16px rgba(42,157,143,.5)}
        .pl-vol{display:flex;align-items:center;gap:9px;margin-bottom:9px;font-size:.8rem}
        .pl-vs{flex:1;-webkit-appearance:none;height:3px;border-radius:2px;background:var(--bg4);outline:none;cursor:pointer}
        .pl-vs::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--gold);cursor:pointer}
        .pl-dl{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:8px;background:linear-gradient(135deg,rgba(201,168,76,.08),rgba(201,168,76,.15));border:1px solid rgba(201,168,76,.32);border-radius:7px;color:var(--gold2);font-family:var(--font);font-size:.82rem;font-weight:600;text-decoration:none;transition:all .18s}
        .pl-dl:hover{background:linear-gradient(135deg,rgba(201,168,76,.14),rgba(201,168,76,.23))}

        @media(max-width:560px){
          .rg{grid-template-columns:repeat(auto-fill,minmax(100px,1fr))}
          .sg{grid-template-columns:1fr 1fr}
          .rr{grid-template-columns:1fr}
          .main{padding:14px 10px 60px}
          .pb{padding:12px 13px}
          .ph{padding:11px 13px}
          .sb-lbl{font-size:.62rem}
          .sb-dot{width:30px;height:30px;font-size:.8rem}
        }
      `}</style>
    </div>
  );
}
