"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { scheduleEffectLoad } from "@/lib/utils/scheduleEffectLoad";

type Props = {
  size?: number;
  className?: string;
  logoUrl?: string | null;
};

export function SchoolLogo({ size = 40, className, logoUrl }: Props) {
  const [failed, setFailed] = useState(false);
  const src = logoUrl?.trim() || "/logo.png";

  useEffect(() => {
    return scheduleEffectLoad(() => {
      setFailed(false);
    });
  }, [src]);

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-blue-700 font-semibold text-white",
          className,
        )}
        style={{ width: size, height: size }}
      >
        NOGS
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt="School Logo"
      width={size}
      height={size}
      className={cn("rounded-xl object-cover", className)}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
