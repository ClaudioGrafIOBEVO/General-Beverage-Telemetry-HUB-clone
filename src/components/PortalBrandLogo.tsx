import React, { useState } from 'react';

interface PortalBrandLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'io-bevo' | 'io-sano';
  showSubtitle?: boolean;
}

export const PortalBrandLogo: React.FC<PortalBrandLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  showSubtitle = false,
}) => {
  const [imgError, setImgError] = useState(false);

  // Height classes based on size
  const heightClass =
    size === 'xs'
      ? 'h-6 sm:h-7'
      : size === 'sm'
      ? 'h-8 sm:h-9'
      : size === 'md'
      ? 'h-9 sm:h-11'
      : size === 'lg'
      ? 'h-12 sm:h-14'
      : 'h-16 sm:h-20';

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Brand Logo Container */}
      <div className={`relative ${heightClass} flex items-center shrink-0`}>
        {!imgError && variant === 'full' ? (
          <img
            src="/io-bevo-io-sano.svg"
            alt="io sano & io bevo Logo"
            className={`${heightClass} w-auto max-w-full object-contain block`}
            onError={() => setImgError(true)}
          />
        ) : (
          <svg
            viewBox="0 0 520 220"
            className={`${heightClass} w-auto max-w-full`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Left Brand: io sano */}
            {(variant === 'full' || variant === 'io-sano') && (
              <g id="io-sano-brand" transform="translate(15, 20)">
                {/* Teal Open Frame */}
                <path
                  d="M 175 110 L 175 25 L 30 25 L 30 110"
                  fill="none"
                  stroke="#026578"
                  strokeWidth="5.5"
                  strokeLinecap="square"
                />

                {/* Red Hand-Drawn Heart */}
                <path
                  d="M 102 65 C 96 50, 78 48, 68 58 C 55 71, 56 94, 82 114 C 95 124, 102 129, 106 132 C 107 131, 114 122, 122 114 C 138 98, 148 83, 143 67 C 138 52, 120 48, 110 58 C 106 62, 104 65, 102 65 Z"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 104 66 C 98 52, 79 50, 70 60 C 58 72, 60 93, 84 112 C 96 122, 103 127, 105 129"
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.85"
                />

                {/* Text: io sano */}
                <g fill="#026578" fontFamily="'Century Gothic', 'Outfit', 'Segoe UI', Arial, sans-serif">
                  <circle cx="32" cy="116" r="4.2" />
                  <rect x="28.5" y="126" width="7" height="34" rx="2" />
                  <circle cx="62" cy="143" r="16.5" fill="none" stroke="#026578" strokeWidth="6.5" />
                  <text x="88" y="157" fontSize="44" fontWeight="500" letterSpacing="-1">
                    sano
                  </text>
                </g>
              </g>
            )}

            {/* Right Brand: io bevo */}
            {(variant === 'full' || variant === 'io-bevo') && (
              <g id="io-bevo-brand" transform="translate(320, 25)">
                {/* Big 'io' */}
                <g fill="#168a44">
                  <circle cx="28" cy="30" r="11" />
                  <rect x="18" y="54" width="20" height="85" rx="6" />
                  <circle cx="95" cy="97" r="42" fill="none" stroke="#168a44" strokeWidth="19" />
                </g>

                {/* 'bevo' below 'io' */}
                <g fill="#168a44" fontFamily="'Century Gothic', 'Outfit', 'Segoe UI', Arial, sans-serif">
                  <text x="14" y="186" fontSize="52" fontWeight="400" letterSpacing="-1.5">
                    bevo
                  </text>
                </g>
              </g>
            )}
          </svg>
        )}
      </div>

      {showSubtitle && (
        <div className="hidden sm:flex flex-col border-l border-slate-300 dark:border-white/15 pl-2.5 leading-tight">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Portale IoT
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Telemetria &amp; Flotta
          </span>
        </div>
      )}
    </div>
  );
};
