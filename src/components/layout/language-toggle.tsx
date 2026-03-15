"use client";

import { useLanguage } from "@/components/providers";

function Globe3D({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="globe3d-bg" x1="3" y1="3" x2="37" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#6C3FC5" />
        </linearGradient>
        <linearGradient id="globe3d-shine" x1="20" y1="3" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.35" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="globe3d-glow" cx="14" cy="12" r="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.18" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 3D shadow */}
      <rect x="4" y="6" width="34" height="34" rx="11" fill="#4C2A8A" opacity="0.18" />
      {/* Background */}
      <rect x="3" y="3" width="34" height="34" rx="11" fill="url(#globe3d-bg)" />
      {/* Top shine */}
      <rect x="3" y="3" width="34" height="17" rx="11" fill="url(#globe3d-shine)" />
      {/* Globe sphere */}
      <circle cx="20" cy="20" r="10" fill="none" stroke="white" strokeWidth="1.6" opacity="0.9" />
      {/* Meridian (vertical ellipse) */}
      <ellipse cx="20" cy="20" rx="4.5" ry="10" fill="none" stroke="white" strokeWidth="1" opacity="0.55" />
      {/* Second meridian */}
      <ellipse cx="20" cy="20" rx="8" ry="10" fill="none" stroke="white" strokeWidth="0.7" opacity="0.3" />
      {/* Latitude lines */}
      <ellipse cx="20" cy="15" rx="9" ry="2.2" fill="none" stroke="white" strokeWidth="0.7" opacity="0.4" />
      <ellipse cx="20" cy="25" rx="9" ry="2.2" fill="none" stroke="white" strokeWidth="0.7" opacity="0.4" />
      {/* Equator */}
      <ellipse cx="20" cy="20" rx="10" ry="3" fill="none" stroke="white" strokeWidth="0.9" opacity="0.5" />
      {/* Radial glow */}
      <circle cx="14" cy="14" r="8" fill="url(#globe3d-glow)" />
      {/* Specular highlight */}
      <circle cx="15" cy="15" r="3" fill="white" opacity="0.12" />
    </svg>
  );
}

export function LanguageToggle() {
  const { lang, toggleLang } = useLanguage();

  return (
    <button
      onClick={toggleLang}
      className="group relative outline-none"
      aria-label="Toggle language"
    >
      {/* 3D Globe icon */}
      <Globe3D className="w-10 h-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[15deg]" />

      {/* Language badge overlaid on globe */}
      <span className="absolute -bottom-0.5 -end-1 bg-gradient-to-br from-[#9B6FFF] to-[#6C3FC5] text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-[0_2px_6px_rgba(108,63,197,0.5)] border-2 border-background transition-transform duration-300 group-hover:scale-110">
        {lang === "ar" ? "عر" : "EN"}
      </span>
    </button>
  );
}
