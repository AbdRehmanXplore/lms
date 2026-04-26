import { DashboardHome } from "@/components/dashboard/DashboardHome";

export default function DashboardPage() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Main · Dashboard</p>
      <DashboardHome />
    </div>
  );
}
