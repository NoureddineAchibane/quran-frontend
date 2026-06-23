"use client";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAudioGenerator, AyahTiming } from "@/hooks/useAudioGenerator";
import type { HizbGeneratorRequest } from "@/hooks/useAudioGenerator";
import { useMaqasidStream, MaqasidData } from "@/hooks/useMaqasidStream";

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

interface AyahText {
  number:number;
  text:string;
  numberInSurah:number;
  surahNumber:number;
  surahName?:string;
}
interface AyahRef { surah:number; ayah:number; }
function toAr(n:number){ return String(n).replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[+d]); }
function ayahKey(ref:AyahRef){ return `${ref.surah}:${ref.ayah}`; }
function sameAyah(a:AyahRef|null|undefined,b:AyahRef|null|undefined){
  return Boolean(a&&b&&a.surah===b.surah&&a.ayah===b.ayah);
}
function formatAyahRef(ref:AyahRef|null|undefined, compact=false){
  if(!ref)return "";
  return compact ? `${toAr(ref.surah)}:${toAr(ref.ayah)}` : `سورة ${toAr(ref.surah)} · آية ${toAr(ref.ayah)}`;
}
function dedupeAyahs(ayahs: AyahText[]) {
  const seen = new Set<string>();
  return ayahs.filter((ayah) => {
    const key = `${ayah.surahNumber}:${ayah.numberInSurah}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ════════ ISLAMIC SVG ICONS ════════ */
type IcProps = { s?: number; c?: string };

const IcMic = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <rect x="7.5" y="2" width="5" height="9" rx="2.5" fill={c} opacity=".85"/>
    <path d="M4.5 9.5A5.5 5.5 0 0 0 15.5 9.5" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="10" y1="15" x2="10" y2="18" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="6.5" y1="18" x2="13.5" y2="18" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcMicOff = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <rect x="7.5" y="2" width="5" height="9" rx="2.5" fill={c} opacity=".35"/>
    <path d="M4.5 9.5A5.5 5.5 0 0 0 15.5 9.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" opacity=".4"/>
    <line x1="10" y1="15" x2="10" y2="18" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity=".4"/>
    <line x1="3" y1="3" x2="17" y2="17" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const IcStop = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <rect x="5" y="5" width="10" height="10" rx="2" fill={c}/>
  </svg>
);
const IcQuran = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M3 4.5C3 3.7 3.7 3 4.5 3H9.5V17H4.5C3.7 17 3 16.3 3 15.5V4.5Z" fill={c} opacity=".2" stroke={c} strokeWidth="1.2"/>
    <path d="M10.5 3H15.5C16.3 3 17 3.7 17 4.5V15.5C17 16.3 16.3 17 15.5 17H10.5V3Z" fill={c} opacity=".2" stroke={c} strokeWidth="1.2"/>
    <line x1="10" y1="3" x2="10" y2="17" stroke={c} strokeWidth="1.2"/>
    <line x1="5" y1="7" x2="8.5" y2="7" stroke={c} strokeWidth=".9" strokeLinecap="round"/>
    <line x1="5" y1="9.5" x2="8.5" y2="9.5" stroke={c} strokeWidth=".9" strokeLinecap="round"/>
    <line x1="5" y1="12" x2="7" y2="12" stroke={c} strokeWidth=".9" strokeLinecap="round"/>
    <line x1="11.5" y1="7" x2="15" y2="7" stroke={c} strokeWidth=".9" strokeLinecap="round"/>
    <line x1="11.5" y1="9.5" x2="15" y2="9.5" stroke={c} strokeWidth=".9" strokeLinecap="round"/>
    <line x1="11.5" y1="12" x2="13.5" y2="12" stroke={c} strokeWidth=".9" strokeLinecap="round"/>
  </svg>
);
const IcBeads = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="3" r="1.6" fill={c}/>
    <circle cx="15" cy="5.5" r="1.6" fill={c}/>
    <circle cx="17" cy="10" r="1.6" fill={c}/>
    <circle cx="15" cy="14.5" r="1.6" fill={c}/>
    <circle cx="10" cy="17" r="1.6" fill={c}/>
    <circle cx="5" cy="14.5" r="1.6" fill={c}/>
    <circle cx="3" cy="10" r="1.6" fill={c}/>
    <circle cx="5" cy="5.5" r="1.6" fill={c}/>
    <circle cx="10" cy="10" r="2.5" fill={c} opacity=".35"/>
    <path d="M10 1.4V3" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IcEar = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M16 8A6 6 0 1 0 4 8c0 2.5 1.3 4.6 3.2 5.8C8 14.5 8 15.4 8 16.5A1.5 1.5 0 0 0 9.5 18h1A1.5 1.5 0 0 0 12 16.5V15c0-.8.5-1.4 1-2 1.2-1.3 3-2.8 3-5Z" stroke={c} strokeWidth="1.3" fill={c} fillOpacity=".12"/>
    <circle cx="10" cy="8" r="2" fill={c} opacity=".5"/>
  </svg>
);
const IcSearch = ({s=18,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
    <circle cx="7.5" cy="7.5" r="4.5" stroke={c} strokeWidth="1.4"/>
    <line x1="10.8" y1="10.8" x2="15" y2="15" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcClose = ({s=14,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
    <line x1="2.5" y1="2.5" x2="11.5" y2="11.5" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
    <line x1="11.5" y1="2.5" x2="2.5" y2="11.5" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
const IcCheck = ({s=14,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
    <polyline points="2,7 5.5,10.5 12,3" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcPlay = ({s=18,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
    <polygon points="4.5,2.5 15.5,9 4.5,15.5" fill={c}/>
  </svg>
);
const IcPause = ({s=18,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
    <rect x="3.5" y="2.5" width="4" height="13" rx="1.5" fill={c}/>
    <rect x="10.5" y="2.5" width="4" height="13" rx="1.5" fill={c}/>
  </svg>
);
const IcVolume = ({s=18,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
    <path d="M2.5 6.5H5.5L10 3V15L5.5 11.5H2.5Z" fill={c} opacity=".8"/>
    <path d="M12.5 6A3.5 3.5 0 0 1 12.5 12" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M14.5 4A6 6 0 0 1 14.5 14" stroke={c} strokeWidth="1.1" strokeLinecap="round" opacity=".45"/>
  </svg>
);
const IcDownload = ({s=16,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <polyline points="3.5,7 8,11.5 12.5,7" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="8" y1="2" x2="8" y2="11.5" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
    <line x1="2" y1="14" x2="14" y2="14" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const IcReset = ({s=16,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M2.5 8A5.5 5.5 0 1 0 4 4.2L2 2.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="2,2.5 2,6.5 6,6.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcEdit = ({s=15,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 15 15" fill="none">
    <path d="M10 2.5L12.5 5L5.5 12H3V9.5L10 2.5Z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" fill={c} fillOpacity=".18"/>
    <line x1="1" y1="14" x2="14" y2="14" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity=".35"/>
  </svg>
);
const IcEye = ({s=16,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M1.5 8C3.2 5 5.5 3.5 8 3.5S12.8 5 14.5 8C12.8 11 10.5 12.5 8 12.5S3.2 11 1.5 8Z" stroke={c} strokeWidth="1.3"/>
    <circle cx="8" cy="8" r="2.2" fill={c}/>
  </svg>
);
const IcEyeOff = ({s=16,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M1.5 8C3.2 5 5.5 3.5 8 3.5S12.8 5 14.5 8C12.8 11 10.5 12.5 8 12.5S3.2 11 1.5 8Z" stroke={c} strokeWidth="1.3" opacity=".5"/>
    <line x1="2" y1="2" x2="14" y2="14" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const IcScroll = ({s=18,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
    <rect x="4" y="3" width="11" height="13" rx="2" fill={c} fillOpacity=".15" stroke={c} strokeWidth="1.2"/>
    <circle cx="4" cy="4.5" r="2" fill={c} fillOpacity=".25" stroke={c} strokeWidth="1.1"/>
    <circle cx="4" cy="13.5" r="2" fill={c} fillOpacity=".25" stroke={c} strokeWidth="1.1"/>
    <line x1="7" y1="6.5" x2="12" y2="6.5" stroke={c} strokeWidth=".9" strokeLinecap="round"/>
    <line x1="7" y1="9" x2="13" y2="9" stroke={c} strokeWidth=".9" strokeLinecap="round"/>
    <line x1="7" y1="11.5" x2="10.5" y2="11.5" stroke={c} strokeWidth=".9" strokeLinecap="round"/>
  </svg>
);
const IcCrescent = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M14 3.8A7.5 7.5 0 1 1 5.5 16.5A5.5 5.5 0 0 0 14 3.8Z" fill={c} opacity=".9"/>
  </svg>
);
const IcSun = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="3.5" fill={c}/>
    <line x1="10" y1="2" x2="10" y2="4" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
    <line x1="10" y1="16" x2="10" y2="18" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
    <line x1="2" y1="10" x2="4" y2="10" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
    <line x1="16" y1="10" x2="18" y2="10" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
    <line x1="4.1" y1="4.1" x2="5.5" y2="5.5" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="14.5" y1="14.5" x2="15.9" y2="15.9" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="15.9" y1="4.1" x2="14.5" y2="5.5" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="5.5" y1="14.5" x2="4.1" y2="15.9" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IcArrowR = ({s=13,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 13 13" fill="none">
    <polyline points="3.5,2.5 9.5,6.5 3.5,10.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcArrowL = ({s=13,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 13 13" fill="none">
    <polyline points="9.5,2.5 3.5,6.5 9.5,10.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcDiamond = ({s=10,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 10 10" fill="none">
    <polygon points="5,1 9,5 5,9 1,5" fill={c} opacity=".8"/>
  </svg>
);
const IcHizb = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7.5" stroke={c} strokeWidth="1.2" opacity=".5"/>
    <circle cx="10" cy="10" r="4" stroke={c} strokeWidth="1.2"/>
    <line x1="10" y1="2.5" x2="10" y2="5" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="10" y1="15" x2="10" y2="17.5" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="2.5" y1="10" x2="5" y2="10" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="15" y1="10" x2="17.5" y2="10" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="10" cy="10" r="1.5" fill={c}/>
  </svg>
);

const IcHistory = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7.5" stroke={c} strokeWidth="1.3"/>
    <path d="M10 6v4l3 2" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.5 3.5L1 6" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M1 3.5h2.5v2.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity=".7"/>
  </svg>
);
const IcWird = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.2"/>
    <path d="M10 10 L10 4" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M10 10 L14 12" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="10" cy="10" r="1.3" fill={c}/>
  </svg>
);
const IcStar = ({s=18,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
    <polygon points="9,2 10.9,7.1 16.3,7.1 12,10.4 13.9,15.5 9,12.2 4.1,15.5 6,10.4 1.7,7.1 7.1,7.1" fill={c} opacity=".85"/>
  </svg>
);
const IcTarget = ({s=20,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7.5" stroke={c} strokeWidth="1.1" opacity=".4"/>
    <circle cx="10" cy="10" r="5" stroke={c} strokeWidth="1.2" opacity=".65"/>
    <circle cx="10" cy="10" r="2.5" fill={c} opacity=".9"/>
  </svg>
);
const IcFullscreen = ({s=18,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,8 3,3 8,3"/><polyline points="17,8 17,3 12,3"/>
    <polyline points="3,12 3,17 8,17"/><polyline points="17,12 17,17 12,17"/>
  </svg>
);
const IcExitFullscreen = ({s=18,c="currentColor"}:IcProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8,3 8,8 3,8"/><polyline points="12,3 12,8 17,8"/>
    <polyline points="8,17 8,12 3,12"/><polyline points="12,17 12,12 17,12"/>
  </svg>
);

interface Hizb {
  hizb_num: number; juz_num: number;
  start_surah: number; start_ayah: number;
  end_surah: number; end_ayah: number;
}
interface HistoryEntry {
  id?: number;
  device_id: string;
  hizb_num?: number|null;
  surah_num?: number|null;
  ayah_min?: number|null;
  ayah_max?: number|null;
  session_mode: string;
  completed_at?: string;
}
type SessionMode = 'wird'|'hifd'|'free';

const JUZ_NAMES: Record<number,string> = {
  1:"الأول",2:"الثاني",3:"الثالث",4:"الرابع",5:"الخامس",
  6:"السادس",7:"السابع",8:"الثامن",9:"التاسع",10:"العاشر",
  11:"الحادي عشر",12:"الثاني عشر",13:"الثالث عشر",14:"الرابع عشر",15:"الخامس عشر",
  16:"السادس عشر",17:"السابع عشر",18:"الثامن عشر",19:"التاسع عشر",20:"العشرون",
  21:"الحادي والعشرون",22:"الثاني والعشرون",23:"الثالث والعشرون",24:"الرابع والعشرون",25:"الخامس والعشرون",
  26:"السادس والعشرون",27:"السابع والعشرون",28:"الثامن والعشرون",29:"التاسع والعشرون",30:"الثلاثون",
};

function HizbPicker({ ahzab, surahs, selected, onSelect, completedHizbs, suggestHizb }:{
  ahzab: Hizb[]; surahs: any[]; selected: Hizb|null; onSelect:(h:Hizb)=>void;
  completedHizbs?: Set<number>; suggestHizb?: number;
}) {
  const [activeJuz, setActiveJuz] = useState(1);
  const surahName = (id:number) => surahs.find(s=>s.id===id)?.name_arabic ?? `سورة ${id}`;
  const juzes = Array.from({length:30},(_,i)=>i+1);
  const hizbsForJuz = ahzab.filter(h=>h.juz_num===activeJuz);
  const done = completedHizbs ?? new Set<number>();

  // Auto-scroll to the juz that has the suggested hizb
  useEffect(()=>{
    if(suggestHizb && ahzab.length){
      const h = ahzab.find(h=>h.hizb_num===suggestHizb);
      if(h) setActiveJuz(h.juz_num);
    }
  },[suggestHizb, ahzab]);

  // Count done in this juz
  const doneInJuz = (j:number) => ahzab.filter(h=>h.juz_num===j && done.has(h.hizb_num)).length;

  return (
    <div className="hpicker">
      {/* Progress bar */}
      {done.size > 0 && (
        <div className="hpicker-progress">
          <div className="hpicker-prog-bar" style={{width:`${(done.size/60)*100}%`}}/>
          <span className="hpicker-prog-lbl">{toAr(done.size)}/٦٠ حزب مكتمل</span>
        </div>
      )}

      {/* Juz selector pill tabs */}
      <div className="hpicker-juz-wrap">
        <div className="hpicker-juz-track">
          {juzes.map(j=>(
            <button key={j} className={`hpicker-juz-btn${activeJuz===j?" active":""}${doneInJuz(j)===2?" done":doneInJuz(j)===1?" half":""}`}
              onClick={()=>setActiveJuz(j)}>
              {toAr(j)}
              {doneInJuz(j)===2 && <span className="hpicker-juz-dot"/>}
            </button>
          ))}
        </div>
      </div>

      {/* Active juz label */}
      <div className="hpicker-juz-lbl">
        <span className="hpicker-juz-name">الجزء {JUZ_NAMES[activeJuz]}</span>
        {selected?.juz_num===activeJuz&&(
          <span className="hpicker-sel-badge"><IcCheck s={11} c="var(--teal3)"/> محدد</span>
        )}
      </div>

      {/* Two hizb cards for this juz */}
      <div className="hpicker-cards">
        {hizbsForJuz.map((h,i)=>{
          const isSel = selected?.hizb_num===h.hizb_num;
          const isDone = done.has(h.hizb_num);
          const isSugg = suggestHizb===h.hizb_num;
          const spansSurahs = h.start_surah !== h.end_surah;
          return (
            <div key={h.hizb_num} className={`hcard${isSel?" hcard-sel":""}${isDone?" hcard-done":""}${isSugg&&!isDone?" hcard-sugg":""}`}
              onClick={()=>onSelect(h)}>
              <div className="hcard-badge">
                <IcHizb s={14} c={isSel?"var(--gold)":isDone?"var(--teal2)":"currentColor"}/>
                <span>حزب {toAr(h.hizb_num)}</span>
                <span className="hcard-half">{i===0?"النصف الأول":"النصف الثاني"}</span>
                {isDone && <span className="hcard-done-badge"><IcCheck s={10} c="var(--teal3)"/> تم</span>}
                {isSugg && !isDone && <span className="hcard-sugg-badge">التالي ▸</span>}
              </div>
              <div className="hcard-range">
                <div className="hcard-point">
                  <span className="hcard-pt-lbl">من</span>
                  <span className="hcard-surah">{surahName(h.start_surah)}</span>
                  <span className="hcard-ayah">آية {toAr(h.start_ayah)}</span>
                </div>
                {spansSurahs&&<div className="hcard-arrow">←</div>}
                <div className="hcard-point">
                  <span className="hcard-pt-lbl">إلى</span>
                  <span className="hcard-surah">{surahName(h.end_surah)}</span>
                  <span className="hcard-ayah">آية {toAr(h.end_ayah)}</span>
                </div>
              </div>
              {isSel&&<div className="hcard-glow"/>}
            </div>
          );
        })}
      </div>

      {/* Summary of selected */}
      {selected&&(
        <div className="hpicker-sel-summary">
          <IcHizb s={15} c="var(--gold)"/>
          <span>الحزب {toAr(selected.hizb_num)} · الجزء {toAr(selected.juz_num)}</span>
          <span className="hpicker-sel-range">
            {surahName(selected.start_surah)} {toAr(selected.start_ayah)}
            &nbsp;—&nbsp;
            {surahName(selected.end_surah)} {toAr(selected.end_ayah)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ════════ MODE SELECTION SCREEN ════════ */
function ModeSelectionScreen({ onSelect }:{ onSelect:(m:SessionMode)=>void }) {
  const [hov, setHov] = useState<SessionMode|null>(null);
  const modes: { key: SessionMode; icon: React.ReactNode; title: string; desc: string; accent: string }[] = [
    { key:'wird',  icon:<IcWird s={40} c="var(--teal2)"/>,   title:'ورد يومي', desc:'تتبع قراءتك اليومية وختمتك', accent:'teal' },
    { key:'hifd',  icon:<IcTarget s={40} c="var(--gold)"/>,  title:'حفظ',      desc:'راجع محفوظاتك وتقدّمك',     accent:'gold' },
    { key:'free',  icon:<IcPlay s={40} c="var(--textD)"/>,   title:'قراءة حرة', desc:'استمع بحرية بلا تتبع',     accent:'dim'  },
  ];
  return (
    <div className="mode-screen">
      <div className="mode-screen-inner">
        <div className="mode-screen-top">
          <div className="mode-screen-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
          <h2 className="mode-screen-title">مُصحف الصوت</h2>
          <p className="mode-screen-sub">اختر نوع جلستك اليوم</p>
        </div>
        <div className="mode-cards">
          {modes.map(m=>(
            <button key={m.key} className={`mode-card mode-card-${m.accent}${hov===m.key?" mode-card-hov":""}`}
              onMouseEnter={()=>setHov(m.key)} onMouseLeave={()=>setHov(null)}
              onClick={()=>onSelect(m.key)}>
              <div className="mode-card-icon">{m.icon}</div>
              <div className="mode-card-title">{m.title}</div>
              <div className="mode-card-desc">{m.desc}</div>
              <div className="mode-card-arrow"><IcArrowL s={14} c="currentColor"/></div>
            </button>
          ))}
        </div>
        <p className="mode-screen-note">يمكنك تغيير الوضع في أي وقت من الشريط العلوي</p>
      </div>
    </div>
  );
}

/* ════════ HISTORY PANEL ════════ */
function mergeIntervals(ranges: [number,number][]): number {
  if(!ranges.length) return 0;
  const s = [...ranges].sort((a,b)=>a[0]-b[0]);
  let count=0, cur=s[0];
  for(let i=1;i<s.length;i++){
    if(s[i][0]<=cur[1]+1) cur=[cur[0],Math.max(cur[1],s[i][1])];
    else { count+=cur[1]-cur[0]+1; cur=s[i]; }
  }
  return count + cur[1]-cur[0]+1;
}

function HistoryPanel({ show, onClose, history, ahzab, surahs }:{
  show:boolean; onClose:()=>void; history:HistoryEntry[]; ahzab:Hizb[]; surahs:any[];
}) {
  const [tab,setTab]=useState<'wird'|'hifd'>('wird');

  const completedSet = new Set(history.filter(h=>h.hizb_num).map(h=>h.hizb_num as number));
  const total = completedSet.size;
  const pct = Math.round((total/60)*100);

  // ── Hifd stats ──────────────────────────────────────────────────────────
  const TOTAL_QURAN_AYAHS = 6236;
  const hifdEntries = history.filter(h=>h.session_mode==='hifd'&&h.surah_num&&h.ayah_min&&h.ayah_max);

  const hifdBySurah = new Map<number,[number,number][]>();
  hifdEntries.forEach(h=>{
    if(!h.surah_num||!h.ayah_min||!h.ayah_max) return;
    if(!hifdBySurah.has(h.surah_num)) hifdBySurah.set(h.surah_num,[]);
    hifdBySurah.get(h.surah_num)!.push([h.ayah_min,h.ayah_max]);
  });

  const hifdSurahs = Array.from(hifdBySurah.entries()).map(([surahId,ranges])=>{
    const sd = surahs.find((s:any)=>s.id===surahId);
    const totalAyahs = sd?.verses_count ?? 1;
    const hifded = Math.min(mergeIntervals(ranges), totalAyahs);
    const surahPct = Math.round((hifded/totalAyahs)*100);
    return { surahId, surahName: sd?.name_arabic ?? `سورة ${surahId}`, surahPct, hifded, totalAyahs };
  }).sort((a,b)=>b.surahPct-a.surahPct);

  const totalHifdedAyahs = hifdSurahs.reduce((s,x)=>s+x.hifded,0);
  const quranHifdPct = Math.min(Math.round((totalHifdedAyahs/TOTAL_QURAN_AYAHS)*100),100);
  const completedSurahs = hifdSurahs.filter(s=>s.surahPct===100).length;
  const inProgressSurahs = hifdSurahs.filter(s=>s.surahPct<100).length;

  // ring constants
  const R=34, CIRC=2*Math.PI*R;
  const ringDash = (CIRC * pct/100).toFixed(1);
  const hifdDash = (CIRC * quranHifdPct/100).toFixed(1);

  const formatDate = (iso?:string) => {
    if(!iso) return '';
    try { return new Date(iso).toLocaleDateString('ar-MA',{day:'2-digit',month:'short'}); }
    catch { return ''; }
  };
  const modeLabel = (m:string) => m==='wird'?'ورد':m==='hifd'?'حفظ':'حر';
  const modeColor = (m:string) => m==='wird'?'var(--teal2)':m==='hifd'?'var(--gold)':'var(--textD)';

  const hasHifd = hifdSurahs.length > 0;

  return (
    <>
      <div className={`hist-overlay${show?' hist-overlay-show':''}`} onClick={onClose}/>
      <div className={`hist-panel${show?' hist-panel-open':''}`} role="dialog" aria-label="سجل القراءة">
        <div className="hist-hdr">
          <span className="hist-title"><IcHistory s={18} c="var(--gold)"/> سجل القراءة</span>
          <button className="hist-close" onClick={onClose}><IcClose s={13} c="currentColor"/></button>
        </div>

        {/* Tab switcher */}
        {hasHifd && (
          <div className="hist-tabs">
            <button className={`hist-tab${tab==='wird'?' hist-tab-active':''}`} onClick={()=>setTab('wird')}>
              <IcWird s={13} c="currentColor"/> قراءة / ورد
            </button>
            <button className={`hist-tab${tab==='hifd'?' hist-tab-active':''}`} onClick={()=>setTab('hifd')}>
              <IcTarget s={13} c="currentColor"/> إحصائيات الحفظ
            </button>
          </div>
        )}

        {/* ══ TAB: WIRD / READING ══ */}
        {tab==='wird' && (<>
          {/* Stats bar */}
          <div className="hist-stats">
            <div className="hist-stat">
              <span className="hist-stat-n">{toAr(total)}</span>
              <span className="hist-stat-l">حزب مكتمل</span>
            </div>
            <div className="hist-stat-div"/>
            <div className="hist-stat">
              <span className="hist-stat-n">{toAr(pct)}٪</span>
              <span className="hist-stat-l">من القرآن</span>
            </div>
            <div className="hist-stat-div"/>
            <div className="hist-stat">
              <span className="hist-stat-n">{toAr(history.length)}</span>
              <span className="hist-stat-l">جلسة</span>
            </div>
          </div>
          <div className="hist-prog-wrap">
            <div className="hist-prog-bar" style={{width:`${pct}%`}}/>
          </div>

          {/* 60-hizb grid */}
          <div className="hist-grid-hdr">خريطة الأحزاب الستين</div>
          <div className="hist-grid">
            {Array.from({length:60},(_,i)=>i+1).map(n=>{
              const isDone = completedSet.has(n);
              const h = ahzab.find(x=>x.hizb_num===n);
              return (
                <div key={n} className={`hist-cell${isDone?' hist-cell-done':''}`}
                  title={isDone?`حزب ${n} — جزء ${h?.juz_num??''}`:`حزب ${n}`}>
                  {isDone ? <IcCheck s={9} c="var(--teal2)"/> : <span className="hist-cell-n">{toAr(n)}</span>}
                </div>
              );
            })}
          </div>

          {/* Recent sessions */}
          {history.length > 0 ? (<>
            <div className="hist-list-hdr">آخر الجلسات</div>
            <div className="hist-list">
              {history.slice(0,30).map((e,i)=>{
                const hizbData = e.hizb_num ? ahzab.find(h=>h.hizb_num===e.hizb_num) : null;
                const surahData = e.surah_num ? surahs.find((s:any)=>s.id===e.surah_num) : null;
                return (
                  <div key={i} className="hist-entry">
                    <div className="hist-entry-left">
                      <span className="hist-entry-mode" style={{color:modeColor(e.session_mode)}}>{modeLabel(e.session_mode)}</span>
                      <span className="hist-entry-what">
                        {hizbData ? `حزب ${toAr(hizbData.hizb_num)} · ج${toAr(hizbData.juz_num)}` :
                         surahData ? surahData.name_arabic : '—'}
                      </span>
                    </div>
                    <span className="hist-entry-date">{formatDate(e.completed_at)}</span>
                  </div>
                );
              })}
            </div>
          </>) : (
            <div className="hist-empty">
              <IcQuran s={32} c="var(--border)"/>
              <p>لا يوجد سجل بعد<br/>أكمل أول جلسة لتبدأ التتبع</p>
            </div>
          )}
        </>)}

        {/* ══ TAB: HIFD STATS ══ */}
        {tab==='hifd' && (<>
          {/* Ring + counters */}
          <div className="hifd-ring-row">
            <svg className="hifd-ring-svg" viewBox="0 0 80 80" width="80" height="80">
              <circle cx="40" cy="40" r={R} fill="none" stroke="var(--bg3)" strokeWidth="9"/>
              <circle cx="40" cy="40" r={R} fill="none" stroke="var(--gold)" strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${hifdDash} ${CIRC.toFixed(1)}`}
                transform="rotate(-90 40 40)"
                style={{transition:'stroke-dasharray .6s ease'}}/>
              <text x="40" y="36" textAnchor="middle" fill="var(--gold)"
                fontSize="13" fontWeight="700" fontFamily="var(--ff)">{toAr(quranHifdPct)}٪</text>
              <text x="40" y="50" textAnchor="middle" fill="var(--textD)"
                fontSize="6.5" fontFamily="var(--ff)">من القرآن</text>
            </svg>
            <div className="hifd-ring-stats">
              <div className="hifd-rstat">
                <span className="hifd-rstat-n" style={{color:'var(--teal2)'}}>{toAr(completedSurahs)}</span>
                <span className="hifd-rstat-l">سورة مكتملة</span>
              </div>
              <div className="hifd-rstat">
                <span className="hifd-rstat-n" style={{color:'var(--gold)'}}>{toAr(inProgressSurahs)}</span>
                <span className="hifd-rstat-l">في التقدم</span>
              </div>
              <div className="hifd-rstat">
                <span className="hifd-rstat-n">{toAr(totalHifdedAyahs)}</span>
                <span className="hifd-rstat-l">آية محفوظة</span>
              </div>
            </div>
          </div>

          {/* Per-surah bars */}
          <div className="hist-grid-hdr" style={{marginTop:'1rem'}}>
            تقدم الحفظ — سورة بسورة
          </div>
          <div className="hifd-surah-list">
            {hifdSurahs.map(({surahId,surahName,surahPct,hifded,totalAyahs})=>(
              <div key={surahId} className="hifd-surah-row">
                <div className="hifd-surah-top">
                  <span className="hifd-surah-name">{surahName}</span>
                  <span className={`hifd-surah-pct${surahPct===100?' hifd-pct-done':''}`}>
                    {surahPct===100
                      ? <><IcCheck s={11} c="var(--teal2)"/> مكتملة</>
                      : <>{toAr(hifded)}<span className="hifd-pct-sep">/</span>{toAr(totalAyahs)} آية — {toAr(surahPct)}٪</>
                    }
                  </span>
                </div>
                <div className="hifd-bar-track">
                  <div className="hifd-bar-fill"
                    style={{
                      width:`${surahPct}%`,
                      background: surahPct===100
                        ? 'linear-gradient(90deg,var(--teal3),var(--teal2))'
                        : 'linear-gradient(90deg,var(--gold),#f0b429)',
                    }}/>
                </div>
              </div>
            ))}
          </div>
        </>)}
      </div>
    </>
  );
}

const STEPS = [
  { id:1, ar:"القارئ",    icon:<IcMic s={16}/> },
  { id:2, ar:"السورة",   icon:<IcQuran s={16}/> },
  { id:3, ar:"الآيات",   icon:<IcBeads s={16}/> },
  { id:4, ar:"الاستماع", icon:<IcEar s={16}/> },
];

interface WordResult { word: string; status: 'correct' | 'wrong' | 'missing'; }

/** Strip ALL tashkeel/shakl (harakat, shadda, sukun, tanwin), normalise letter
 *  variants (alef forms, ya, ta-marbuta, hamza seats) so that comparison is
 *  purely on root letter shape — just like a human teacher would judge. */
function normalizeAr(text: string): string {
  return text
    // Harakat & diacritics (U+064B–U+065F covers all fatha/damma/kasra/sukun/shadda/tanwin)
    .replace(/[\u064B-\u065F]/g, '')
    // Extended Arabic marks (U+0610–U+061A)
    .replace(/[\u0610-\u061A]/g, '')
    // Quranic annotation signs (U+06D6–U+06ED)
    .replace(/[\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]/g, '')
    // Alef with hamza above/below/madda, alef wasla → plain alef
    .replace(/[أإآٱ]/g, 'ا')
    // Alef maqsura → ya
    .replace(/ى/g, 'ي')
    // Ta marbuta → ha (often pronounced ha at pause)
    .replace(/ة/g, 'ه')
    // Waw with hamza → waw
    .replace(/ؤ/g, 'و')
    // Ya with hamza → ya
    .replace(/ئ/g, 'ي')
    // Standalone hamza — frequently dropped in natural speech recognition
    .replace(/ء/g, '')
    // Tatweel / kashida
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein-based character-level similarity [0..1].
 *  Used to catch near-matches where speech recognition slightly mis-transcribed
 *  a word (e.g. "الرحمان" vs "الرحمن"). */
function letterSim(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  const dp: number[] = Array.from({length: n+1}, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i-1] === b[j-1] ? prev : 1 + Math.min(prev, dp[j], dp[j-1]);
      prev = tmp;
    }
  }
  return 1 - dp[n] / Math.max(m, n);
}

/** Align two word arrays via LCS, using letter-similarity ≥ 0.72 as a
 *  "fuzzy match" so that minor speech-recognition noise doesn't penalise
 *  a word the user clearly said correctly. */
function alignWords(orig: string[], recog: string[]): Set<number> {
  const m = orig.length, n = recog.length;
  // dp[i][j] = length of best alignment for orig[0..i-1] vs recog[0..j-1]
  const dp: number[][] = Array.from({length: m+1}, () => new Array(n+1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = letterSim(orig[i-1], recog[j-1]) >= 0.72
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);

  // Backtrack to collect matched original indices
  const matched = new Set<number>();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (letterSim(orig[i-1], recog[j-1]) >= 0.72 && dp[i][j] === dp[i-1][j-1]+1) {
      matched.add(i-1); i--; j--;
    } else if (dp[i-1][j] >= dp[i][j-1]) i--;
    else j--;
  }
  return matched;
}

/** Compare what the user recited against the original ayah.
 *  Returns each original word tagged as:
 *   • correct  — word found (in-order) in the recognised transcript, possibly fuzzy
 *   • wrong    — word position exists in transcript but clearly different
 *   • missing  — transcript ran out before this word was reached */
function compareAyah(original: string, recognized: string): WordResult[] {
  const origWords  = original.split(/\s+/).filter(Boolean);
  const normOrig   = origWords.map(normalizeAr);
  const normRecog  = normalizeAr(recognized).split(/\s+/).filter(Boolean);

  const matchedIdx = alignWords(normOrig, normRecog);

  return origWords.map((word, i) => ({
    word,
    status: matchedIdx.has(i) ? 'correct'
          : i < normRecog.length ? 'wrong'
          : 'missing',
  }));
}

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
                <span className={`sb-sep${(done||active)?" lit":""}`}>‹</span>
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
        {selected && !playing && <div className="rc-check"><IcCheck s={11} c="#fff"/></div>}
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
      {playing && <div className="rc-preview-lbl"><IcPlay s={10} c="var(--teal3)"/> معاينة</div>}
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
      <IcScroll s={16} c="currentColor"/> التفسير الميسر
    </button>
  );

  return (
    <div className="tf-panel">
      <div className="tf-header">
        <span style={{display:"flex",alignItems:"center",gap:6}}><IcScroll s={14} c="var(--gold2)"/> التفسير الميسر — آية {toAr(ayahNum)}</span>
        <button className="tf-close" onClick={()=>{ setOpen(false); onToggle?.(false); }}><IcClose s={12} c="currentColor"/></button>
      </div>
      {loading
        ? <div className="tf-loading"><span className="mq-spin"/>جارٍ تحميل التفسير...</div>
        : <p className="tf-text">{text}</p>
      }
      <p className="tf-source">التفسير الميسر — نخبة من العلماء · jsDelivr CDN</p>
    </div>
  );
}

/* ════════ MAQASID PANEL — Offline Ollama / Gemma Streaming ════════ */
const maqasidCache: Record<string,MaqasidData> = {};

function MaqasidPanel({ surahNum, surahName, ayahNum, ayahText }:{
  surahNum:number; surahName:string; ayahNum:number; ayahText:string;
}) {
  const cacheKey = `${surahNum}:${ayahNum}`;
  const [data,setData] = useState<MaqasidData|null>(maqasidCache[cacheKey]??null);
  const [open,setOpen] = useState(false);
  const { analyze, reset, status, draft, error, model, cached } = useMaqasidStream();
  const loading = status==="connecting" || status==="streaming";
  const displayModel = model || "gemma:2b";

  useEffect(()=>{
    setData(maqasidCache[cacheKey]??null);
    setOpen(false);
    reset();
  },[cacheKey, reset]);

  const doFetch = useCallback(async()=>{
    if(maqasidCache[cacheKey]){
      setData(maqasidCache[cacheKey]);
      setOpen(true);
      return;
    }

    setOpen(true);
    try {
      const parsed = await analyze({ surahNum, surahName, ayahNum, ayahText });
      maqasidCache[cacheKey] = parsed;
      setData(parsed);
    } catch {}
  },[analyze, ayahNum, ayahText, cacheKey, surahName, surahNum]);

  if(!open) return (
    <button className="mq-trigger" onClick={doFetch}>
      <><IcCrescent s={16} c="currentColor"/> المقاصد والفوائد</>
    </button>
  );

  return (
    <div className="mq-panel">
      <div className="mq-hdr">
        <span className="mq-title" style={{display:"flex",alignItems:"center",gap:6}}><IcCrescent s={14} c="var(--gold2)"/> مقاصد الآية {toAr(ayahNum)}</span>
        <button className="mq-x" onClick={()=>{ setOpen(false); reset(); }}><IcClose s={12} c="currentColor"/></button>
      </div>

      <div className="mq-sub">
        <span className="mq-subpill">محلي عبر Ollama</span>
        <span className="mq-subtxt">{displayModel}{cached?" · من الذاكرة":""}</span>
      </div>

      {loading&&<div className="mq-loading"><span className="mq-spin"/>جارٍ التحليل الشرعي المحلي مع بث مباشر...</div>}

      {!!draft&&loading&&(
        <div className="mq-live">
          <div className="mq-live-hdr">
            <span className="mq-badge mq-b2">بث مباشر</span>
            <span className="mq-live-note">الاستجابة تتشكل لحظةً بلحظة قبل تنسيقها</span>
          </div>
          <p className="mq-live-txt">{draft}</p>
        </div>
      )}

      {error&&!loading&&(
        <div className="mq-keybox">
          <p className="mq-kerr">{error}</p>
          <button className="mq-kbtn" style={{marginTop:4}} onClick={doFetch}>
            إعادة التحليل
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
          <p className="mq-src">مدعوم محلياً بـ Ollama · {displayModel}</p>
        </div>
      )}
    </div>
  );
}

/* ════════ QURAN TEXT PANEL ════════ */
function QuranTextPanel({ ayahs, surahNum, surahName, activeAyah, onAyahClick, scrollRef }:{
  ayahs:AyahText[]; surahNum:number; surahName:string;
  activeAyah:AyahRef|null; onAyahClick?:(ref:AyahRef)=>void;
  scrollRef?: React.RefObject<HTMLDivElement>;
}) {
  const [selectedAyah,setSelectedAyah] = useState<AyahRef|null>(null);
  const [tafsirWasOpen,setTafsirWasOpen] = useState(false);
  const [copied,setCopied] = useState(false);
  const activeRef = useRef<HTMLSpanElement|null>(null);

  useEffect(()=>{ activeRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"}); },[activeAyah]);
  useEffect(()=>{ setCopied(false); },[selectedAyah]);

  if(!ayahs.length) return null;

  const handleClick = (ref:AyahRef)=>{
    setSelectedAyah(sameAyah(selectedAyah,ref)?null:ref);
    onAyahClick?.(ref);
  };
  const selectedAyahText = selectedAyah
    ? ayahs.find(a=>a.surahNumber===selectedAyah.surah&&a.numberInSurah===selectedAyah.ayah)
    : null;
  const copySelectedAyah = async()=>{
    if(!selectedAyah||!selectedAyahText)return;
    const name = selectedAyahText.surahName ?? surahName;
    const text = `${selectedAyahText.text}\n\nسورة ${name}، الآية ${toAr(selectedAyah.ayah)}`;
    try {
      if(navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly","");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const firstAyah = ayahs[0]?.numberInSurah ?? 1;
  const lastAyah  = ayahs[ayahs.length-1]?.numberInSurah ?? 1;
  const isMultiSurah = new Set(ayahs.map(a=>a.surahNumber)).size > 1;
  const grouped = ayahs.reduce((acc,a)=>{
    const last = acc[acc.length-1];
    if(last&&last.surahNumber===a.surahNumber) last.ayahs.push(a);
    else acc.push({surahNumber:a.surahNumber, surahName:a.surahName??surahName, ayahs:[a]});
    return acc;
  }, [] as {surahNumber:number; surahName:string; ayahs:AyahText[]}[]);

  return (
    <div className="qtext-outer">
      <div className="mushaf-page">
        {/* corner ornaments */}
        <span className="mc mc-tl"/>
        <span className="mc mc-tr"/>
        <span className="mc mc-bl"/>
        <span className="mc mc-br"/>
        <div className="mushaf-inner">
          {/* surah header */}
          <div className="mushaf-hdr">
            <div className="mushaf-hdr-title">
              <span className="mushaf-bracket">﴾</span>
              <span className="mushaf-sname">{isMultiSurah ? "نص الحزب" : `سُورَةُ ${surahName}`}</span>
              <span className="mushaf-bracket">﴿</span>
            </div>
            <div className="mushaf-hdr-sub">
              {isMultiSurah
                ? `${toAr(ayahs.length)} آية عبر ${toAr(grouped.length)} سور`
                : firstAyah===lastAyah
                ? `الآية الكريمة ${toAr(firstAyah)}`
                : `الآيات الكريمة ${toAr(firstAyah)} – ${toAr(lastAyah)}`}
            </div>
          </div>

          {/* flowing quran text */}
          <div className="mushaf-text-wrap" ref={scrollRef}>
            {grouped.map(group=>{
              const showBasmala = group.ayahs[0]?.numberInSurah===1 && group.surahNumber!==9;
              return (
                <div key={group.surahNumber} className="mushaf-surah-section">
                  {isMultiSurah&&(
                    <div className="mushaf-hdr-sub" style={{margin:"16px 0 8px"}}>
                      سُورَةُ {group.surahName}
                    </div>
                  )}
                  {showBasmala&&(
                    <div className="mushaf-basmala">
                      بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِیمِ
                    </div>
                  )}
                  <p className="mushaf-text">
                    {group.ayahs.map(a=>{
                      const ref = {surah:a.surahNumber, ayah:a.numberInSurah};
                      const isActive = sameAyah(activeAyah,ref);
                      const isSelected = sameAyah(selectedAyah,ref);
                      return (
                        <span key={`${a.surahNumber}:${a.numberInSurah}`}
                          ref={isActive?activeRef:null}
                          className={`qayah${isActive?" playing":""}${isSelected?" selected":""}`}
                          onClick={()=>handleClick(ref)}
                        >
                          {a.text}
                          <span className="mushaf-anum">{String.fromCodePoint(0x06DD)}{toAr(a.numberInSurah)}</span>
                        </span>
                      );
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ayah detail drawer */}
      {selectedAyah && (
        <div className="ayah-drawer">
          <div className="ayah-drawer-header">
            <span className="ayah-drawer-num">{formatAyahRef(selectedAyah)}</span>
            <button className="ayah-drawer-close" onClick={()=>setSelectedAyah(null)}><IcClose s={12} c="currentColor"/></button>
          </div>
          <div className="ayah-actions">
            <button className={`copy-ayah-btn${copied?" copied":""}`} onClick={copySelectedAyah}>
              {copied ? "تم نسخ الآية" : "نسخ الآية"}
            </button>
            <TafsirPanel
              key={`tafsir-${ayahKey(selectedAyah)}`}
              surahNum={selectedAyah.surah} ayahNum={selectedAyah.ayah}
              autoLoad={tafsirWasOpen}
              onToggle={setTafsirWasOpen}
            />
            <MaqasidPanel key={`maqasid-${ayahKey(selectedAyah)}`} surahNum={selectedAyah.surah}
              surahName={ayahs.find(a=>a.surahNumber===selectedAyah.surah)?.surahName??surahName}
              ayahNum={selectedAyah.ayah}
              ayahText={ayahs.find(a=>a.surahNumber===selectedAyah.surah&&a.numberInSurah===selectedAyah.ayah)?.text??""}/>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════ SYNCED PLAYER ════════ */
function SyncPlayer({ url, filename, sizeKb, timings, onAyahChange, onSeekToAyah,
  onPlayChange, onProgress, onExposeControls, baseSurah, speed, autoReplay,
  onSpeedChange, onAutoReplayChange, onTimeChange }:{
  url:string; filename:string; sizeKb:number|null;
  timings:AyahTiming[];
  onAyahChange:(ref:AyahRef|null)=>void;
  onSeekToAyah:(fn:(ref:AyahRef)=>void)=>void;
  onPlayChange?:(p:boolean)=>void;
  onProgress?:(cur:number,dur:number)=>void;
  onExposeControls?:(c:{toggle:()=>void;skip:(s:number)=>void;seekPct:(p:number)=>void})=>void;
  baseSurah:number;
  speed:number;
  autoReplay:boolean;
  onSpeedChange:(speed:number)=>void;
  onAutoReplayChange:(enabled:boolean)=>void;
  onTimeChange?:(cur:number,dur:number)=>void;
}) {
  const aRef = useRef<HTMLAudioElement|null>(null);
  const cvRef = useRef<HTMLCanvasElement|null>(null);
  const bars = useRef<number[]>([]);
  const [playing,setPlaying]=useState(false);
  const [cur,setCur]=useState(0);
  const [dur,setDur]=useState(0);
  const [vol,setVol]=useState(1);
  const [curIdx,setCurIdx]=useState(0);
  const curIdxRef=useRef(0);
  const [replayCount,setReplayCount]=useState(3);
  const [replayDone,setReplayDone]=useState(0);
  const playingRef=useRef(false);
  const speedRef=useRef(1);
  const autoReplayRef=useRef(false);
  const replayCountRef=useRef(3);
  const replayDoneRef=useRef(0);
  useEffect(()=>{ autoReplayRef.current=autoReplay; },[autoReplay]);
  useEffect(()=>{ replayCountRef.current=replayCount; },[replayCount]);
  useEffect(()=>{ curIdxRef.current=curIdx; },[curIdx]);
  useEffect(()=>{ speedRef.current=speed; if(aRef.current) aRef.current.playbackRate=speed; },[speed]);

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
  const timingRef=useCallback((t:AyahTiming|undefined):AyahRef|null=>{
    if(!t)return null;
    return {surah:t.surah??baseSurah, ayah:t.ayah_in_surah??t.ayah};
  },[baseSurah]);
  const timingLabel=useCallback((t:AyahTiming)=>{
    const ref = timingRef(t);
    if(!ref)return "";
    const hasExplicitSurah = typeof t.surah === "number";
    return hasExplicitSurah ? formatAyahRef(ref,true) : toAr(ref.ayah);
  },[timingRef]);

  useEffect(()=>{
    const a=new Audio(url);aRef.current=a;a.volume=vol;a.playbackRate=speedRef.current;
    a.onloadedmetadata=()=>{ setDur(a.duration); onTimeChange?.(a.currentTime,a.duration||0); };
    a.onplay=()=>{ setPlaying(true);playingRef.current=true;onPlayChange?.(true); };
    a.onpause=()=>{ setPlaying(false);playingRef.current=false;onPlayChange?.(false); };
    a.ontimeupdate=()=>{
      const t=a.currentTime,d=a.duration||1;setCur(t);draw(t/d);
      onTimeChange?.(t,a.duration||0);
      onProgress?.(t,d);
      const idx=getActiveIdx(t);
      if(idx!==curIdxRef.current){
        curIdxRef.current=idx;
        setCurIdx(idx);
        onAyahChange(timingRef(timings[idx]));
      }
    };
    a.onended=()=>{
      if(autoReplayRef.current && replayDoneRef.current < replayCountRef.current-1){
        replayDoneRef.current++;
        setReplayDone(d=>d+1);
        a.currentTime=0;
        a.play();
      } else {
        replayDoneRef.current=0;
        setReplayDone(0);
        playingRef.current=false;setPlaying(false);onPlayChange?.(false);
        setCur(0);draw(0);onAyahChange(null);onTimeChange?.(0,a.duration||0);
      }
    };
    return()=>{a.pause();a.src="";};
  },[url,timings,timingRef]);

  const toggle=useCallback(()=>{
    const a=aRef.current;if(!a)return;
    if(playingRef.current)a.pause();else a.play();
  },[]);
  const skip=useCallback((s:number)=>{
    const a=aRef.current;if(a)a.currentTime=Math.max(0,Math.min(a.duration,a.currentTime+s));
  },[]);

  useEffect(()=>{
    onExposeControls?.({
      toggle,
      skip,
      seekPct:(p:number)=>{ const a=aRef.current;if(a&&a.duration)a.currentTime=p*a.duration; }
    });
  },[]);

  useEffect(()=>{
    onSeekToAyah((ref:AyahRef)=>{
      const a=aRef.current;if(!a)return;
      const t=timings.find(t=>sameAyah(timingRef(t),ref));
      if(t){a.currentTime=t.start_ms/1000;if(!playingRef.current)a.play();}
    });
  },[timings,timingRef]);
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
        <button className="sp-skip" onClick={()=>skip(-10)}><IcArrowR s={12} c="currentColor"/> ١٠ث</button>
        <button className="sp-play" onClick={toggle}>{playing?<IcPause s={18} c="#fff"/>:<IcPlay s={18} c="#fff"/>}</button>
        <button className="sp-skip" onClick={()=>skip(10)}>١٠ث <IcArrowL s={12} c="currentColor"/></button>
      </div>
      <div className="sp-vol">
        <IcVolume s={18} c="var(--textD)"/>
        <input type="range" min={0} max={1} step={0.05} value={vol} className="sp-vrange"
          onChange={e=>{setVol(+e.target.value);if(aRef.current)aRef.current.volume=+e.target.value;}}/>
        <span style={{fontSize:".68rem",color:"var(--textD)"}}>{Math.round(vol*100)}%</span>
      </div>
      <div className="sp-extras">
        <div className="sp-speed">
          <span className="sp-elbl">السرعة</span>
          {[0.5,0.75,1,1.25,1.5,2].map(s=>(
            <button key={s} className={`sp-ebtn${speed===s?" active":""}`} onClick={()=>onSpeedChange(s)}>{s}×</button>
          ))}
        </div>
        <div className="sp-replay">
          <label className="sp-toggle">
            <input type="checkbox" checked={autoReplay} onChange={e=>{onAutoReplayChange(e.target.checked);setReplayDone(0);replayDoneRef.current=0;}}/>
            <span className="sp-tog-track"><span className="sp-tog-thumb"/></span>
            <span className="sp-elbl">إعادة تلقائية</span>
          </label>
          {autoReplay&&<>
            <input type="number" min={1} max={99} value={replayCount} className="sp-rcount"
              onChange={e=>setReplayCount(Math.max(1,parseInt(e.target.value)||1))}/>
            <span className="sp-elbl">مرات</span>
            {(playing||replayDone>0)&&<span className="sp-rdone">{toAr(replayDone+1)}/{toAr(replayCount)}</span>}
          </>}
        </div>
      </div>
      {timings.length>1&&(
        <div className="sp-jumps">
          <div className="sp-jlbl">انتقل إلى آية</div>
          <div className="sp-jbtns">
            {timings.map((t,i)=>(
              <button key={`${t.surah??baseSurah}:${t.ayah_in_surah??t.ayah}:${i}`} className={`sp-jbtn${i===curIdx?" active":""}`}
                onClick={()=>{const a=aRef.current;if(!a)return;a.currentTime=t.start_ms/1000;if(!playingRef.current)a.play();}}>
                {timingLabel(t)}
              </button>
            ))}
          </div>
        </div>
      )}
      <a href={url} download={filename} className="sp-dl"><IcDownload s={14} c="currentColor"/> تحميل الملف الصوتي</a>
    </div>
  );
}

/* ════════ PROGRESS ════════ */
function ProgressPanel({ gen }:{ gen:ReturnType<typeof useAudioGenerator> }) {
  const {status,total,downloaded,percent,ayahs,error}=gen;
  const msgs:Record<string,string>={connecting:"جارٍ الاتصال...",resolving:"جارٍ التحليل...",downloading:`جارٍ التحميل ${percent}%`,merging:"دمج الملفات..."};
  const done=status==="done",err=status==="error";
  return (
    <div className="prog-panel">
      <div className="prog-head">
        <div className={`prog-status${done?" done":err?" err":""}`}>
          {!done&&!err&&<span className="pulse-dot"/>}
          {done?<><IcCheck s={14} c="var(--teal3)"/> اكتمل</>:err?<><IcClose s={12} c="#d06050"/> خطأ</>:(msgs[status]??status)}
        </div>
        {total>0&&!done&&<span className="prog-cnt">{downloaded}/{total}</span>}
      </div>
      {!err&&<div className="prog-bg"><div className={`prog-bar${done?" done":""}`} style={{width:`${done?100:status==="merging"?96:percent}%`}}/></div>}
      {err&&error&&(
        <div className="prog-err-detail">{error}</div>
      )}
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

/* ════════ HIFD MODE ════════ */
function HifdMode({ ayahs, surahName, surahNum }: {
  ayahs: AyahText[]; surahName: string; surahNum: number;
}) {
  const [idx, setIdx] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [result, setResult] = useState<WordResult[] | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const [scores, setScores] = useState<(number | null)[]>(() => new Array(ayahs.length).fill(null));
  const [isSupported, setIsSupported] = useState(true);
  const srRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  // errorOccurredRef prevents onend from processing empty transcript after an error
  const errorOccurredRef = useRef(false);
  const currentAyah = ayahs[idx];

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setIsSupported(false);
  }, []);

  useEffect(() => {
    setResult(null); setRecError(null); setShowText(false);
    finalTranscriptRef.current = "";
    errorOccurredRef.current = false;
  }, [idx]);

  const handleResult = useCallback((finalText: string) => {
    if (!finalText.trim() || !currentAyah) return;
    const res = compareAyah(currentAyah.text, finalText);
    setResult(res);
    const correct = res.filter(w => w.status === 'correct').length;
    const score = Math.round((correct / res.length) * 100);
    setScores(s => { const n = [...s]; n[idx] = score; return n; });
  }, [currentAyah, idx]);

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setResult(null);
    setRecError(null);
    finalTranscriptRef.current = "";
    errorOccurredRef.current = false;
    setInterimTranscript("");

    const sr = new SR();
    srRef.current = sr;
    // continuous=true: don't auto-stop after silence — the user controls stop.
    // This is critical for Quran recitation which can have natural pauses.
    sr.lang = 'ar-SA';
    sr.continuous = true;
    sr.interimResults = true;
    sr.maxAlternatives = 3;

    sr.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscriptRef.current += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      setInterimTranscript(interim);
    };

    sr.onend = () => {
      setIsRecording(false);
      setInterimTranscript("");
      // Only process if no error occurred (aborted by user stop is not an error)
      if (!errorOccurredRef.current) {
        handleResult(finalTranscriptRef.current.trim());
      }
    };

    sr.onerror = (e: any) => {
      // These are not real errors — ignore them and let onend run normally.
      // "aborted"  : we called sr.stop() ourselves.
      // "no-speech": silence detected, onend will fire, transcript may still exist.
      if (e.error === 'aborted' || e.error === 'no-speech') return;

      // "network" from Web Speech API does NOT mean the user's internet is down.
      // It means Google's speech-recognition server was temporarily unreachable
      // (service flap, rate limit, or geographic block). It is usually transient.
      // Treat it as a soft warning so the user can simply try again.
      if (e.error === 'network') {
        // Don't block the UI. onend will fire next and reset isRecording.
        // Show a dismissible hint instead of a hard error.
        setRecError('خدمة التعرف على الصوت غير متاحة لحظياً — اضغط مجدداً للإعادة.');
        return; // don't set errorOccurredRef so onend can still process any partial transcript
      }

      errorOccurredRef.current = true;
      setIsRecording(false);
      setInterimTranscript("");
      const errorMessages: Record<string, string> = {
        'not-allowed':            'لم يُسمح بالوصول إلى الميكروفون — أذن للمتصفح باستخدام الميكروفون ثم أعد المحاولة.',
        'audio-capture':          'تعذّر الوصول إلى الميكروفون — تحقق من أنه غير مستخدم من تطبيق آخر.',
        'service-not-allowed':    'خدمة التعرف على الصوت غير مسموح بها في هذا المتصفح.',
        'language-not-supported': 'اللغة العربية غير مدعومة في هذا المتصفح — استخدم Chrome أو Edge.',
      };
      setRecError(errorMessages[e.error] ?? `خطأ في التعرف على الصوت (${e.error})`);
    };

    try {
      sr.start();
      setIsRecording(true);
    } catch {
      setRecError('تعذّر بدء التسجيل — قد يكون الميكروفون مستخدماً من تطبيق آخر.');
    }
  }, [handleResult]);

  const stopRecording = useCallback(() => {
    srRef.current?.stop();
  }, []);
  const memorizedCount = scores.filter(s => s !== null && s >= 80).length;
  const correctCount = result?.filter(w => w.status === 'correct').length ?? 0;
  const totalCount = result?.length ?? 0;
  const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : null;

  if (!currentAyah) return null;

  if (!isSupported) return (
    <div className="hifd-wrap">
      <div className="hifd-unsupported">
        <div style={{opacity:.55}}><IcMicOff s={56} c="var(--gold)"/></div>
        <h3 style={{color:"var(--gold2)",fontSize:"1.1rem"}}>التعرف على الصوت غير مدعوم</h3>
        <p style={{color:"var(--textD)",fontSize:".84rem",maxWidth:320,lineHeight:1.7,textAlign:"center"}}>
          يرجى استخدام Google Chrome أو Microsoft Edge للاستفادة من ميزة الحفظ الصوتي.
        </p>
      </div>
    </div>
  );

  return (
    <div className="hifd-wrap">
      {/* Progress */}
      <div className="hifd-progress">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:".72rem",color:"var(--textD)"}}>التقدم في الحفظ</span>
          <span style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:".78rem",fontWeight:700,color:"var(--gold2)"}}>آية {toAr(idx+1)} / {toAr(ayahs.length)}</span>
            {memorizedCount > 0 && <span className="hifd-mem-badge"><IcCheck s={11} c="var(--teal3)"/> {toAr(memorizedCount)} محفوظة</span>}
          </span>
        </div>
        <div className="hifd-prog-bar">
          {ayahs.map((_, i) => {
            const s = scores[i];
            const cls = s === null ? '' : s >= 80 ? ' hifd-pb-good' : ' hifd-pb-bad';
            return <div key={i} className={`hifd-pb-seg${cls}${i===idx?' hifd-pb-cur':''}`}/>;
          })}
        </div>
      </div>

      {/* Ayah card */}
      <div className="hifd-ayah-card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:".78rem",color:"var(--textD)",fontWeight:600}}>
            {surahName} · آية {toAr(currentAyah.numberInSurah)}
          </span>
          <button className="hifd-show-btn" onClick={() => setShowText(!showText)}>
            {showText ? <><IcEyeOff s={14} c="currentColor"/> أخفِ</> : <><IcEye s={14} c="currentColor"/> أظهر</>} النص
          </button>
        </div>
        <div className={`hifd-ayah-text${showText ? ' revealed' : ' blurred'}`}>
          {currentAyah.text}
          <span className="qnum">{String.fromCodePoint(0x06DD)}{toAr(currentAyah.numberInSurah)}</span>
        </div>
        {!showText && !result && (
          <p style={{fontSize:".68rem",color:"var(--textDD)",textAlign:"center",marginTop:6}}>
            اضغط "أظهر النص" أو ابدأ التسجيل مباشرة
          </p>
        )}
      </div>

      {/* Recording panel */}
      {!result && (
        <div className="hifd-rec-panel">
          {recError && (
            <div className="hifd-rec-error">
              <span style={{fontSize:"1rem",flexShrink:0}}>⚠️</span>
              <span>{recError}</span>
              <button className="hifd-rec-error-x" onClick={()=>setRecError(null)}><IcClose s={11} c="currentColor"/></button>
            </div>
          )}
          {isRecording && interimTranscript && (
            <div className="hifd-interim">
              <span style={{fontSize:".68rem",color:"var(--teal3)",display:"block",marginBottom:4}}>جارٍ الاستماع...</span>
              <p style={{fontFamily:"var(--fq)",fontSize:"1.1rem",direction:"rtl",lineHeight:2,color:"var(--text)"}}>{interimTranscript}</p>
            </div>
          )}
          <button className={`hifd-mic-btn${isRecording?' recording':''}`}
            onClick={isRecording ? stopRecording : startRecording}>
            <span className="hifd-mic-icon">{isRecording ? <IcStop s={28} c="#fff"/> : <IcMic s={28} c="#fff"/>}</span>
            <span className="hifd-mic-label">{isRecording ? 'إيقاف' : 'ابدأ'}</span>
            {isRecording && <div className="hifd-mic-waves">{[...Array(5)].map((_,i)=><span key={i}/>)}</div>}
          </button>
          <p style={{fontSize:".72rem",color:"var(--textD)",textAlign:"center"}}>
            {isRecording ? 'اتلُ الآية بصوت واضح ثم اضغط إيقاف' : 'اضغط للبدء بالتسجيل الصوتي'}
          </p>
        </div>
      )}

      {/* Result panel */}
      {result && score !== null && (
        <div className="hifd-result">
          <div className={`hifd-score-badge${score>=80?' great':score>=50?' ok':' bad'}`}>
            <span className="hifd-score-pct">{toAr(score)}%</span>
            <span className="hifd-score-lbl">{score>=80?<><IcCheck s={14} c="var(--teal3)"/> ممتاز</>:score>=50?<><IcDiamond s={12} c="var(--gold2)"/> جيد</>:<><IcClose s={12} c="#d06060"/> راجع الآية</>}</span>
          </div>
          <div className="hifd-words">
            {result.map((w, i) => (
              <span key={i} className={`hifd-word hifd-word-${w.status}`}>{w.word}</span>
            ))}
          </div>
          {result.some(w => w.status !== 'correct') && (
            <div className="hifd-corrected">
              <div className="hifd-corr-label" style={{display:"flex",alignItems:"center",gap:6}}><IcQuran s={13} c="var(--gold)"/> النص الصحيح للمراجعة</div>
              <div className="hifd-corr-text">{currentAyah.text}</div>
            </div>
          )}
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="hifd-retry-btn" onClick={()=>{setResult(null);finalTranscriptRef.current="";}}>
              <IcReset s={13} c="currentColor"/> إعادة المحاولة
            </button>
            {idx < ayahs.length - 1 && (
              <button className="hifd-next-btn" onClick={()=>setIdx(idx+1)}>الآية التالية <IcArrowL s={13} c="#fff"/></button>
            )}
            {idx === ayahs.length - 1 && score >= 80 && (
              <div style={{textAlign:"center",color:"var(--teal3)",fontSize:".84rem",fontWeight:600,padding:"8px 16px",background:"rgba(42,157,143,.1)",border:"1px solid rgba(42,157,143,.3)",borderRadius:10}}>
                <IcCheck s={14} c="var(--teal3)"/> أتممت الحفظ بنجاح
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="hifd-nav">
        <button className="hifd-nav-btn" disabled={idx===0} onClick={()=>setIdx(idx-1)}><IcArrowR s={12} c="currentColor"/> السابقة</button>
        <div className="hifd-nav-dots">
          {ayahs.map((_, i) => {
            const s = scores[i];
            const dotCls = `hifd-nav-dot${i===idx?' cur':''}${s!==null?(s>=80?' good':' bad'):''}`;
            return <button key={i} className={dotCls} onClick={()=>setIdx(i)} title={`آية ${ayahs[i].numberInSurah}`}/>;
          })}
        </div>
        <button className="hifd-nav-btn" disabled={idx===ayahs.length-1} onClick={()=>setIdx(idx+1)}>التالية <IcArrowL s={12} c="currentColor"/></button>
      </div>
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
  const [ahzab,setAhzab]=useState<Hizb[]>([]);
  const [ayahTexts,setAyahTexts]=useState<AyahText[]>([]);
  const [loadingText,setLoadingText]=useState(false);
  const [step,setStep]=useState(1);
  const [maxStep,setMaxStep]=useState(1);
  const [dir,setDir]=useState<"fwd"|"bwd">("fwd");
  const [selR,setSelR]=useState<number|null>(null);
  const [selS,setSelS]=useState<any|null>(null);
  const [selHizb,setSelHizb]=useState<Hizb|null>(null);
  const [selMode,setSelMode]=useState<'surah'|'hizb'>('surah');
  const [whole,setWhole]=useState(true);
  const [aMin,setAMin]=useState(1);
  const [aMax,setAMax]=useState(7);
  const [search,setSearch]=useState("");
  const [activeAyah,setActiveAyah]=useState<AyahRef|null>(null);
  const [previewingId,setPreviewingId]=useState<number|null>(null);
  const [listenMode, setListenMode] = useState<'listen'|'hifd'>('listen');
  const [fpExpanded,setFpExpanded]=useState(false);
  const [fpPlaying,setFpPlaying]=useState(false);
  const [fpSpeed,setFpSpeed]=useState(1);
  const [fpAutoReplay,setFpAutoReplay]=useState(false);
  const [fpCur,setFpCur]=useState(0);
  const [fpDur,setFpDur]=useState(0);
  // Session & history state
  const [sessionMode,setSessionMode]=useState<SessionMode|null>(null);
  const [deviceId,setDeviceId]=useState('');
  const [readingHistory,setReadingHistory]=useState<HistoryEntry[]>([]);
  const [showHistory,setShowHistory]=useState(false);
  const [justFinished,setJustFinished]=useState(false);
  const [isFullscreen,setIsFullscreen]=useState(false);
  const [readingMode,setReadingMode]=useState(false);
  const seekRef=useRef<((ref:AyahRef)=>void)|null>(null);
  const quranFullRef=useRef<HTMLDivElement>(null);
  const mushafScrollRef = useRef<HTMLDivElement>(null);
  const fsProgressRef=useRef<HTMLDivElement>(null);
  const previewRef=useRef<HTMLAudioElement|null>(null);
  const fpProgressRef=useRef<HTMLDivElement|null>(null);
  const fpControlsRef=useRef<{toggle:()=>void;skip:(s:number)=>void;seekPct:(p:number)=>void}|null>(null);
  const previewTimerRef=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const gen=useAudioGenerator();

  // Apply theme to <html> so body background inherits CSS vars
  useEffect(()=>{
    document.documentElement.className = dark ? "dark" : "light";
  },[dark]);

  // Reading mode: header compresses when user scrolls down in Quran text
  useEffect(()=>{
    const el = mushafScrollRef.current;
    if (!el) return;
    let lastY = 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(()=>{
        const dy = el.scrollTop - lastY;
        if (dy > 30) setReadingMode(true);
        else if (dy < -20 || el.scrollTop < 20) setReadingMode(false);
        lastY = el.scrollTop;
        ticking = false;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  },[step]);

  useEffect(()=>{
    // Fixed device ID — single user, all browsers share the same history
    const did = "noureddine";
    setDeviceId(did);
    // sessionMode intentionally NOT restored from localStorage — each page load is a fresh جلسة
    fetch(`${API}/history?device_id=${encodeURIComponent(did)}`).then(r=>r.json()).then(setReadingHistory).catch(()=>{});
    fetch(`${API}/recitations`).then(r=>r.json()).then(setReciters).catch(()=>{});
    fetch(`${API}/surahs`).then(r=>r.json()).then(setSurahs).catch(()=>{});
    fetch(`${API}/ahzab`).then(r=>r.json()).then(setAhzab).catch(()=>{});
  },[]);

  // Stop preview when leaving step 1
  useEffect(()=>{ if(step!==1) stopPreview(); },[step]);

  useEffect(()=>{
    const onFsChange=()=>setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange',onFsChange);
    return ()=>document.removeEventListener('fullscreenchange',onFsChange);
  },[]);

  const toggleFullscreen=useCallback(()=>{
    if(!document.fullscreenElement){
      quranFullRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  },[]);

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
      if(!res.ok) throw new Error("failed");
      const data=await res.json();
      const all:AyahText[]=data.data.ayahs.map((a:AyahText)=>({
        ...a,
        surahNumber:surahNum,
        surahName:surahs.find(s=>s.id===surahNum)?.name_arabic ?? "",
      }));
      setAyahTexts(dedupeAyahs(all.filter(a=>a.numberInSurah>=min&&a.numberInSurah<=max)));
    } catch{setAyahTexts([]);}
    finally{setLoadingText(false);}
  },[surahs]);

  const fetchHizbText=useCallback(async(hizb:Hizb)=>{
    setLoadingText(true);
    try {
      const segments = [];
      for(let sn=hizb.start_surah; sn<=hizb.end_surah; sn++){
        const total = surahs.find(s=>s.id===sn)?.verses_count ?? 1;
        segments.push({
          surah:sn,
          min:sn===hizb.start_surah ? hizb.start_ayah : 1,
          max:sn===hizb.end_surah ? hizb.end_ayah : total,
          name:surahs.find(s=>s.id===sn)?.name_arabic ?? `سورة ${sn}`,
        });
      }
      const batches = await Promise.all(segments.map(async seg=>{
        const res=await fetch(`${QURAN_TEXT_API}/surah/${seg.surah}/quran-uthmani`);
        if(!res.ok) throw new Error("failed");
        const data=await res.json();
        return (data.data.ayahs as AyahText[])
          .filter(a=>a.numberInSurah>=seg.min&&a.numberInSurah<=seg.max)
          .map(a=>({...a,surahNumber:seg.surah,surahName:seg.name}));
      }));
      setAyahTexts(dedupeAyahs(batches.flat()));
    } catch{setAyahTexts([]);}
    finally{setLoadingText(false);}
  },[surahs]);

  const goTo=(s:number)=>{setDir(s<step?"bwd":"fwd");setStep(s);if(s>maxStep)setMaxStep(s);};
  const confirmRange=()=>{fetchText(selS!.id,whole?1:aMin,whole?(selS?.verses_count??1):aMax);goTo(4);};
  const confirmHizb=()=>{
    if(!selHizb)return;
    fetchHizbText(selHizb);
    goTo(4);
  };
  const handleGenerate=()=>{
    if(selMode==='hizb'&&selHizb){
      setActiveAyah({surah:selHizb.start_surah, ayah:selHizb.start_ayah});
      gen.generateHizb({
        recitation_id:selR!,
        hizb_num:selHizb.hizb_num,
        start_surah:selHizb.start_surah, start_ayah:selHizb.start_ayah,
        end_surah:selHizb.end_surah,     end_ayah:selHizb.end_ayah,
      }).catch(()=>{});
    } else {
      setActiveAyah({surah:selS!.id, ayah:whole?1:aMin});
      gen.generate({recitation_id:selR!,surah_number:selS!.id,whole_surah:whole,
        ayah_min:whole?undefined:aMin,ayah_max:whole?undefined:aMax}).catch(()=>{});
    }
  };
  const handleReset=()=>{
    gen.reset();setStep(1);setMaxStep(1);
    setSelR(null);setSelS(null);setSelHizb(null);
    setAyahTexts([]);setActiveAyah(null);setSearch("");
    setSelMode('surah');setJustFinished(false);
    setFpExpanded(false);setFpPlaying(false);setFpCur(0);setFpDur(0);
  };

  const handleModeSelect=(m:SessionMode)=>{
    setSessionMode(m);
  };

  const markFinished=useCallback(async()=>{
    if(!deviceId||!sessionMode||sessionMode==='free') return;
    const resolvedMin = selMode==='surah' ? (whole ? 1 : aMin) : null;
    const resolvedMax = selMode==='surah' ? (whole ? (selS?.verses_count ?? null) : aMax) : null;
    const entry:HistoryEntry = {
      device_id: deviceId,
      hizb_num: selHizb?.hizb_num ?? null,
      surah_num: selS?.id ?? null,
      ayah_min: resolvedMin,
      ayah_max: resolvedMax,
      session_mode: sessionMode,
    };
    setJustFinished(true);
    try {
      const res = await fetch(`${API}/history`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(entry),
      });
      if(res.ok){
        const saved = await res.json();
        setReadingHistory(h=>[saved, ...h]);
      }
    } catch { /* in-flight error — still show local success */ }
  },[deviceId, sessionMode, selHizb, selS, selMode, whole, aMin, aMax]);

  const completedHizbs = useMemo(()=>
    new Set(readingHistory.filter(h=>h.hizb_num).map(h=>h.hizb_num as number)),
    [readingHistory]
  );

  const suggestHizb = useMemo(()=>{
    if(!completedHizbs.size) return 1;
    const maxDone = Math.max(...Array.from(completedHizbs));
    return Math.min(maxDone + 1, 60);
  },[completedHizbs]);

  const filtered=useMemo(()=>
    surahs.filter(s=>s.name_arabic.includes(search)||
      s.name_simple.toLowerCase().includes(search.toLowerCase())||
      String(s.id).includes(search)),[surahs,search]);

  const dMin=whole?1:aMin, dMax=whole?(selS?.verses_count??1):aMax;
  const fmtPlayerTime=(s:number)=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;

  return (
    <div className={`app${dark?" dark":" light"}${readingMode?" reading-mode":""}`}>
      <Stars show={dark}/>
      <IslamicPattern opacity={dark?0.032:0.05}/>

      {/* HEADER */}
      <header className="hdr">
        <div className="hdr-inner">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="theme-btn" onClick={()=>setDark(!dark)} title="تبديل المظهر">
              {dark?<IcSun s={18} c="var(--gold)"/>:<IcCrescent s={18} c="var(--gold)"/>}
            </button>
            {sessionMode&&(
              <button className={`mode-chip mode-chip-${sessionMode}`} onClick={()=>handleModeSelect(sessionMode==='wird'?'hifd':sessionMode==='hifd'?'free':'wird')} title="تغيير الوضع">
                {sessionMode==='wird'?<IcWird s={13} c="currentColor"/>:sessionMode==='hifd'?<IcTarget s={13} c="currentColor"/>:<IcPlay s={13} c="currentColor"/>}
                {sessionMode==='wird'?'ورد':sessionMode==='hifd'?'حفظ':'حر'}
              </button>
            )}
          </div>
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
          <button className="hist-btn" onClick={()=>setShowHistory(true)} title="سجل القراءة">
            <IcHistory s={18} c="var(--gold)"/>
            {completedHizbs.size>0&&<span className="hist-btn-badge">{toAr(completedHizbs.size)}</span>}
          </button>
        </div>
      </header>

      {/* MODE SELECTION OVERLAY */}
      {sessionMode===null&&<ModeSelectionScreen onSelect={handleModeSelect}/>}

      {/* HISTORY PANEL */}
      <HistoryPanel show={showHistory} onClose={()=>setShowHistory(false)}
        history={readingHistory} ahzab={ahzab} surahs={surahs}/>

      {/* STEP BAR */}
      <div className="sb-wrap">
        <StepBar current={step} maxReached={maxStep}/>
      </div>

      {/* WIZARD */}
      <main className="wizard">

        {/* STEP 1 */}
        {step===1&&(
          <div className={`wcard slide-${dir}`}>
            <div className="wcard-hdr"><span className="wcard-icon"><IcMic s={30} c="var(--gold)"/></span>
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
              <button className="btn-next" disabled={!selR} onClick={()=>goTo(2)}>التالي <IcArrowL s={13} c="#fff"/> اختر السورة</button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step===2&&(
          <div className={`wcard slide-${dir}`}>
            <div className="wcard-hdr"><span className="wcard-icon">{selMode==='hizb'?<IcHizb s={30} c="var(--gold)"/>:<IcQuran s={30} c="var(--gold)"/>}</span>
              <div><div className="wcard-title">{selMode==='hizb'?'اختر الحزب':'اختر السورة'}</div>
                <div className="wcard-sub">القارئ: <strong>{RECITERS_META[selR!]?.nameAr}</strong></div></div>
            </div>

            {/* Mode toggle */}
            <div className="sel-mode-tabs">
              <button className={`sel-mode-btn${selMode==='surah'?' active':''}`} onClick={()=>setSelMode('surah')}>
                <IcQuran s={15} c="currentColor"/> بسورة
              </button>
              <button className={`sel-mode-btn${selMode==='hizb'?' active':''}`} onClick={()=>setSelMode('hizb')}>
                <IcHizb s={15} c="currentColor"/> بحزب
              </button>
            </div>

            <div className="wcard-body">
              {selMode==='surah'?(<>
                <div className="search-wrap">
                  <span className="si-icon"><IcSearch s={16} c="currentColor"/></span>
                  <input className="srch" placeholder="ابحث بالاسم أو الرقم..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  {search&&<button className="srch-x" onClick={()=>setSearch("")}><IcClose s={12} c="currentColor"/></button>}
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
              </>):(
                <HizbPicker ahzab={ahzab} surahs={surahs} selected={selHizb} onSelect={setSelHizb}
                  completedHizbs={completedHizbs}
                  suggestHizb={sessionMode&&sessionMode!=='free'?suggestHizb:undefined}/>
              )}
            </div>
            <div className="wcard-footer">
              <button className="btn-prev" onClick={()=>goTo(1)}><IcArrowR s={13} c="currentColor"/> السابق</button>
              {selMode==='surah'?(
                <button className="btn-next" disabled={!selS} onClick={()=>goTo(3)}>التالي <IcArrowL s={13} c="#fff"/> حدد الآيات</button>
              ):(
                <button className="btn-next" disabled={!selHizb} onClick={confirmHizb}>توليد الحزب <IcArrowL s={13} c="#fff"/></button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step===3&&(
          <div className={`wcard slide-${dir}`}>
            <div className="wcard-hdr"><span className="wcard-icon"><IcBeads s={30} c="var(--gold)"/></span>
              <div><div className="wcard-title">نطاق الآيات</div>
                <div className="wcard-sub">سورة <strong>{selS?.name_arabic}</strong> — {toAr(selS?.verses_count??0)} آية</div></div>
            </div>
            <div className="wcard-body">
              <AyahRangePicker total={selS?.verses_count??0} min={aMin} max={aMax} whole={whole}
                onMin={setAMin} onMax={setAMax} onWhole={setWhole}/>
            </div>
            <div className="wcard-footer">
              <button className="btn-prev" onClick={()=>goTo(2)}><IcArrowR s={13} c="currentColor"/> السابق</button>
              <button className="btn-next" onClick={confirmRange}>تأكيد <IcArrowL s={13} c="#fff"/> استمع الآن</button>
            </div>
          </div>
        )}

        {/* STEP 4 — Listen + Tafsir + Maqasid */}
        {step===4&&(
          <div className={`wcard wide slide-${dir}`}>
            <div className="wcard-hdr">
              <span className="wcard-icon"><IcEar s={30} c="var(--gold)"/></span>
              <div>
                <div className="wcard-title">الاستماع والتدبر</div>
                <div className="wcard-sub">
                  {selMode==='hizb'&&selHizb
                    ? <>حزب {toAr(selHizb.hizb_num)} · جزء {toAr(selHizb.juz_num)} · {RECITERS_META[selR!]?.nameAr}</>
                    : <>{selS?.name_arabic} · {RECITERS_META[selR!]?.nameAr} · آية {toAr(dMin)}–{toAr(dMax)}</>
                  }
                </div>
              </div>
              <div className="wcard-hdr-actions">
                <button className="btn-edit" onClick={()=>goTo(1)}><IcEdit s={13} c="var(--gold)"/> تعديل</button>
              </div>
            </div>

            {/* MODE TABS */}
            <div className="listen-tabs">
              <button className={`listen-tab${listenMode==='listen'?' active':''}`} onClick={()=>setListenMode('listen')}>
                <IcEar s={16} c="currentColor"/> الاستماع والتدبر
              </button>
              <button className={`listen-tab${listenMode==='hifd'?' active':''}`} onClick={()=>setListenMode('hifd')}>
                <IcQuran s={16} c="currentColor"/> الحفظ الصوتي
              </button>
            </div>

            {listenMode==='listen' && (
              /* ── Fullscreen target: only text + centered player ── */
              <div ref={quranFullRef} className="qs-text-wrap">
                <div className="listen-layout-full">
                  <div className="qtext-col qtext-full">
                    <div className="qtext-hdr">
                      <span>النص القرآني</span>
                      <button className="btn-fs-text" onClick={toggleFullscreen}
                        title={isFullscreen?'خروج من ملء الشاشة':'قراءة ملء الشاشة'}>
                        {isFullscreen
                          ? <IcExitFullscreen s={15} c="var(--textD)"/>
                          : <IcFullscreen s={15} c="var(--textD)"/>}
                      </button>
                      {activeAyah&&<span className="active-badge"><span className="active-dot"/>{formatAyahRef(activeAyah)}</span>}
                    </div>
                    {loadingText
                      ? <div className="qloading"><span className="mq-spin"/>جارٍ تحميل النص...</div>
                      : <QuranTextPanel
                          ayahs={ayahTexts} surahNum={selS?.id??selHizb?.start_surah??1} surahName={selS?.name_arabic??surahs.find(s=>s.id===selHizb?.start_surah)?.name_arabic??""}
                          activeAyah={activeAyah}
                          scrollRef={mushafScrollRef}
                          onAyahClick={(ref)=>{ setActiveAyah(ref); seekRef.current?.(ref); }}/>
                    }
                    {!loadingText&&ayahTexts.length>0&&(
                      <div className="qtext-hint">✦ انقر على أي آية للتدبر والتفسير والمقاصد</div>
                    )}
                  </div>
                </div>

                {/* Finish area — also visible in fullscreen */}
                {sessionMode && sessionMode!=='free' && (
                  <div className="wcard-finish-area">
                    {gen.status==='idle' && (
                      <div className="wcard-finish-hint">
                        <IcWird s={16} c="var(--textDD)"/>
                        <span>اضغط «توليد» في المشغّل ثم استمع — سيظهر هنا زر تسجيل الإنجاز</span>
                      </div>
                    )}
                    {(gen.status==='connecting'||gen.status==='resolving'||gen.status==='downloading'||gen.status==='merging') && (
                      <div className="wcard-finish-hint">
                        <span className="mq-spin"/>
                        <span>جارٍ تحضير الصوت...</span>
                      </div>
                    )}
                    {gen.status==='done' && (
                      <button
                        className={`wcard-finish-btn${justFinished?' wcard-finish-done':''}`}
                        onClick={!justFinished ? markFinished : undefined}
                        disabled={justFinished}>
                        {justFinished ? (
                          <>
                            <span className="wcard-finish-check"><IcCheck s={20} c="var(--teal3)"/></span>
                            <span className="wcard-finish-text">
                              <span className="wcard-finish-title">تم التسجيل ✓</span>
                              <span className="wcard-finish-sub">سُجِّل في سجل القراءة بنجاح</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="wcard-finish-icon"><IcStar s={22} c="var(--gold)"/></span>
                            <span className="wcard-finish-text">
                              <span className="wcard-finish-title">
                                {sessionMode==='wird' ? 'أنهيت الورد اليومي' : 'أنهيت جلسة الحفظ'}
                              </span>
                              <span className="wcard-finish-sub">اضغط لتسجيله في سجل قراءتك</span>
                            </span>
                            <IcArrowL s={16} c="var(--gold)"/>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* ── Centered fullscreen player (hidden in normal mode) ── */}
                <div className="qs-fs-bar">
                  <div className="qs-fs-bar-inner">
                    <div className="qs-fs-meta">
                      <span className="qs-fs-title">
                        {selMode==='hizb'&&selHizb ? `حزب ${toAr(selHizb.hizb_num)}` : (selS?.name_arabic??'—')}
                      </span>
                      {activeAyah&&<span className="qs-fs-ayah">{formatAyahRef(activeAyah,true)}</span>}
                    </div>
                    <div className="qs-fs-center">
                      <div className="qs-fs-btns">
                        <button className="qs-fs-skip" onClick={()=>fpControlsRef.current?.skip(-10)} title="رجوع ١٠ ثانية">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="15 18 9 12 15 6"/><line x1="9" y1="6" x2="9" y2="18"/>
                          </svg>
                        </button>
                        <button className="qs-fs-play" onClick={()=>fpControlsRef.current?.toggle()}>
                          {fpPlaying ? <IcPause s={22} c="#fff"/> : <IcPlay s={22} c="#fff"/>}
                        </button>
                        <button className="qs-fs-skip" onClick={()=>fpControlsRef.current?.skip(10)} title="تقديم ١٠ ثانية">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="15" y1="6" x2="15" y2="18"/><polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                      </div>
                      <div className="qs-fs-prog-wrap" onClick={e=>{
                        const r=e.currentTarget.getBoundingClientRect();
                        fpControlsRef.current?.seekPct((e.clientX-r.left)/r.width);
                      }}>
                        <div className="qs-fs-prog-fill" ref={fsProgressRef}/>
                      </div>
                    </div>
                    <div className="qs-fs-right">
                      <div className="qs-fs-time" dir="ltr">
                        {fmtPlayerTime(fpCur)}<span className="qs-fs-tsep">/</span>{fmtPlayerTime(fpDur)}
                      </div>
                      <button className="qs-fs-exit-btn" onClick={toggleFullscreen} title="خروج من ملء الشاشة">
                        <IcExitFullscreen s={16} c="currentColor"/>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {listenMode==='hifd' && (
              ayahTexts.length > 0
                ? <HifdMode ayahs={ayahTexts} surahName={selS?.name_arabic??""} surahNum={selS?.id??1}/>
                : <div style={{padding:40,textAlign:"center",color:"var(--textD)",fontSize:".88rem"}}>
                    <span className="mq-spin"/> جارٍ تحميل النص...
                  </div>
            )}

            {/* Finish area for hifd mode */}
            {listenMode==='hifd' && sessionMode && sessionMode!=='free' && (
              <div className="wcard-finish-area">
                {gen.status==='idle' && (
                  <div className="wcard-finish-hint">
                    <IcWird s={16} c="var(--textDD)"/>
                    <span>اضغط «توليد» في المشغّل ثم استمع — سيظهر هنا زر تسجيل الإنجاز</span>
                  </div>
                )}
                {(gen.status==='connecting'||gen.status==='resolving'||gen.status==='downloading'||gen.status==='merging') && (
                  <div className="wcard-finish-hint"><span className="mq-spin"/><span>جارٍ تحضير الصوت...</span></div>
                )}
                {gen.status==='done' && (
                  <button className={`wcard-finish-btn${justFinished?' wcard-finish-done':''}`}
                    onClick={!justFinished ? markFinished : undefined} disabled={justFinished}>
                    {justFinished ? (
                      <><span className="wcard-finish-check"><IcCheck s={20} c="var(--teal3)"/></span>
                        <span className="wcard-finish-text"><span className="wcard-finish-title">تم التسجيل ✓</span><span className="wcard-finish-sub">سُجِّل في سجل القراءة بنجاح</span></span></>
                    ) : (
                      <><span className="wcard-finish-icon"><IcStar s={22} c="var(--gold)"/></span>
                        <span className="wcard-finish-text"><span className="wcard-finish-title">{sessionMode==='wird'?'أنهيت الورد اليومي':'أنهيت جلسة الحفظ'}</span><span className="wcard-finish-sub">اضغط لتسجيله في سجل قراءتك</span></span>
                        <IcArrowL s={16} c="var(--gold)"/></>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {step===4&&listenMode==='listen'&&(
        <div className={`float-player${isFullscreen?' fp-fs-hidden':''}`}>
          <div className={`fp-glass${fpExpanded?' fp-expanded':''}`}>
            <div className="fp-details">
              {gen.status!=="idle"&&gen.status!=="done"&&(
                <div className="fp-details-inner">
                  <ProgressPanel gen={gen}/>
                  {gen.status==="error"&&<button className="btn-prev" onClick={gen.reset} style={{marginTop:10,width:"100%"}}><IcReset s={14} c="currentColor"/> إعادة</button>}
                </div>
              )}
              {gen.status==="done"&&gen.downloadUrl&&(
                <div className="fp-details-inner">
                  <SyncPlayer url={gen.downloadUrl} filename={gen.filename??"quran.mp3"} sizeKb={gen.sizeKb}
                    timings={gen.timings} onAyahChange={setActiveAyah}
                    onSeekToAyah={fn=>{seekRef.current=fn;}}
                    onPlayChange={setFpPlaying}
                    onProgress={(c,d)=>{ const w=`${d>0?(c/d)*100:0}%`; if(fpProgressRef.current) fpProgressRef.current.style.width=w; if(fsProgressRef.current) fsProgressRef.current.style.width=w; }}
                    onExposeControls={c=>{fpControlsRef.current=c;}}
                    baseSurah={selS?.id??selHizb?.start_surah??1}
                    speed={fpSpeed}
                    autoReplay={fpAutoReplay}
                    onSpeedChange={setFpSpeed}
                    onAutoReplayChange={setFpAutoReplay}
                    onTimeChange={(c,d)=>{setFpCur(c);setFpDur(d);}}/>
                  <button className="fp-new-session" onClick={handleReset}><IcReset s={13} c="currentColor"/> جلسة جديدة</button>
                </div>
              )}
            </div>

            <div className="fp-strip">
              <div className="fp-prog-track" onClick={e=>{
                const r=e.currentTarget.getBoundingClientRect();
                fpControlsRef.current?.seekPct((e.clientX-r.left)/r.width);
              }}>
                <div className="fp-prog-fill" ref={fpProgressRef}/>
              </div>
              <div className="fp-row">
                <div className="fp-main">
                  <div className="fp-controls">
                    {gen.status==='idle'&&(
                      <button className="fp-cta" onClick={handleGenerate}>
                        <IcPlay s={15} c="#0c1020"/> توليد
                      </button>
                    )}
                    {gen.status==='done'&&(
                      <button className="fp-play-btn" onClick={()=>fpControlsRef.current?.toggle()} title={fpPlaying?'إيقاف':'تشغيل'}>
                        {fpPlaying?<IcPause s={19} c="#fff"/>:<IcPlay s={19} c="#fff"/>}
                      </button>
                    )}
                    {gen.status!=='idle'&&gen.status!=='done'&&(
                      <div className="fp-loading-dot"><span className="mq-spin"/></div>
                    )}
                  </div>
                </div>
                <div className="fp-info" onClick={()=>{ if(gen.status==='done') setFpExpanded(v=>!v); }}>
                  <div className="fp-orn"><IcCrescent s={15} c="var(--gold)"/></div>
                  <div className="fp-text">
                    <span className="fp-title">
                      {selMode==='hizb'&&selHizb
                        ? `حزب ${toAr(selHizb.hizb_num)}`
                        : (selS?.name_arabic??'—')}
                    </span>
                    {activeAyah&&<span className="fp-ayah">{formatAyahRef(activeAyah,true)}</span>}
                    {gen.status==='idle'&&<span className="fp-status-lbl">جاهز للتوليد</span>}
                    {gen.status!=='idle'&&gen.status!=='done'&&<span className="fp-status-lbl">جارٍ التحميل...</span>}
                  </div>
                </div>
                <div className="fp-time" dir="ltr">
                  <span>{fmtPlayerTime(fpCur)}</span><span>/</span><span>{fmtPlayerTime(fpDur)}</span>
                </div>
                <div className="fp-speed-mini" aria-label="سرعة التشغيل">
                  {[0.5,0.75,1,1.25,1.5,2].map(s=>(
                    <button key={s} className={`fp-speed-btn${fpSpeed===s?' active':''}`} onClick={()=>setFpSpeed(s)}>{s}x</button>
                  ))}
                </div>
                <button className={`fp-toggle-mini${fpAutoReplay?' active':''}`} onClick={()=>setFpAutoReplay(v=>!v)} title="إعادة تلقائية">
                  <span className="fp-toggle-mark"/>
                  <span>تكرار</span>
                </button>
                <div className="fp-right">
                  {gen.status==='done'&&(
                    <button className="fp-chevron" onClick={()=>setFpExpanded(v=>!v)}
                      title={fpExpanded?'إخفاء التفاصيل':'عرض التفاصيل'}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {fpExpanded
                          ?<polyline points="18 15 12 9 6 15"/>
                          :<polyline points="6 9 12 15 18 9"/>}
                      </svg>
                    </button>
                  )}
                  {gen.status==='idle'&&(
                    <button className="fp-chevron fp-back-btn" onClick={()=>goTo(selMode==='hizb'?2:3)}>
                      <IcArrowR s={14} c="currentColor"/>
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
          )}

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
@import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Amiri+Quran&family=Amiri:wght@400;700&family=Scheherazade+New:wght@400;700&display=swap');
@font-face{font-family:'UthmanicHafs';src:url('https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2') format('woff2');font-display:swap}
/* extra vars not in globals */
:root{--fq:'UthmanicHafs','Amiri Quran','Scheherazade New','Traditional Arabic',serif;--r:16px;--r8:8px;--r24:24px;--trans:.28s;--content-max:1280px;--reader-max:860px}
/* Arabic rendering baseline */
*{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-tap-highlight-color:transparent}
.star{position:absolute;background:var(--gold3);border-radius:50%;opacity:0;animation:tw var(--dur,3s) var(--delay,0s) infinite ease-in-out}
@keyframes tw{0%,100%{opacity:0;transform:scale(.3)}50%{opacity:.55;transform:scale(1)}}
svg.pattern-bg,svg[style*="fixed"]{color:var(--pat-color)}
/* ── Root app shell — must never exceed viewport width ── */
.app{
  position:relative;z-index:1;
  width:100%;max-width:100dvw;
  min-height:100dvh;
  display:flex;flex-direction:column;
  overflow-x:hidden;
  box-sizing:border-box;
}

/* HEADER */
.hdr{
  width:100%;box-sizing:border-box;
  background:var(--hdr-bg);
  backdrop-filter:blur(16px) saturate(1.4);-webkit-backdrop-filter:blur(16px) saturate(1.4);
  border-bottom:1px solid var(--border);z-index:10;position:relative;
  transition:padding var(--trans),opacity var(--trans);
}
.hdr-inner{
  max-width:var(--content-max);
  margin-inline:auto;
  display:flex;align-items:center;justify-content:space-between;
  padding-block:18px 14px;padding-inline:28px;
  gap:16px;box-sizing:border-box;
}
/* reading-mode: header compresses */
.reading-mode .hdr-inner{padding-block:8px;padding-inline:20px}
.reading-mode .hdr-title{font-size:1.1rem}
.reading-mode .hdr-sub{display:none}
.reading-mode .hdr-center{gap:0}
.hdr-center{text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;gap:3px}
.hdr-orn{color:var(--gold)}
.hdr-title{font-family:var(--ff);font-size:clamp(1.9rem,4vw,3rem);font-weight:700;color:var(--gold2);text-shadow:0 0 50px rgba(201,168,76,.28),0 2px 0 rgba(0,0,0,.3);line-height:1.1;letter-spacing:.025em}
.light .hdr-title{text-shadow:0 1px 2px rgba(255,255,255,.6);color:var(--gold2)}
.hdr-sub{font-size:.82rem;color:var(--textD);line-height:1.55;letter-spacing:.015em}
.theme-btn{background:var(--bg3);border:1px solid var(--border);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;cursor:pointer;flex-shrink:0;transition:all .25s}
.theme-btn:hover{border-color:var(--gold);transform:rotate(20deg) scale(1.1)}

/* STEP BAR — segmented pill */
/* Stepper strip — full width, centers track inside */
.sb-wrap{
  position:sticky;top:0;z-index:20;
  width:100%;box-sizing:border-box;overflow-x:hidden;
  background:var(--hdr-bg);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border-bottom:1px solid var(--border);
  display:flex;justify-content:center;
  padding-block:8px;padding-inline:12px;
  transition:padding var(--trans);
}
.reading-mode .sb-wrap{padding-block:4px;padding-inline:8px}
.reading-mode .sb-seg{padding:4px 10px;font-size:.7rem}
.reading-mode .sb-icon{display:none}
.stepbar{display:flex;justify-content:center}
.sb-track{display:inline-flex;align-items:center;background:var(--bg3);border:1px solid var(--border);border-radius:40px;padding:4px;gap:0;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.sb-seg{display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:32px;font-size:.8rem;color:var(--textD);transition:all .28s;user-select:none;white-space:nowrap;letter-spacing:.01em;min-height:44px;cursor:pointer}
.sb-seg.active{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#fff;font-weight:700;box-shadow:0 3px 12px rgba(201,168,76,.3)}
.dark .sb-seg.active{color:#0d1826}
.sb-seg.done{color:var(--teal2);font-weight:500}
.sb-seg.locked{opacity:.4}
.sb-icon{font-size:.85rem;line-height:1;display:flex;align-items:center}
.sb-sep{color:var(--border2);font-size:.8rem;margin:0 -4px;flex-shrink:0;transition:color .3s;opacity:.6}
.sb-sep.lit{color:var(--gold);opacity:1}

/* WIZARD */
/* wizard — full-width column, cards self-center via margin-inline: auto */
.wizard{
  flex:1;
  width:100%;box-sizing:border-box;overflow-x:hidden;
  padding-block:24px var(--player-clearance);
  padding-inline:12px;
}
@keyframes sFwd{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:translateX(0)}}
@keyframes sBwd{from{opacity:0;transform:translateX(-48px)}to{opacity:1;transform:translateX(0)}}
.slide-fwd{animation:sFwd .32s cubic-bezier(.22,.68,0,1.2) both}
.slide-bwd{animation:sBwd .32s cubic-bezier(.22,.68,0,1.2) both}

/* CARD */
.wcard{
  width:100%;max-width:740px;
  margin-inline:auto;box-sizing:border-box;
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:var(--r24);overflow:hidden;
  box-shadow:var(--shadow-card);transition:background var(--trans);
}
.light .wcard{box-shadow:var(--shadow-card)}
/* wide card: still constrained by wizard padding — no 100vw arithmetic */
.wcard.wide{max-width:1100px}
.wcard-hdr{display:flex;align-items:center;gap:14px;padding:20px 26px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(201,168,76,.06),transparent 60%);position:relative}
.wcard-hdr::before{content:'';position:absolute;top:0;right:0;left:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.35}
.wcard-icon{font-size:1.9rem;flex-shrink:0}
.wcard-title{font-size:1.1rem;font-weight:700;color:var(--gold2);margin-bottom:4px;letter-spacing:.025em}
.light .wcard-title{color:var(--gold2)}
.wcard-sub{font-size:.8rem;color:var(--textD);line-height:1.65}.wcard-sub strong{color:var(--teal3)}
.wcard-body{padding-block:20px;padding-inline:24px;max-height:calc(100dvh - 300px);overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box}
.wcard-footer{display:flex;justify-content:space-between;align-items:center;padding:14px 26px;border-top:1px solid var(--border);background:rgba(0,0,0,.04)}
.light .wcard-footer{background:rgba(90,69,32,.03)}
.btn-edit{background:none;border:1px solid var(--border);border-radius:20px;color:var(--gold);font-family:var(--ff);font-size:.72rem;padding:5px 14px;cursor:pointer;transition:all .2s}
.btn-edit:hover{background:rgba(201,168,76,.1);border-color:var(--gold)}
.wcard-hdr-actions{display:flex;align-items:center;gap:8px;margin-inline-start:auto}
/* Fullscreen text wrapper — normal mode is transparent */
.qs-text-wrap{width:100%}
/* Fullscreen player bar — hidden in normal mode */
.qs-fs-bar{display:none}
/* ── Fullscreen mode ── */
.qs-text-wrap:fullscreen,.qs-text-wrap:-webkit-full-screen{background:var(--bg);overflow-y:auto;padding:0 0 140px}
.qs-text-wrap:fullscreen .listen-layout-full,.qs-text-wrap:-webkit-full-screen .listen-layout-full{padding-bottom:0}
.qs-text-wrap:fullscreen .qtext-col,.qs-text-wrap:-webkit-full-screen .qtext-col{max-width:820px;margin:0 auto;padding:32px 40px 24px;border:none}
/* Fullscreen centered player bar */
.qs-text-wrap:fullscreen .qs-fs-bar,.qs-text-wrap:-webkit-full-screen .qs-fs-bar{display:flex;position:fixed;bottom:0;left:0;right:0;justify-content:center;padding:14px 20px 20px;background:linear-gradient(to top,rgba(12,16,32,.98) 60%,transparent);z-index:9999}
.qs-fs-bar-inner{width:min(680px,92vw);background:rgba(30,36,60,.92);border:1px solid rgba(201,168,76,.25);border-radius:18px;padding:12px 18px;display:flex;align-items:center;gap:14px;backdrop-filter:blur(20px);box-shadow:0 8px 40px rgba(0,0,0,.5)}
.qs-fs-meta{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.qs-fs-title{font-family:var(--fq);font-size:.95rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qs-fs-ayah{font-size:.65rem;color:var(--gold);font-family:var(--ff)}
.qs-fs-center{display:flex;flex-direction:column;gap:8px;align-items:center;flex:2}
.qs-fs-btns{display:flex;align-items:center;gap:10px}
.qs-fs-skip{background:none;border:none;cursor:pointer;color:var(--textD);padding:4px;border-radius:8px;display:flex;align-items:center;transition:color .2s}
.qs-fs-skip:hover{color:var(--gold)}
.qs-fs-play{width:44px;height:44px;border-radius:50%;background:var(--gold);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .2s,box-shadow .2s;box-shadow:0 0 18px rgba(201,168,76,.35)}
.qs-fs-play:hover{transform:scale(1.08);box-shadow:0 0 28px rgba(201,168,76,.5)}
.qs-fs-prog-wrap{width:100%;height:4px;background:rgba(255,255,255,.12);border-radius:2px;cursor:pointer;overflow:hidden}
.qs-fs-prog-fill{height:100%;background:var(--gold);border-radius:2px;width:0;transition:width .1s linear}
.qs-fs-right{display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0}
.qs-fs-time{font-size:.7rem;color:var(--textD);font-variant-numeric:tabular-nums;display:flex;gap:3px}
.qs-fs-tsep{opacity:.4}
.qs-fs-exit-btn{background:none;border:1px solid var(--border);border-radius:8px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--textD);transition:all .2s}
.qs-fs-exit-btn:hover{border-color:var(--gold);color:var(--gold)}
/* fullscreen text entry button in qtext-hdr */
.btn-fs-text{background:none;border:1px solid var(--border);border-radius:7px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--textD);transition:all .2s;flex-shrink:0}
.btn-fs-text:hover{border-color:var(--gold);color:var(--gold)}
/* hide main float player in fullscreen */
.fp-fs-hidden{display:none!important}

/* BUTTONS */
.btn-next{background:linear-gradient(135deg,var(--teal),var(--teal2));border:none;border-radius:11px;color:#fff;font-family:var(--ff);font-size:.92rem;font-weight:600;padding:12px 24px;cursor:pointer;transition:background .25s,transform .25s,box-shadow .25s;box-shadow:0 4px 14px rgba(42,157,143,.25);letter-spacing:.02em;min-height:44px}
.btn-next:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(42,157,143,.4)}
.btn-next:disabled{opacity:.28;cursor:not-allowed}
.btn-prev{background:var(--bg3);border:1px solid var(--border);border-radius:11px;color:var(--textD);font-family:var(--ff);font-size:.86rem;padding:11px 20px;cursor:pointer;transition:background .22s,transform .22s,box-shadow .22s;letter-spacing:.01em;min-height:44px}
.btn-prev:hover{border-color:rgba(201,168,76,.3);color:var(--text)}
.btn-gen{width:100%;padding:15px;background:linear-gradient(135deg,var(--goldD),var(--gold));border:none;border-radius:12px;color:#0c1020;font-family:var(--ff);font-size:1rem;font-weight:700;cursor:pointer;transition:all .25s;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 20px rgba(201,168,76,.25)}
.btn-gen:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(201,168,76,.35)}
.btn-reset{width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--textD);font-family:var(--ff);font-size:.82rem;cursor:pointer;margin-top:10px;transition:all .2s}
.btn-reset:hover{border-color:var(--gold);color:var(--gold)}

/* RECITER GRID — mobile:2col, tablet:3col, desktop:4col, xl:5col */
.rg{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media(min-width:480px){.rg{grid-template-columns:repeat(3,1fr)}}
@media(min-width:768px){.rg{grid-template-columns:repeat(4,1fr);gap:12px}}
@media(min-width:1200px){.rg{grid-template-columns:repeat(5,1fr)}}
.rc{background:var(--bg3);border:1.5px solid var(--border);border-radius:14px;padding:14px 10px 11px;cursor:pointer;text-align:center;transition:border-color .22s,transform .22s,box-shadow .22s;position:relative;overflow:hidden;min-height:44px}
.rc:hover{border-color:rgba(201,168,76,.3);transform:translateY(-2px);box-shadow:var(--shadow-md)}
@media(hover:none){.rc:hover{transform:none;box-shadow:none}}
.rc.sel{box-shadow:0 0 0 2px rgba(201,168,76,.25),0 8px 24px rgba(0,0,0,.2)}
.rc-avatar-wrap{width:66px;height:66px;border-radius:50%;margin:0 auto 10px;position:relative;border:2px solid transparent;transition:border-color .25s;overflow:hidden}
.rc-check{position:absolute;bottom:1px;right:1px;width:19px;height:19px;border-radius:50%;background:var(--teal2);color:#fff;font-size:.6rem;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg-card)}
.rc-name{font-size:.73rem;font-weight:600;color:var(--text);line-height:1.4;margin-bottom:4px;letter-spacing:.01em}
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
.si-icon{position:absolute;inset-inline-start:12px;font-size:.85rem;pointer-events:none;opacity:.5}
.srch{width:100%;background:var(--input-bg);border:1px solid var(--border);border-radius:11px;padding:11px 38px 11px 36px;color:var(--text);font-family:var(--ff);font-size:.92rem;outline:none;direction:rtl;transition:border-color .2s;letter-spacing:.01em;line-height:1.5}
.srch:focus{border-color:var(--border2);box-shadow:0 0 0 3px rgba(201,168,76,.07)}.srch::placeholder{color:var(--textDD)}
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
.si-ar{font-size:1rem;font-weight:600;color:var(--gold2);letter-spacing:.015em}
.si-en{font-size:.67rem;color:var(--textD);margin-top:2px;line-height:1.4}
.si-bdg{font-size:.58rem;padding:2px 7px;border-radius:20px;flex-shrink:0;font-weight:600}
.si-bdg.mk{background:rgba(201,168,76,.1);color:var(--gold);border:1px solid rgba(201,168,76,.2)}
.si-bdg.md{background:rgba(42,157,143,.1);color:var(--teal3);border:1px solid rgba(42,157,143,.2)}

/* AYAH RANGE PICKER */
.arp{display:flex;flex-direction:column;gap:16px}
.arp-toggle-row{display:flex;gap:8px;background:var(--bg4);border-radius:10px;padding:4px;border:1px solid var(--border)}
.arp-tog{flex:1;padding:10px;border:none;border-radius:8px;font-family:var(--ff);font-size:.88rem;color:var(--textD);background:transparent;cursor:pointer;transition:all .22s;letter-spacing:.01em}
.arp-tog.active{background:linear-gradient(135deg,var(--teal),var(--teal2));color:#fff;box-shadow:0 3px 10px rgba(42,157,143,.3)}
.arp-selects{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:end}
.arp-dash{color:var(--textD);font-size:1rem;text-align:center;padding-bottom:10px}
.arp-field label{display:block;font-size:.7rem;color:var(--textD);margin-bottom:5px}
.arp-sw{position:relative}
.arp-sel{width:100%;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;padding:11px 14px 11px 30px;color:var(--text);font-family:var(--ff);font-size:.92rem;appearance:none;-webkit-appearance:none;outline:none;cursor:pointer;transition:border-color .2s;direction:rtl;letter-spacing:.01em}
.arp-sel:focus{border-color:var(--border2);box-shadow:0 0 0 3px rgba(201,168,76,.07)}
.arp-arr{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--textD);font-size:.75rem;pointer-events:none}
.arp-bar-wrap{display:flex;flex-direction:column;gap:5px}
.arp-bar{height:34px;background:var(--bg4);border-radius:8px;border:1px solid var(--border);position:relative;overflow:hidden}
.arp-fill{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,rgba(201,168,76,.18),rgba(201,168,76,.38));border-radius:6px;transition:all .4s cubic-bezier(.22,.68,0,1.2);border-right:2px solid rgba(201,168,76,.55)}
.arp-tick{position:absolute;top:22%;bottom:22%;width:1px;background:var(--border);transform:translateX(-50%);transition:background .3s}
.arp-tick.in{background:rgba(201,168,76,.55)}
.arp-blabels{display:flex;justify-content:space-between;font-size:.63rem;color:var(--textD);padding:0 2px}
.arp-binfo{color:var(--gold);font-weight:600}
.arp-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.arp-sc{background:var(--bg4);border:1px solid var(--border);border-radius:10px;padding:13px;text-align:center;display:flex;flex-direction:column;gap:5px}
.arp-sc span{font-size:.68rem;color:var(--textD);letter-spacing:.01em}.arp-sc strong{font-size:1.15rem;color:var(--gold2);font-weight:700;letter-spacing:.02em}
.light .arp-sc strong{color:#7a5018}

/* LISTEN LAYOUT */
.listen-layout-full{display:block;padding-bottom:var(--player-clearance)}
.listen-layout-full .qtext-col{border-inline-start:none;max-width:var(--reader-max);margin-inline:auto}
/* keep old class for hifd fallback */
.listen-layout{display:grid;grid-template-columns:1fr 1fr;min-height:520px}

/* ══════════════ FLOATING GLASS PLAYER ══════════════ */
.float-player{
  position:fixed;
  bottom:calc(12px + var(--sab));
  /* center: left:50% + translateX(-50%) — immune to RTL direction */
  left:50%;
  /* use dvw so Safari iOS never overshoots viewport */
  width:min(calc(100dvw - 24px), 900px);
  transform:translateX(-50%);
  z-index:9999;
  pointer-events:auto;
  will-change:transform;
  transition:opacity .24s ease,bottom .28s ease;
}
/* reading mode: player shrinks to minimal strip */
.reading-mode .float-player{bottom:calc(6px + var(--sab))}

/* VisionOS layered glass pill */
.fp-glass{
  background:
    radial-gradient(ellipse 110% 80% at 10% -8%,rgba(42,157,143,.12),transparent 52%),
    rgba(4,9,20,.88);
  backdrop-filter:blur(28px) saturate(160%);
  -webkit-backdrop-filter:blur(28px) saturate(160%);
  border-radius:24px;
  border:1px solid rgba(255,255,255,.09);
  border-top-color:rgba(255,255,255,.2);
  overflow:hidden;
  /* simplified shadow for 60fps scroll */
  box-shadow:var(--shadow-player),inset 0 1px 0 rgba(255,255,255,.13);
  /* use max-height not height to avoid layout shifts */
  transition:border-radius .3s ease,max-height .4s cubic-bezier(.4,0,.2,1);
  max-height:80px;
  /* promote to its own layer */
  will-change:max-height;
}
.fp-glass.fp-expanded{border-radius:22px;max-height:72dvh}

.light .fp-glass{
  background:
    radial-gradient(ellipse 90% 70% at 15% -8%,rgba(42,157,143,.07),transparent),
    rgba(253,250,246,.93);
  border-color:rgba(0,0,0,.07);border-top-color:rgba(255,255,255,.96);
  box-shadow:0 28px 60px rgba(0,0,0,.2),0 8px 22px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.92);
}

/* EXPANDED PANEL */
.fp-details{max-height:0;overflow:hidden;transition:max-height .44s cubic-bezier(.4,0,.2,1)}
.fp-glass.fp-expanded .fp-details{max-height:calc(70vh - 88px);overflow-y:auto;overscroll-behavior:contain}
.fp-details-inner{padding:14px 18px 8px;border-bottom:1px solid var(--border)}

/* MINI STRIP — progress bar embedded as inset bottom line */
.fp-strip{position:relative}
.fp-prog-track{
  position:absolute;bottom:0;left:18px;right:18px;
  height:2px;background:rgba(255,255,255,.08);
  border-radius:2px 2px 0 0;cursor:pointer;overflow:hidden;
  transition:height .22s ease,left .22s ease,right .22s ease;
}
/* extended hit area so a 2px bar is still easy to click */
.fp-prog-track::after{content:'';position:absolute;top:-10px;left:0;right:0;bottom:-2px}
.fp-prog-track:hover{height:5px;left:10px;right:10px}
.light .fp-prog-track{background:rgba(0,0,0,.1)}
.fp-prog-fill{position:absolute;top:0;left:0;bottom:0;width:0%;background:linear-gradient(90deg,var(--teal2),var(--gold));transition:width .1s linear}

/* main row — collapsed height: 56–64px mobile */
.fp-row{display:flex;align-items:center;padding:10px 16px 14px;gap:10px;min-height:56px;height:var(--player-h)}
.fp-main{display:flex;align-items:center;flex-shrink:0}

/* info: mini art square + text */
.fp-info{display:flex;align-items:center;gap:11px;flex:1;cursor:pointer;min-width:0}
.fp-orn{
  width:36px;height:36px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(140deg,rgba(42,157,143,.38),rgba(201,168,76,.22));
  border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;
  transition:transform .22s cubic-bezier(.34,1.3,.64,1);
}
.fp-info:hover .fp-orn{transform:scale(1.1) rotate(-4deg)}
.fp-text{display:flex;flex-direction:column;min-width:0}
.fp-title{font-size:.87rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.015em}
.fp-ayah{font-size:.69rem;color:var(--gold2);margin-top:2px;font-weight:500;letter-spacing:.01em}
.fp-status-lbl{font-size:.67rem;color:var(--textDD);margin-top:2px;letter-spacing:.01em}
.fp-time{display:flex;align-items:center;gap:4px;color:var(--textD);font-size:.68rem;font-variant-numeric:tabular-nums;white-space:nowrap;flex-shrink:0}
.fp-speed-mini{display:flex;align-items:center;gap:4px;max-width:238px;overflow-x:auto;scrollbar-width:none;flex-shrink:0;padding:2px}
.fp-speed-mini::-webkit-scrollbar{display:none}
.fp-speed-btn{border:1px solid var(--border);background:rgba(255,255,255,.055);color:var(--textD);border-radius:999px;padding:5px 8px;font-family:var(--ff);font-size:.66rem;line-height:1;cursor:pointer;white-space:nowrap;transition:all .18s}
.fp-speed-btn:hover{color:var(--text);border-color:rgba(201,168,76,.28)}
.fp-speed-btn.active{background:linear-gradient(135deg,var(--goldD),var(--gold));border-color:transparent;color:#0c1020;font-weight:800}
.fp-toggle-mini{display:flex;align-items:center;gap:6px;border:1px solid var(--border);background:rgba(255,255,255,.055);color:var(--textD);border-radius:999px;padding:5px 9px;font-family:var(--ff);font-size:.68rem;cursor:pointer;white-space:nowrap;transition:all .18s;flex-shrink:0}
.fp-toggle-mini:hover{color:var(--text);border-color:rgba(201,168,76,.28)}
.fp-toggle-mini.active{background:rgba(42,157,143,.16);border-color:rgba(42,157,143,.42);color:var(--teal3)}
.fp-toggle-mark{width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.55;box-shadow:0 0 0 3px rgba(255,255,255,.04)}
.fp-toggle-mini.active .fp-toggle-mark{opacity:1;box-shadow:0 0 12px rgba(42,157,143,.62)}
.fp-loading-dot{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border:1px solid var(--border)}
.light .fp-speed-btn,.light .fp-toggle-mini{background:rgba(0,0,0,.045)}
.light .fp-loading-dot{background:rgba(0,0,0,.045)}

/* controls */
.fp-controls{display:flex;align-items:center;gap:6px;flex-shrink:0}
.fp-play-btn{
  width:42px;height:42px;border-radius:50%;
  background:linear-gradient(150deg,var(--teal2),var(--teal));
  border:none;cursor:pointer;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  box-shadow:0 4px 20px rgba(42,157,143,.46),inset 0 1px 0 rgba(255,255,255,.22);
  transition:transform .22s cubic-bezier(.34,1.5,.64,1),box-shadow .22s ease;
}
.fp-play-btn:hover{transform:scale(1.13);box-shadow:0 8px 30px rgba(42,157,143,.60),inset 0 1px 0 rgba(255,255,255,.3)}
.fp-play-btn:active{transform:scale(.92);transition-duration:.08s}
.fp-btn{background:none;border:none;cursor:pointer;color:var(--textD);padding:7px;border-radius:10px;display:flex;align-items:center;transition:color .15s,background .15s}
.fp-btn:hover{color:var(--text);background:rgba(255,255,255,.08)}
.light .fp-btn:hover{background:rgba(0,0,0,.06)}

/* right controls */
.fp-right{display:flex;align-items:center;flex-shrink:0}
.fp-chevron{background:none;border:none;cursor:pointer;color:var(--textD);padding:7px;border-radius:10px;display:flex;align-items:center;transition:color .2s ease,background .15s,transform .26s cubic-bezier(.34,1.2,.64,1)}
.fp-chevron:hover{color:var(--gold2);background:rgba(255,255,255,.08)}
.light .fp-chevron:hover{background:rgba(0,0,0,.06)}
.fp-glass.fp-expanded .fp-chevron{color:var(--gold);transform:scale(1.12)}

/* generate CTA */
.fp-cta{background:linear-gradient(135deg,var(--goldD),var(--gold));border:none;border-radius:22px;padding:9px 22px;color:#0c1020;font-family:var(--ff);font-size:.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;box-shadow:0 4px 18px rgba(201,168,76,.32),inset 0 1px 0 rgba(255,255,255,.25);transition:transform .2s ease,box-shadow .2s ease,filter .18s}
.fp-cta:hover{filter:brightness(1.1);box-shadow:0 8px 28px rgba(201,168,76,.48);transform:translateY(-1px)}
.fp-cta:active{transform:translateY(0);transition-duration:.08s}
.fp-back-btn{color:var(--textD)}.fp-back-btn:hover{color:var(--text)}
.fp-new-session{width:100%;padding:9px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--textD);font-family:var(--ff);font-size:.78rem;cursor:pointer;margin-top:10px;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px}
.fp-new-session:hover{border-color:var(--border2);color:var(--gold2)}

/* SyncPlayer children inside expanded panel */
.fp-details .splayer{gap:10px}
.fp-details .sp-ctrl{display:none}
.fp-details .sp-meta{font-size:.6rem;color:var(--textDD)}
.fp-details .sp-wf{background:var(--bg2);border-color:var(--border)}
.fp-details .sp-extras{display:none}
.fp-details .sp-jumps{background:var(--bg2);border-color:var(--border)}
.fp-details .sp-skip{background:var(--bg4);border-color:var(--border)}
.fp-details .sp-ebtn{background:var(--bg4);border-color:var(--border)}
.fp-details .sp-jbtn{background:var(--bg4);border-color:var(--border)}
.fp-details .sp-rcount{background:var(--bg4);border-color:var(--border);color:var(--text)}
.fp-details .sp-dl{background:rgba(201,168,76,.07);border-color:var(--border2)}
.fp-details .prog-panel{background:var(--bg2);border-color:var(--border)}
.fp-details .sp-vrange{background:var(--bg5)}
.fp-details .sp-wf{height:76px}
.fp-details .sp-dl,.fp-details .fp-new-session{flex-shrink:0}

/* QURAN TEXT */
.qtext-col{padding-block:20px;padding-inline:24px;border-inline-start:1px solid var(--border);display:flex;flex-direction:column;gap:10px;box-sizing:border-box}
.qtext-hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--border)}
.qtext-hdr>span:first-child{font-size:.82rem;color:var(--textD);font-weight:700;letter-spacing:.02em}
.active-badge{display:flex;align-items:center;gap:5px;font-size:.7rem;color:var(--teal3);background:rgba(42,157,143,.1);border:1px solid rgba(42,157,143,.22);padding:4px 11px;border-radius:20px;animation:fadeIn .3s ease;letter-spacing:.01em}
.active-dot{width:6px;height:6px;border-radius:50%;background:var(--teal3);animation:pulse 1.5s infinite}
@keyframes fadeIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}
.qloading{display:flex;align-items:center;gap:10px;font-size:.82rem;color:var(--textD);padding:30px 0}
.qtext-hint{font-size:.63rem;color:var(--textDD);text-align:center;padding:6px;border-top:1px solid var(--border)}
.qtext-outer{flex:1;display:flex;flex-direction:column;gap:0;overflow:visible}

/* ── MUSHAF PAGE — uses platform palette ── */
.mushaf-page{position:relative;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;padding:15px;box-shadow:0 8px 48px rgba(0,0,0,.38),inset 0 0 40px rgba(201,168,76,.04)}
/* light: keep authentic parchment feel */
.light .mushaf-page{background:linear-gradient(160deg,#fdf8ee 0%,#f5eedd 55%,#fdf8ee 100%);border-color:rgba(130,96,30,.38);box-shadow:0 6px 32px rgba(0,0,0,.15),inset 0 0 30px rgba(201,168,76,.05)}
/* corner ornaments */
.mc{position:absolute;width:16px;height:16px;border-color:var(--border2);border-style:solid}
.mc-tl{top:7px;right:7px;border-width:1.5px 1.5px 0 0}
.mc-tr{top:7px;left:7px;border-width:1.5px 0 0 1.5px}
.mc-bl{bottom:7px;right:7px;border-width:0 1.5px 1.5px 0}
.mc-br{bottom:7px;left:7px;border-width:0 0 1.5px 1.5px}
.mushaf-inner{border:1px solid var(--border);border-radius:7px;padding:16px 20px 14px;background:var(--bg4)}
.light .mushaf-inner{background:rgba(255,255,255,.45)}
/* surah header */
.mushaf-hdr{text-align:center;padding-bottom:13px;margin-bottom:12px;border-bottom:1px solid var(--border);position:relative}
.mushaf-hdr::after{content:'';position:absolute;bottom:-1px;left:50%;transform:translateX(-50%);width:55%;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.45}
.mushaf-hdr-title{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px}
.mushaf-bracket{font-family:var(--fq);font-size:1.3rem;color:var(--gold);line-height:1;opacity:.75}
.mushaf-sname{font-family:var(--fq);font-size:1.3rem;color:var(--gold2);font-weight:600;letter-spacing:.025em}
.mushaf-hdr-sub{font-size:.65rem;color:var(--textD);direction:rtl;letter-spacing:.04em}
/* basmala */
.mushaf-basmala{font-family:var(--fq);font-size:1.55rem;text-align:center;direction:rtl;color:var(--text);padding:12px 0 16px;display:block;border-bottom:1px solid var(--border);margin-bottom:12px;letter-spacing:.02em}
.light .mushaf-basmala{color:#1e1608}
/* quran text */
.mushaf-text-wrap{overflow-y:auto;max-height:min(560px,calc(100dvh - 300px));padding-left:2px;padding-bottom:var(--player-clearance);overscroll-behavior:contain}
.mushaf-text{font-family:var(--fq);font-size:1.7rem;line-height:3.15;text-align:justify;text-align-last:right;direction:rtl;color:var(--text);word-break:break-word;word-spacing:.06em;padding:4px 0}
.light .mushaf-text{color:#1a1208}
/* ayah verse inline spans */
.qayah{cursor:pointer;border-radius:7px;transition:background .2s,box-shadow .2s;padding:3px 4px;display:inline}
.qayah:hover{background:rgba(201,168,76,.1)}
.qayah.playing{background:rgba(201,168,76,.22);box-shadow:0 0 0 2px rgba(201,168,76,.38);border-radius:9px;color:var(--gold2);animation:aLight .35s ease}
.qayah.selected{background:rgba(42,157,143,.16);box-shadow:0 0 0 2px rgba(42,157,143,.32);border-radius:9px}
.qayah.playing.selected{background:rgba(201,168,76,.28)}
.light .qayah.playing{background:rgba(201,168,76,.28);color:#7a5018}
@keyframes aLight{from{background:rgba(201,168,76,.55)}to{background:rgba(201,168,76,.22)}}
/* ayah end marker */
.mushaf-anum{display:inline-block;font-family:var(--ff);font-size:.72rem;color:rgba(201,168,76,.9);vertical-align:middle;margin:0 3px;direction:ltr}
.qnum{font-family:var(--ff);font-size:.74rem;color:var(--gold);vertical-align:middle;margin-right:2px;opacity:.75}

/* AYAH DRAWER */
.ayah-drawer{background:var(--bg3);border-top:1px solid var(--border);border-radius:0 0 var(--r8) var(--r8);overflow:hidden;animation:drawerIn .25s ease}
@keyframes drawerIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
.ayah-drawer-header{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:linear-gradient(90deg,rgba(201,168,76,.08),transparent);border-bottom:1px solid var(--border)}
.ayah-drawer-num{font-size:.84rem;font-weight:700;color:var(--gold2);letter-spacing:.02em}
.ayah-drawer-close{background:none;border:none;color:var(--textD);cursor:pointer;font-size:.75rem;padding:3px 7px;border-radius:5px;transition:all .15s}
.ayah-drawer-close:hover{background:rgba(201,168,76,.1);color:var(--text)}
.ayah-actions{padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap}
.copy-ayah-btn{background:linear-gradient(135deg,rgba(42,157,143,.18),rgba(42,157,143,.08));border:1px solid rgba(42,157,143,.32);border-radius:8px;padding:7px 14px;color:var(--teal3);font-family:var(--ff);font-size:.78rem;font-weight:700;cursor:pointer;transition:all .2s}
.copy-ayah-btn:hover{background:rgba(42,157,143,.16);transform:translateY(-1px)}
.copy-ayah-btn.copied{background:rgba(201,168,76,.14);border-color:rgba(201,168,76,.34);color:var(--gold2)}

/* TAFSIR TRIGGER / PANEL */
.tf-trigger{background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:7px 14px;color:var(--textD);font-family:var(--ff);font-size:.78rem;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .2s}
.tf-trigger:hover{border-color:rgba(201,168,76,.3);color:var(--text)}
.tf-panel{background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;width:100%;margin-top:4px}
.tf-header{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:rgba(201,168,76,.06);border-bottom:1px solid var(--border);font-size:.75rem;color:var(--gold2);font-weight:600}
.light .tf-header{color:var(--gold2)}
.tf-close{background:none;border:none;color:var(--textD);cursor:pointer;font-size:.72rem;padding:2px 6px;border-radius:4px;transition:all .15s}
.tf-close:hover{color:var(--text);background:rgba(201,168,76,.1)}
.tf-loading{display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--textD);padding:14px}
.tf-text{padding:14px 16px;font-size:.92rem;line-height:2.1;color:var(--text);direction:rtl;letter-spacing:.01em}
.light .tf-text{color:#1a1208}
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
.mq-sub{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px 0}
.mq-subpill{font-size:.62rem;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(42,157,143,.12);color:var(--teal3);border:1px solid rgba(42,157,143,.2);white-space:nowrap}
.mq-subtxt{font-size:.67rem;color:var(--textD);direction:ltr;unicode-bidi:isolate}
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
.mq-live{margin:0 14px 12px;padding:12px;border-radius:10px;background:linear-gradient(180deg,rgba(42,157,143,.09),rgba(42,157,143,.04));border:1px solid rgba(42,157,143,.18);display:flex;flex-direction:column;gap:8px}
.mq-live-hdr{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.mq-live-note{font-size:.66rem;color:var(--textD)}
.mq-live-txt{font-size:.84rem;line-height:1.9;color:var(--text);direction:rtl;white-space:pre-wrap;letter-spacing:.01em}
.light .mq-live-txt{color:#1a1208}
.mq-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.mq-row{display:flex;flex-direction:column;gap:4px}
.mq-topic{flex-direction:row;align-items:center;gap:8px}
.mq-topicval{font-size:.92rem;color:var(--gold2);font-weight:600;letter-spacing:.01em}
.mq-badge{font-size:.62rem;font-weight:700;padding:2px 9px;border-radius:20px;background:rgba(201,168,76,.1);color:var(--gold);border:1px solid rgba(201,168,76,.2);flex-shrink:0;white-space:nowrap}
.mq-b2{background:rgba(42,157,143,.1);color:var(--teal3);border-color:rgba(42,157,143,.2)}
.mq-b3{background:rgba(107,80,180,.12);color:#a07adf;border-color:rgba(107,80,180,.2)}
.mq-b4{background:rgba(201,115,76,.1);color:#d4944c;border-color:rgba(201,115,76,.2)}
.mq-txt{font-size:.88rem;line-height:1.9;color:var(--text);direction:rtl;letter-spacing:.01em}.light .mq-txt{color:#1a1208}
.mq-src{font-size:.6rem;color:var(--textDD);text-align:center;margin-top:2px;border-top:1px solid var(--border);padding-top:6px}

/* PLAYER */
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
.sp-extras{display:flex;flex-direction:column;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px}
.sp-speed{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.sp-replay{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sp-elbl{font-size:.66rem;color:var(--textD);white-space:nowrap;flex-shrink:0}
.sp-ebtn{background:var(--bg4);border:1px solid var(--border);border-radius:7px;padding:3px 10px;font-size:.72rem;font-family:var(--ff);color:var(--textD);cursor:pointer;transition:all .15s;direction:ltr}
.sp-ebtn:hover{border-color:rgba(201,168,76,.3);color:var(--text)}
.sp-ebtn.active{background:rgba(201,168,76,.17);border-color:var(--gold);color:var(--gold);font-weight:700;box-shadow:0 0 8px rgba(201,168,76,.15)}
.sp-toggle{display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none}
.sp-toggle input{display:none}
.sp-tog-track{width:30px;height:16px;background:var(--bg5);border-radius:8px;position:relative;transition:background .2s;border:1px solid var(--border);flex-shrink:0}
.sp-toggle input:checked~.sp-tog-track{background:rgba(42,157,143,.35);border-color:var(--teal)}
.sp-tog-thumb{position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;background:var(--textD);transition:all .2s}
.sp-toggle input:checked~.sp-tog-track .sp-tog-thumb{left:16px;background:var(--teal3)}
.sp-rcount{width:42px;background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:2px 6px;font-size:.8rem;font-family:var(--ff);color:var(--text);text-align:center;outline:none;-moz-appearance:textfield}
.sp-rcount::-webkit-inner-spin-button,.sp-rcount::-webkit-outer-spin-button{-webkit-appearance:none}
.sp-rdone{font-size:.66rem;color:var(--gold);background:rgba(201,168,76,.12);padding:2px 9px;border-radius:12px;font-weight:700;direction:ltr}

/* PROGRESS */
.prog-panel{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:16px}
.prog-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.prog-status{display:flex;align-items:center;gap:8px;font-size:.86rem;color:var(--gold2);letter-spacing:.01em}
.prog-status.done{color:var(--teal3)}.prog-status.err{color:#d06050}
.pulse-dot{width:8px;height:8px;border-radius:50%;background:var(--gold);animation:pulse 1.3s infinite;flex-shrink:0}
.prog-cnt{font-size:.7rem;color:var(--textD)}
.prog-bg{background:var(--bg5);border-radius:4px;height:7px;overflow:hidden;margin-bottom:10px}
.prog-bar{height:100%;border-radius:4px;transition:width .5s ease;background:linear-gradient(90deg,var(--gold),var(--gold2))}
.prog-bar.done{background:linear-gradient(90deg,var(--teal),var(--teal2))}
.prog-err-detail{font-size:.78rem;color:#d06050;background:rgba(192,57,43,.07);border:1px solid rgba(192,57,43,.18);border-radius:8px;padding:9px 12px;margin-bottom:8px;direction:rtl;line-height:1.6}
.prog-dots{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px}
.prog-dot{width:9px;height:9px;border-radius:50%}.prog-dot.ok{background:var(--teal2)}.prog-dot.fallback{background:var(--gold)}.prog-dot.failed{background:#c0392b}
.prog-leg{display:flex;gap:12px;font-size:.63rem;color:var(--textD)}.prog-leg span{display:flex;align-items:center;gap:3px}
.ld{display:inline-block;width:6px;height:6px;border-radius:50%}.ld.ok{background:var(--teal2)}.ld.fallback{background:var(--gold)}.ld.failed{background:#c0392b}

/* FOOTER */
.footer{border-top:1px solid var(--border);padding:30px 24px 160px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:9px;background:linear-gradient(0deg,rgba(201,168,76,.04),transparent)}
.footer-orn{color:var(--gold);opacity:.45;letter-spacing:9px;font-size:.82rem}
.footer-copy{font-size:.8rem;color:var(--textD);letter-spacing:.01em}.footer-copy strong{color:var(--gold2)}
.footer-sub{font-size:.68rem;color:var(--textDD);letter-spacing:.01em}.fl{color:var(--teal3)}
.footer-bismillah{font-family:var(--fq);font-size:1.18rem;color:var(--gold);opacity:.52;margin-top:5px;letter-spacing:.02em}

/* ══════════════════════════════════════════════════════════════
   RESPONSIVE — mobile-first breakpoints
   mobile  < 480px
   phone   480–767px
   tablet  768–1023px
   desktop 1024–1439px
   xl      1440px+
══════════════════════════════════════════════════════════════ */

/* ── Mobile < 480px ──────────────────────────────────────── */
@media(max-width:479px){
  /* Header */
  .hdr-inner{padding-block:10px 8px;padding-inline:14px}
  .hdr-title{font-size:1.45rem}
  .hdr-sub{display:none}
  .hdr-center{gap:1px}

  /* Stepper */
  .sb-wrap{padding-block:5px;padding-inline:8px}
  .sb-track{gap:1px}
  .sb-seg{padding:5px 9px;font-size:.7rem;gap:3px;min-height:38px}
  .sb-sep{margin-inline:-2px}

  /* Wizard + cards */
  .wizard{padding-block:12px var(--player-clearance);padding-inline:8px}
  .wcard{border-radius:16px}
  .wcard-hdr{padding:14px 16px}
  .wcard-body{padding:14px;max-height:calc(100dvh - 240px)}
  .wcard-footer{padding:10px 14px}

  /* Float player */
  .fp-row{padding-block:8px 12px;padding-inline:12px;gap:6px;min-height:52px;height:60px}
  .fp-orn{display:none}
  .fp-title{font-size:.78rem;max-width:90px}
  .fp-ayah,.fp-status-lbl{font-size:.6rem}
  .fp-play-btn{width:36px;height:36px}
  .fp-loading-dot{width:36px;height:36px}
  .fp-time{display:none}
  .fp-speed-mini{max-width:80px;gap:2px}
  .fp-speed-btn{font-size:.58rem;padding:4px 6px}
  .fp-toggle-mini{font-size:0;width:30px;height:30px;padding:0;justify-content:center;border-radius:50%;min-width:30px;min-height:30px}
  .fp-toggle-mark{width:8px;height:8px}
  .fp-chevron{padding:5px}
  .fp-cta{font-size:.7rem;padding:7px 12px}
  .fp-details-inner{padding:10px 12px 6px}
  .fp-details .sp-wf{height:56px}

  /* Quran reader */
  .mushaf-page{padding:8px}
  .mushaf-inner{padding:10px 11px 8px}
  .mushaf-text{font-size:1.45rem;line-height:2.85}
  .mushaf-text-wrap{max-height:calc(100dvh - 280px)}
  .listen-layout{grid-template-columns:1fr}
  .qtext-col{border-inline-start:none;border-bottom:1px solid var(--border)}

  /* HIFD */
  .hifd-wrap{padding:12px}
  .hifd-ayah-text{font-size:1.35rem;line-height:2.75}
  .hifd-words{font-size:1.1rem;line-height:2.3;padding:12px 14px}
  .hifd-corr-text{font-size:1.1rem;line-height:2.5;padding:12px}

  /* Misc */
  .arp-selects{grid-template-columns:1fr 1fr;gap:6px}
  .arp-dash{display:none}
  .arp-summary{grid-template-columns:1fr 1fr}
  .ayah-actions{flex-direction:column}
  .btn-next{font-size:.84rem;padding:10px 16px;min-height:44px}
  .btn-prev{font-size:.8rem;padding:9px 14px;min-height:44px}
  .mode-cards{grid-template-columns:1fr;gap:10px}
}

/* ── Phone 480–767px ─────────────────────────────────────── */
@media(min-width:480px) and (max-width:767px){
  .hdr-inner{padding-block:12px 10px;padding-inline:18px}
  .hdr-title{font-size:1.7rem}
  .hdr-sub{font-size:.75rem}
  .sb-wrap{padding-block:6px;padding-inline:12px}
  .sb-seg{padding:6px 11px;font-size:.73rem}
  .wizard{padding-block:16px var(--player-clearance);padding-inline:10px}
  .wcard{border-radius:18px}
  .wcard-body{padding:16px 18px;max-height:calc(100dvh - 260px)}
  .fp-row{padding-block:9px 13px;padding-inline:14px;gap:7px;min-height:54px;height:64px}
  .fp-orn{width:28px;height:28px;border-radius:7px}
  .fp-title{font-size:.79rem}
  .fp-play-btn{width:38px;height:38px}
  .fp-time{font-size:.6rem}
  .fp-speed-mini{max-width:100px}
  .mushaf-text{font-size:1.5rem;line-height:2.9}
  .mushaf-text-wrap{max-height:calc(100dvh - 290px)}
  .listen-layout{grid-template-columns:1fr}
  .qtext-col{border-inline-start:none;border-bottom:1px solid var(--border)}
  .hifd-ayah-text{font-size:1.45rem}
  .hifd-words{font-size:1.2rem}
  .arp-selects{grid-template-columns:1fr 1fr;gap:8px}
  .arp-dash{display:none}
  .btn-next{min-height:44px}
  .btn-prev{min-height:44px}
}

/* ── Tablet 768–1023px ───────────────────────────────────── */
@media(min-width:768px) and (max-width:1023px){
  .hdr-inner{padding-block:14px 12px;padding-inline:24px}
  .hdr-title{font-size:2rem}
  .sb-wrap{padding-block:8px;padding-inline:16px}
  .wizard{padding-block:20px var(--player-clearance);padding-inline:16px}
  .wcard{border-radius:20px}
  .wcard.wide{border-radius:20px}
  .wcard-body{max-height:calc(100dvh - 280px)}
  .fp-row{padding-block:10px 14px;padding-inline:16px;gap:8px}
  .listen-layout{grid-template-columns:1fr}
  .qtext-col{border-inline-start:none}
  .mushaf-text{font-size:1.6rem;line-height:3.05}
  .mushaf-text-wrap{max-height:calc(100dvh - 300px)}
  .hifd-ayah-text{font-size:1.65rem}
}

/* ── Desktop 1024px+ ─────────────────────────────────────── */
@media(min-width:1024px){
  .hdr-inner{padding-block:18px 14px;padding-inline:32px}
  .wizard{padding-block:28px var(--player-clearance);padding-inline:24px}
  .wcard-body{max-height:calc(100dvh - 310px)}
  .listen-layout-full .qtext-col{max-width:var(--reader-max)}
  .mushaf-text{font-size:1.72rem}
  .float-player{bottom:calc(24px + var(--sab))}
  .fp-row{padding-block:12px 16px;padding-inline:20px;height:72px}
  .btn-next:hover:not(:disabled){transform:translateY(-2px)}
  .rc:hover{transform:translateY(-2px)}
}

/* ── XL 1440px+ ──────────────────────────────────────────── */
@media(min-width:1440px){
  .hdr-inner{padding-block:20px 16px;padding-inline:40px}
  .wizard{padding-block:32px var(--player-clearance);padding-inline:32px}
  .wcard.wide{max-width:1160px}
  .listen-layout-full .qtext-col{max-width:900px}
  .mushaf-text{font-size:1.78rem}
}

/* LISTEN MODE TABS */
.listen-tabs{display:flex;background:var(--bg3);border-bottom:1px solid var(--border)}
.listen-tab{flex:1;padding:14px;border:none;background:transparent;color:var(--textD);font-family:var(--ff);font-size:.88rem;cursor:pointer;transition:all .22s;border-bottom:2.5px solid transparent;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.015em}
.listen-tab.active{color:var(--gold2);border-bottom-color:var(--gold);background:rgba(201,168,76,.06);font-weight:700}
.listen-tab:hover:not(.active){color:var(--text);background:rgba(255,255,255,.025)}

/* HIFD MODE */
.hifd-wrap{display:flex;flex-direction:column;gap:16px;padding:22px 24px;max-width:800px;margin:0 auto;width:100%}
.hifd-unsupported{text-align:center;padding:40px 20px;display:flex;flex-direction:column;align-items:center;gap:12px}
.hifd-progress{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.hifd-prog-bar{display:flex;gap:3px;height:8px}
.hifd-pb-seg{flex:1;border-radius:4px;background:var(--bg5);transition:all .3s}
.hifd-pb-good{background:var(--teal2)}
.hifd-pb-bad{background:rgba(192,57,43,.5)}
.hifd-pb-cur{outline:2px solid rgba(201,168,76,.6);outline-offset:1px}
.hifd-mem-badge{font-size:.66rem;color:var(--teal3);background:rgba(42,157,143,.1);border:1px solid rgba(42,157,143,.25);padding:2px 10px;border-radius:20px}
.hifd-ayah-card{background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:20px 22px}
.hifd-show-btn{background:var(--bg4);border:1px solid var(--border);border-radius:20px;color:var(--textD);font-family:var(--ff);font-size:.72rem;padding:5px 13px;cursor:pointer;transition:all .2s}
.hifd-show-btn:hover{border-color:rgba(201,168,76,.35);color:var(--text)}
.hifd-ayah-text{font-family:var(--fq);font-size:1.8rem;line-height:3.1;text-align:right;direction:rtl;transition:filter .4s,opacity .4s;word-break:break-word;word-spacing:.06em}
.hifd-ayah-text.blurred{filter:blur(10px);opacity:.35;user-select:none;pointer-events:none}
.hifd-ayah-text.revealed{filter:none;opacity:1}
.hifd-rec-panel{display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 0}
.hifd-rec-error{display:flex;align-items:flex-start;gap:10px;width:100%;padding:12px 14px;background:rgba(176,32,32,.1);border:1px solid rgba(176,32,32,.3);border-radius:10px;font-size:.82rem;color:#d06060;direction:rtl;line-height:1.6}
.hifd-rec-error-x{background:none;border:none;color:#d06060;cursor:pointer;font-size:.8rem;padding:0 4px;margin-inline-start:auto;flex-shrink:0;opacity:.7;transition:opacity .15s}
.hifd-rec-error-x:hover{opacity:1}
.hifd-interim{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 16px;width:100%;max-width:520px;min-height:60px}
.hifd-mic-btn{position:relative;width:96px;height:96px;border-radius:50%;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;background:linear-gradient(135deg,var(--teal),var(--teal2));box-shadow:0 6px 24px rgba(42,157,143,.4);transition:all .28s;overflow:visible}
.hifd-mic-btn.recording{background:linear-gradient(135deg,#b02020,#d63030);box-shadow:0 6px 24px rgba(176,32,32,.5);animation:hifd-pulse 1.5s ease-in-out infinite}
@keyframes hifd-pulse{0%,100%{box-shadow:0 6px 24px rgba(176,32,32,.5),0 0 0 0 rgba(176,32,32,.25)}50%{box-shadow:0 6px 24px rgba(176,32,32,.4),0 0 0 20px rgba(176,32,32,0)}}
.hifd-mic-btn:hover:not(.recording){transform:scale(1.07);box-shadow:0 10px 32px rgba(42,157,143,.55)}
.hifd-mic-icon{font-size:2.1rem;line-height:1;display:block}
.hifd-mic-label{font-size:.55rem;color:rgba(255,255,255,.85);text-align:center;font-family:var(--ff)}
.hifd-mic-waves{position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);display:flex;align-items:flex-end;gap:3px}
.hifd-mic-waves span{display:block;width:4px;border-radius:3px;background:rgba(214,48,48,.7);animation:hifd-mwave .65s ease-in-out infinite alternate}
.hifd-mic-waves span:nth-child(1){height:6px;animation-delay:.0s}
.hifd-mic-waves span:nth-child(2){height:12px;animation-delay:.12s}
.hifd-mic-waves span:nth-child(3){height:18px;animation-delay:.24s}
.hifd-mic-waves span:nth-child(4){height:12px;animation-delay:.12s}
.hifd-mic-waves span:nth-child(5){height:6px;animation-delay:.0s}
@keyframes hifd-mwave{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
.hifd-result{background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:18px 20px;display:flex;flex-direction:column;gap:14px;animation:fadeUp .25s ease}
.hifd-score-badge{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;border:1px solid}
.hifd-score-badge.great{background:rgba(42,157,143,.1);border-color:rgba(42,157,143,.3);color:var(--teal3)}
.hifd-score-badge.ok{background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.3);color:var(--gold2)}
.hifd-score-badge.bad{background:rgba(176,32,32,.1);border-color:rgba(176,32,32,.3);color:#d06060}
.hifd-score-pct{font-size:2.4rem;font-weight:700;font-family:var(--ff);line-height:1;letter-spacing:.02em}
.hifd-score-lbl{font-size:.9rem;font-weight:600;letter-spacing:.015em}
.hifd-words{display:flex;flex-wrap:wrap;gap:8px;direction:rtl;font-family:var(--fq);font-size:1.45rem;line-height:2.6;padding:16px 18px;background:var(--bg2);border-radius:10px;border:1px solid var(--border);word-spacing:.06em}
.hifd-word{padding:3px 5px;border-radius:6px;transition:background .2s}
.hifd-word-correct{background:rgba(42,157,143,.2);color:var(--teal3)}
.hifd-word-wrong{background:rgba(176,32,32,.2);color:#d06060;text-decoration:line-through}
.hifd-word-missing{background:rgba(201,168,76,.08);color:var(--textDD);opacity:.55}
.hifd-corrected{background:var(--bg2);border:1px solid rgba(201,168,76,.2);border-radius:10px;overflow:hidden}
.hifd-corr-label{font-size:.7rem;color:var(--gold);padding:8px 14px;background:rgba(201,168,76,.07);border-bottom:1px solid rgba(201,168,76,.15)}
.hifd-corr-text{font-family:var(--fq);font-size:1.45rem;line-height:2.8;direction:rtl;text-align:right;padding:16px;color:var(--text);word-spacing:.06em}
.hifd-retry-btn{background:var(--bg4);border:1px solid var(--border);border-radius:10px;color:var(--textD);font-family:var(--ff);font-size:.84rem;padding:9px 20px;cursor:pointer;transition:all .2s}
.hifd-retry-btn:hover{border-color:rgba(201,168,76,.35);color:var(--text)}
.hifd-next-btn{background:linear-gradient(135deg,var(--teal),var(--teal2));border:none;border-radius:10px;color:#fff;font-family:var(--ff);font-size:.84rem;font-weight:600;padding:9px 20px;cursor:pointer;transition:all .22s;box-shadow:0 3px 12px rgba(42,157,143,.22)}
.hifd-next-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(42,157,143,.38)}
.hifd-nav{display:flex;align-items:center;gap:10px;justify-content:space-between}
.hifd-nav-btn{background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--textD);font-family:var(--ff);font-size:.8rem;padding:8px 16px;cursor:pointer;transition:all .2s}
.hifd-nav-btn:disabled{opacity:.25;cursor:not-allowed}
.hifd-nav-btn:not(:disabled):hover{border-color:rgba(201,168,76,.3);color:var(--text)}
.hifd-nav-dots{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;flex:1}
.hifd-nav-dot{width:11px;height:11px;border-radius:50%;background:var(--bg5);border:1px solid var(--border);cursor:pointer;transition:all .22s;padding:0}
.hifd-nav-dot.cur{background:var(--gold);border-color:var(--gold);box-shadow:0 0 8px rgba(201,168,76,.45);transform:scale(1.15)}
.hifd-nav-dot.good{background:var(--teal2);border-color:var(--teal2)}
.hifd-nav-dot.bad{background:rgba(176,32,32,.5);border-color:rgba(176,32,32,.5)}

/* ─── SELECTION MODE TABS ─── */
.sel-mode-tabs{display:flex;gap:6px;padding:0 24px 0;border-bottom:1px solid var(--border);background:var(--bg2)}
.sel-mode-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:none;background:transparent;color:var(--textD);font-family:var(--ff);font-size:.87rem;cursor:pointer;border-bottom:2.5px solid transparent;transition:all .22s;letter-spacing:.015em}
.sel-mode-btn.active{color:var(--gold2);border-bottom-color:var(--gold);font-weight:700;background:rgba(201,168,76,.06)}
.sel-mode-btn:hover:not(.active){color:var(--text);background:rgba(255,255,255,.025)}

/* ─── HIZB PICKER ─── */
.hpicker{display:flex;flex-direction:column;gap:14px;padding:4px 0}

.hpicker-juz-wrap{overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.hpicker-juz-wrap::-webkit-scrollbar{height:3px}
.hpicker-juz-wrap::-webkit-scrollbar-thumb{background:rgba(201,168,76,.3);border-radius:2px}
.hpicker-juz-track{display:inline-flex;gap:4px;padding:2px 4px;background:var(--bg3);border:1px solid var(--border);border-radius:40px;min-width:max-content}
.hpicker-juz-btn{min-width:38px;height:34px;border:none;background:transparent;color:var(--textD);font-family:var(--ff);font-size:.78rem;border-radius:30px;cursor:pointer;transition:all .2s;font-weight:500;padding:0 4px}
.hpicker-juz-btn.active{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#0c1020;font-weight:700;box-shadow:0 3px 10px rgba(201,168,76,.35)}
.hpicker-juz-btn:hover:not(.active){background:rgba(255,255,255,.06);color:var(--text)}

.hpicker-juz-lbl{display:flex;align-items:center;gap:10px;padding:0 2px}
.hpicker-juz-name{font-size:.88rem;color:var(--gold2);font-weight:700;font-family:var(--ff);letter-spacing:.02em}
.hpicker-sel-badge{font-size:.65rem;color:var(--teal3);background:rgba(42,157,143,.1);border:1px solid rgba(42,157,143,.25);padding:2px 9px;border-radius:20px;display:flex;align-items:center;gap:5px}

.hpicker-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:560px){.hpicker-cards{grid-template-columns:1fr}}

.hcard{position:relative;background:var(--bg3);border:1.5px solid var(--border);border-radius:16px;padding:16px 18px;cursor:pointer;transition:all .24s;overflow:hidden;display:flex;flex-direction:column;gap:10px}
.hcard::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 20% -10%,rgba(42,157,143,.07),transparent 60%);pointer-events:none;opacity:0;transition:opacity .3s}
.hcard:hover{border-color:rgba(201,168,76,.38);transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.22)}
.hcard:hover::before{opacity:1}
.hcard-sel{border-color:var(--gold)!important;background:linear-gradient(145deg,rgba(201,168,76,.1),rgba(42,157,143,.06));box-shadow:0 0 0 1px rgba(201,168,76,.22),0 10px 32px rgba(0,0,0,.28)!important}
.hcard-sel::before{opacity:1!important}
.hcard-glow{position:absolute;inset:-1px;border-radius:16px;border:1px solid var(--gold);pointer-events:none;box-shadow:inset 0 0 20px rgba(201,168,76,.08),0 0 20px rgba(201,168,76,.12)}

.hcard-badge{display:flex;align-items:center;gap:6px;font-size:.72rem;color:var(--textD);font-weight:600}
.hcard-badge span:first-of-type{color:var(--gold);font-size:.82rem;font-weight:700;font-family:var(--ff)}
.hcard-half{margin-inline-start:auto;font-size:.63rem;color:var(--textDD);background:var(--bg4);border:1px solid var(--border);padding:1px 8px;border-radius:20px}

.hcard-range{display:flex;align-items:flex-start;gap:8px;direction:rtl}
.hcard-point{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.hcard-pt-lbl{font-size:.58rem;color:var(--textDD);text-transform:uppercase;letter-spacing:.04em}
.hcard-surah{font-family:var(--fq);font-size:1.02rem;color:var(--text);line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hcard-ayah{font-size:.65rem;color:var(--teal3);font-weight:600}
.hcard-arrow{font-size:.9rem;color:var(--textDD);margin-top:18px;flex-shrink:0}

.hpicker-sel-summary{display:flex;align-items:center;gap:10px;padding:11px 14px;background:linear-gradient(135deg,rgba(201,168,76,.1),rgba(42,157,143,.06));border:1px solid rgba(201,168,76,.3);border-radius:12px;font-size:.78rem;color:var(--gold2);font-weight:600;flex-wrap:wrap;gap:8px}
.hpicker-sel-range{font-family:var(--fq);font-size:.82rem;color:var(--text);margin-inline-start:auto}

/* ─── HIZB INFO CARD (step 4 multi-surah) ─── */
.hizb-info-card{display:flex;gap:18px;align-items:flex-start;padding:28px 24px;background:linear-gradient(135deg,rgba(201,168,76,.1),rgba(42,157,143,.07),rgba(0,0,0,0));border:1px solid rgba(201,168,76,.3);border-radius:16px;margin:24px 0}
.hizb-info-icon{width:56px;height:56px;border-radius:14px;background:linear-gradient(140deg,rgba(42,157,143,.3),rgba(201,168,76,.2));border:1px solid rgba(201,168,76,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.hizb-info-body{display:flex;flex-direction:column;gap:8px}
.hizb-info-title{font-family:var(--fq);font-size:1.3rem;color:var(--gold2);font-weight:700}
.hizb-info-range{font-family:var(--fq);font-size:1rem;color:var(--text);line-height:1.8;direction:rtl}
.hizb-info-note{font-size:.75rem;color:var(--textD)}

/* ─── MODE SELECTION SCREEN ─── */
.mode-screen{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:var(--bg0);padding:24px}
.mode-screen::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 20%,rgba(201,168,76,.09) 0%,transparent 65%);pointer-events:none}
.mode-screen-inner{display:flex;flex-direction:column;align-items:center;gap:40px;max-width:860px;width:100%;position:relative;z-index:1}
.mode-screen-top{text-align:center;display:flex;flex-direction:column;gap:10px}
.mode-screen-bismillah{font-family:var(--fq);font-size:1.5rem;color:var(--gold);opacity:.75;letter-spacing:.03em;text-shadow:0 0 30px rgba(201,168,76,.2)}
.mode-screen-title{font-family:var(--ff);font-size:clamp(2.1rem,5vw,3.4rem);font-weight:700;color:var(--gold2);text-shadow:0 0 70px rgba(201,168,76,.24);letter-spacing:.03em}
.mode-screen-sub{font-size:.95rem;color:var(--textD);letter-spacing:.02em;line-height:1.55}
.mode-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;width:100%}
@media(max-width:640px){.mode-cards{grid-template-columns:1fr;gap:12px}}
.mode-card{display:flex;flex-direction:column;align-items:center;gap:14px;padding:36px 22px;border-radius:22px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;transition:all .3s cubic-bezier(.22,.68,0,1.2);position:relative;overflow:hidden;text-align:center}
.mode-card::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity .3s;pointer-events:none}
.mode-card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;opacity:0;transition:opacity .3s}
.mode-card-teal::before{background:linear-gradient(145deg,rgba(42,157,143,.13),transparent 70%)}
.mode-card-teal::after{background:linear-gradient(90deg,transparent,var(--teal2),transparent)}
.mode-card-gold::before{background:linear-gradient(145deg,rgba(201,168,76,.13),transparent 70%)}
.mode-card-gold::after{background:linear-gradient(90deg,transparent,var(--gold),transparent)}
.mode-card-dim::before{background:linear-gradient(145deg,rgba(180,180,220,.09),transparent 70%)}
.mode-card-dim::after{background:linear-gradient(90deg,transparent,rgba(180,180,220,.4),transparent)}
.mode-card-hov{transform:translateY(-5px);border-color:rgba(201,168,76,.38);box-shadow:0 14px 48px rgba(0,0,0,.32)}
.mode-card-teal.mode-card-hov{border-color:rgba(42,157,143,.52);box-shadow:0 14px 48px rgba(42,157,143,.22)}
.mode-card-gold.mode-card-hov{border-color:rgba(201,168,76,.52);box-shadow:0 14px 48px rgba(201,168,76,.2)}
.mode-card-hov::before,.mode-card-hov::after{opacity:1}
.mode-card-icon{width:76px;height:76px;border-radius:20px;display:flex;align-items:center;justify-content:center;background:var(--bg3);border:1px solid var(--border);transition:all .3s cubic-bezier(.22,.68,0,1.2)}
.mode-card-teal .mode-card-icon{background:rgba(42,157,143,.12);border-color:rgba(42,157,143,.28)}
.mode-card-gold .mode-card-icon{background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.22)}
.mode-card-hov .mode-card-icon{transform:scale(1.1)}
.mode-card-title{font-family:var(--ff);font-size:1.2rem;font-weight:700;color:var(--text);letter-spacing:.025em}
.mode-card-desc{font-size:.82rem;color:var(--textD);line-height:1.65;letter-spacing:.01em}
.mode-card-arrow{opacity:.28;transition:opacity .2s,transform .2s;color:var(--textD)}
.mode-card:hover .mode-card-arrow{opacity:.7;transform:translateX(-3px)}
.mode-screen-note{font-size:.74rem;color:var(--textDD);text-align:center;letter-spacing:.015em}

/* ─── MODE CHIP (header) ─── */
.mode-chip{display:flex;align-items:center;gap:6px;padding:6px 13px;border-radius:20px;border:1px solid var(--border);background:var(--bg3);font-family:var(--ff);font-size:.77rem;cursor:pointer;transition:all .22s;color:var(--textD);letter-spacing:.015em}
.mode-chip:hover{border-color:rgba(201,168,76,.3);color:var(--text)}
.mode-chip-wird{border-color:rgba(42,157,143,.3);color:var(--teal2);background:rgba(42,157,143,.08)}
.mode-chip-hifd{border-color:rgba(201,168,76,.3);color:var(--gold);background:rgba(201,168,76,.07)}
.mode-chip-free{color:var(--textD)}

/* ─── HISTORY BUTTON (header) ─── */
.hist-btn{position:relative;background:var(--bg3);border:1px solid var(--border);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s;flex-shrink:0}
.hist-btn:hover{border-color:var(--gold);transform:scale(1.08)}
.hist-btn-badge{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;border-radius:8px;background:var(--gold);color:#0c1020;font-size:.58rem;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;font-family:var(--ff)}

/* ─── HISTORY PANEL ─── */
.hist-overlay{position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,0);pointer-events:none;transition:background .3s}
.hist-overlay-show{background:rgba(0,0,0,.55);pointer-events:auto}
.hist-panel{position:fixed;top:0;right:0;bottom:0;z-index:8001;width:min(400px,100vw);background:var(--bg1);border-left:1px solid var(--border);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .35s cubic-bezier(.25,.46,.45,.94);overflow:hidden}
.hist-panel-open{transform:translateX(0)}
.hist-hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border);flex-shrink:0}
.hist-title{display:flex;align-items:center;gap:8px;font-family:var(--ff);font-size:1.05rem;font-weight:700;color:var(--gold2);letter-spacing:.025em}
.hist-close{background:var(--bg3);border:1px solid var(--border);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--textD);transition:all .2s}
.hist-close:hover{border-color:var(--gold);color:var(--gold)}
.hist-stats{display:flex;align-items:center;justify-content:space-around;padding:16px 20px;flex-shrink:0}
.hist-stat{display:flex;flex-direction:column;align-items:center;gap:3px}
.hist-stat-n{font-family:var(--ff);font-size:1.5rem;font-weight:700;color:var(--gold2);letter-spacing:.02em}
.hist-stat-l{font-size:.68rem;color:var(--textD);letter-spacing:.01em}
.hist-stat-div{width:1px;height:30px;background:var(--border)}
.hist-prog-wrap{height:5px;background:var(--bg4);margin:0 20px;border-radius:3px;overflow:hidden;flex-shrink:0}
.hist-prog-bar{height:100%;background:linear-gradient(90deg,var(--teal),var(--gold));border-radius:3px;transition:width .8s ease}
.hist-grid-hdr{padding:14px 20px 8px;font-size:.7rem;color:var(--textD);flex-shrink:0;font-weight:600;letter-spacing:.05em}
.hist-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;padding:0 20px 12px;flex-shrink:0}
.hist-cell{aspect-ratio:1;border-radius:5px;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;transition:all .2s;position:relative}
.hist-cell-done{background:rgba(42,157,143,.18);border-color:rgba(42,157,143,.4)}
.hist-cell-n{font-family:var(--ff);font-size:.6rem;color:var(--textDD)}
.hist-list-hdr{padding:12px 20px 6px;font-size:.7rem;color:var(--textD);font-weight:600;flex-shrink:0}
.hist-list{flex:1;overflow-y:auto;padding:0 20px 20px;display:flex;flex-direction:column;gap:6px}
.hist-list::-webkit-scrollbar{width:3px}
.hist-list::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.hist-entry{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:9px}
.hist-entry-left{display:flex;align-items:center;gap:8px}
.hist-entry-mode{font-size:.64rem;font-weight:700;padding:2px 8px;border-radius:10px;background:var(--bg4);border:1px solid var(--border)}
.hist-entry-what{font-family:var(--ff);font-size:.86rem;color:var(--text);letter-spacing:.01em}
.hist-entry-date{font-size:.66rem;color:var(--textD)}
.hist-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:40px 20px;text-align:center}
.hist-empty p{font-size:.82rem;color:var(--textD);line-height:1.7;font-family:var(--ff)}
/* hist tabs */
.hist-tabs{display:flex;gap:6px;padding:10px 20px 0;flex-shrink:0}
.hist-tab{flex:1;padding:8px 10px;border-radius:10px;border:1px solid var(--border);background:var(--bg2);color:var(--textD);font-size:.78rem;font-family:var(--ff);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:all .2s;letter-spacing:.01em}
.hist-tab:hover{border-color:var(--gold);color:var(--text)}
.hist-tab-active{background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(201,168,76,.06));border-color:rgba(201,168,76,.5);color:var(--gold);font-weight:700}
/* hifd ring */
.hifd-ring-row{display:flex;align-items:center;gap:20px;padding:20px 20px 10px;flex-shrink:0}
.hifd-ring-svg{flex-shrink:0;filter:drop-shadow(0 0 12px rgba(201,168,76,.25))}
.hifd-ring-stats{display:flex;flex-direction:column;gap:10px;flex:1}
.hifd-rstat{display:flex;flex-direction:column;gap:1px}
.hifd-rstat-n{font-family:var(--ff);font-size:1.32rem;font-weight:700;color:var(--text);line-height:1;letter-spacing:.02em}
.hifd-rstat-l{font-size:.7rem;color:var(--textD);letter-spacing:.01em}
/* hifd per-surah bars */
.hifd-surah-list{flex:1;overflow-y:auto;padding:4px 20px 80px;display:flex;flex-direction:column;gap:12px}
.hifd-surah-list::-webkit-scrollbar{width:3px}
.hifd-surah-list::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.hifd-surah-row{display:flex;flex-direction:column;gap:5px}
.hifd-surah-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.hifd-surah-name{font-family:var(--fq);font-size:.98rem;color:var(--text);font-weight:600;letter-spacing:.01em}
.hifd-surah-pct{font-size:.68rem;color:var(--gold);display:flex;align-items:center;gap:4px;white-space:nowrap}
.hifd-pct-done{color:var(--teal2)!important}
.hifd-pct-sep{opacity:.5;margin:0 1px}
.hifd-bar-track{height:6px;border-radius:3px;background:var(--bg3);overflow:hidden}
.hifd-bar-fill{height:100%;border-radius:3px;transition:width .5s cubic-bezier(.25,.46,.45,.94)}

/* ─── WCARD FINISH AREA (bottom of Quran page — always visible) ─── */
.wcard-finish-area{margin:24px 0 8px;padding:0 2px}
.wcard-finish-hint{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;border:1px dashed var(--border);border-radius:12px;font-size:.78rem;color:var(--textDD);font-family:var(--ff)}
.wcard-finish-btn{width:100%;display:flex;align-items:center;gap:14px;padding:16px 20px;border-radius:16px;border:1px solid rgba(201,168,76,.45);background:linear-gradient(135deg,rgba(201,168,76,.14) 0%,rgba(42,157,143,.06) 100%);cursor:pointer;transition:all .32s;text-align:right;position:relative;overflow:hidden}
.wcard-finish-btn::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(201,168,76,.1),transparent);opacity:0;transition:opacity .32s}
.wcard-finish-btn:not(.wcard-finish-done):hover::after{opacity:1}
.wcard-finish-btn:not(.wcard-finish-done):hover{border-color:rgba(201,168,76,.75);box-shadow:0 0 32px rgba(201,168,76,.22),0 6px 24px rgba(0,0,0,.18);transform:translateY(-2px)}
.wcard-finish-btn:not(.wcard-finish-done){animation:wfpulse 2.8s ease-in-out infinite}
@keyframes wfpulse{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,0),0 2px 12px rgba(0,0,0,.12)}55%{box-shadow:0 0 0 5px rgba(201,168,76,.1),0 2px 12px rgba(0,0,0,.12)}}
.wcard-finish-done{border-color:rgba(42,157,143,.45)!important;background:linear-gradient(135deg,rgba(42,157,143,.12),rgba(42,157,143,.04))!important;animation:none!important;cursor:default;transform:none!important}
.wcard-finish-icon,.wcard-finish-check{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.2)}
.wcard-finish-done .wcard-finish-check{background:rgba(42,157,143,.14);border-color:rgba(42,157,143,.3)}
.wcard-finish-text{display:flex;flex-direction:column;gap:3px;flex:1}
.wcard-finish-title{font-family:var(--ff);font-size:1rem;font-weight:700;color:var(--gold2);letter-spacing:.02em}
.wcard-finish-done .wcard-finish-title{color:var(--teal3)}
.wcard-finish-sub{font-size:.72rem;color:var(--textD)}

/* ─── HPICKER PROGRESS ─── */
.hpicker-progress{height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;position:relative;margin-bottom:4px}
.hpicker-prog-bar{height:100%;background:linear-gradient(90deg,var(--teal),var(--gold));border-radius:3px;transition:width .8s ease}
.hpicker-prog-lbl{position:absolute;top:50%;right:0;transform:translateY(-50%);font-size:.6rem;color:var(--textD);background:var(--bg2);padding:0 4px;border-radius:2px;display:none}
.hpicker-juz-btn.done{background:rgba(42,157,143,.18);border-color:rgba(42,157,143,.4);color:var(--teal2)}
.hpicker-juz-btn.half{background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.25);color:var(--gold)}
.hpicker-juz-dot{position:absolute;top:2px;right:2px;width:4px;height:4px;border-radius:50%;background:var(--teal2)}
.hpicker-juz-btn{position:relative}
.hcard-done{border-color:rgba(42,157,143,.35)!important;background:rgba(42,157,143,.06)!important}
.hcard-sugg{border-color:rgba(201,168,76,.5)!important;box-shadow:0 0 16px rgba(201,168,76,.12)!important}
.hcard-done-badge{font-size:.64rem;color:var(--teal3);background:rgba(42,157,143,.12);border:1px solid rgba(42,157,143,.2);border-radius:8px;padding:2px 7px;margin-right:auto;display:flex;align-items:center;gap:3px}
.hcard-sugg-badge{font-size:.64rem;color:var(--gold);background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:2px 7px;margin-right:auto;animation:pulse 2s infinite}
`}</style>
    </div>
  );
}
