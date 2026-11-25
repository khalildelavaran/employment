import React, { useState, useEffect } from 'react';

interface DastevaLogoMarkProps {
  orgLogoDataUrl?: string;
  size?: number;
  className?: string;
}

export const DastevaLogoMark: React.FC<DastevaLogoMarkProps> = ({
  orgLogoDataUrl,
  size = 52,
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [orgLogoDataUrl]);

  const hasValidCustomLogo =
    Boolean(orgLogoDataUrl && orgLogoDataUrl.startsWith('data:image/')) && !imgFailed;

  if (hasValidCustomLogo) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-xl border border-slate-200 bg-white p-1 overflow-hidden shrink-0 ${className}`}
      >
        <img
          src={orgLogoDataUrl}
          alt="لوگوی سازمان"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`flex items-center justify-center shrink-0 ${className}`}
      aria-label="لوگوی رسمی شرکت دستوا"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="2" y="2" width="60" height="60" rx="14" fill="#0F172A" />
        <rect
          x="5.5"
          y="5.5"
          width="53"
          height="53"
          rx="11"
          stroke="#38BDF8"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />
        <path
          d="M19 18H33.5C42.0604 18 48 23.62 48 32C48 40.38 42.0604 46 33.5 46H19V18Z"
          stroke="#FFFFFF"
          strokeWidth="4.2"
          strokeLinejoin="round"
        />
        <path
          d="M26 25.5H33C37.1421 25.5 40.2 28.25 40.2 32C40.2 35.75 37.1421 38.5 33 38.5H26V25.5Z"
          fill="#2563EB"
        />
        <circle cx="29.5" cy="32" r="2.6" fill="#FFFFFF" />
      </svg>
    </div>
  );
};
