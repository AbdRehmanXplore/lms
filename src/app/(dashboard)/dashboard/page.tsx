"use client";

import dynamic from "next/dynamic";

/** Client-only: Recharts + live stats avoid SSR/hydration issues that can blank the dashboard. */
const DashboardHome = dynamic(
  () => import("@/components/dashboard/DashboardHome").then((mod) => ({ default: mod.DashboardHome })),
  {
    ssr: false,
    loading: () => (
      <div className="grid animate-pulse gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-[var(--bg-surface-2)]" />
        ))}
      </div>
    ),
  },
);

export default function DashboardPage() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Main · Dashboard</p>
      <DashboardHome />
    </div>
  );
}
