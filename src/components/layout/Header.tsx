"use client";

import { useEffect, useState } from "react";
import { Bell, Menu } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { SchoolLogo } from "@/components/shared/SchoolLogo";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import Link from "next/link";
import dynamic from "next/dynamic";

const ThemeToggle = dynamic(() => import("@/components/ui/ThemeToggle").then((m) => m.ThemeToggle), {
  ssr: false,
});

type HeaderProps = {
  onOpenMobileNav?: () => void;
};

export function Header({ onOpenMobileNav }: HeaderProps) {
  const supabase = useSupabaseClient();
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setProfile(data);
    })();
  }, [supabase]);

  const initial = (profile?.full_name ?? "A").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-header)]/95 backdrop-blur-md">
      <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between md:gap-4 md:p-4">
        <div className="flex min-w-0 items-center gap-3">
          {onOpenMobileNav && (
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] p-2 text-[var(--text-primary)] md:hidden"
              onClick={onOpenMobileNav}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <SchoolLogo size={36} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]">
                NEW OXFORD GRAMMER SCHOOL
              </p>
              <p suppressHydrationWarning className="truncate text-[11px] text-[var(--text-muted)]">
                {todayLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="order-last w-full min-w-0 flex-1 md:order-none md:max-w-2xl md:px-4">
          <SearchBar />
        </div>

        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <Link
            href="/announcements"
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] p-2 text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            aria-label="Notifications"
          >
            <Bell size={18} />
          </Link>
          <div className="hidden items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] py-1 pl-1 pr-3 sm:flex">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-blue)]/20 text-xs font-bold text-[var(--accent-blue)]"
              aria-hidden
            >
              {initial}
            </div>
            <span className="max-w-[120px] truncate text-xs font-medium text-[var(--text-primary)]">
              {profile?.full_name ?? "Admin"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
