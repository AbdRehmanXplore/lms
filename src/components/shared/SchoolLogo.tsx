"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  size?: number;
  className?: string;
};

export function SchoolLogo({ size = 40, className }: Props) {
  const [failed, setFailed] = useState(false);

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
      src="/logo.png"
      alt="School Logo"
      width={size}
      height={size}
      className={cn("rounded-xl object-cover", className)}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
