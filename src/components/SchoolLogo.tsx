"use client";

import { useState } from "react";
import { brandLogoSrc, FALLBACK_LOGO } from "@/lib/logo";

export function SchoolLogo({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const href = failed ? FALLBACK_LOGO : brandLogoSrc(src);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={href}
      alt={alt}
      className={className}
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}
