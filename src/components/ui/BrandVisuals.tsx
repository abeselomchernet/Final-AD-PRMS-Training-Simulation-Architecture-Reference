import React, { useState } from 'react';
import emblemUrl from '../../assets/images/adprms_emblem_mark_1794660268225.jpg';
import heroUrl from '../../assets/images/addis_commercial_hero_1794660270859.jpg';

export const BrandEmblem: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const [imgError, setImgError] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-8 h-8 rounded-md'
      : size === 'lg'
        ? 'w-12 h-12 rounded-xl'
        : 'w-9 h-9 rounded-lg';

  return (
    <div
      className={`${dims} overflow-hidden border border-[#C28A24]/50 bg-[#0D1D30] flex items-center justify-center shrink-0 shadow-xs ${className}`}
    >
      {!imgError ? (
        <img
          src={emblemUrl}
          alt="AD-PRMS architectural monogram emblem"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 36 36"
          className="w-6 h-6"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M18 4L30 10V21C30 27.2 24.8 31.2 18 33C11.2 31.2 6 27.2 6 21V10L18 4Z"
            stroke="#D9A441"
            strokeWidth="1.6"
            fill="#0F233A"
          />
          <path
            d="M12 24V15L18 11L24 15V24M15.5 24V18H20.5V24"
            stroke="#248F64"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
};

export const AddisArchitecturalShowcase: React.FC<{
  title: string;
  subtitle: string;
  badgeText?: string;
  heightClass?: string;
}> = ({ title, subtitle, badgeText, heightClass = 'h-48 sm:h-56' }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`relative w-full ${heightClass} overflow-hidden bg-[#0D1D30]`}>
      {!imgError ? (
        <img
          src={heroUrl}
          alt="Contemporary glass and stone commercial building in Addis Ababa Ethiopia"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#0F233A] via-[#122D46] to-[#166549]/60 flex items-center justify-center">
          <svg viewBox="0 0 240 120" className="w-48 h-24 opacity-40" fill="none" aria-hidden="true">
            <rect x="35" y="25" width="48" height="80" stroke="#D9A441" strokeWidth="1.5" />
            <rect x="92" y="12" width="58" height="93" stroke="#D9A441" strokeWidth="1.8" />
            <rect x="158" y="38" width="44" height="67" stroke="#248F64" strokeWidth="1.5" />
          </svg>
        </div>
      )}

      {/* Measured contrast scrim ensuring >= 4.5:1 text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#081320]/95 via-[#081320]/55 to-[#081320]/15" />

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 flex flex-col gap-1">
        {badgeText && (
          <p className="text-[11px] font-mono tracking-wider uppercase text-[#E5B85C]">
            {badgeText}
          </p>
        )}
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight text-balance">
          {title}
        </h2>
        <p className="text-xs text-slate-200 leading-relaxed max-w-xl">
          {subtitle}
        </p>
      </div>
    </div>
  );
};
