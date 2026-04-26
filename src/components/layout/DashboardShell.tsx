"use client";

import { useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils/cn";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {mobileNav && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
        />
      )}

      <Sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-50 md:static md:z-auto md:translate-x-0",
          mobileNav ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        onNavigate={() => setMobileNav(false)}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header onOpenMobileNav={() => setMobileNav(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
