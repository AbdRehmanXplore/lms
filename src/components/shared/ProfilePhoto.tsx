"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  src: string | null | undefined;
  alt: string;
  name?: string | null;
  size?: number;
  /** Table avatars use circle; detail headers use card (rounded rectangle). */
  variant?: "circle" | "card";
  className?: string;
};

/** Renders a URL-based profile photo (any HTTPS origin). Falls back on error or empty URL. */
export function ProfilePhoto({ src, alt, name, size = 40, variant = "circle", className }: Props) {
  const [failed, setFailed] = useState(false);
  const trimmed = src?.trim();
  const round = variant === "card" ? "rounded-xl" : "rounded-full";
  const initial = name?.trim()?.charAt(0)?.toUpperCase() ?? "?";

  if (!trimmed || failed) {
    return (
      <div
        className={cn("flex items-center justify-center rounded-full bg-blue-600/80 text-sm font-semibold text-white", className)}
        style={{ width: size, height: size }}
      >
        {initial}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- intentional: arbitrary user URLs for profile_photo
    <img
      src={trimmed}
      alt={alt}
      width={size}
      height={size}
      className={cn(round, "object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
