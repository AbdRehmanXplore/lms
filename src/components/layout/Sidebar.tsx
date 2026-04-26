"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  PieChart,
  Settings,
  Table2,
  Users,
  Wallet,
  UserCheck,
  Briefcase,
} from "lucide-react";
import clsx from "clsx";
import { UserMenu } from "./UserMenu";
import { SchoolLogo } from "@/components/shared/SchoolLogo";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };

type Group = { title: string; items: Item[] };

const groups: Group[] = [
  {
    title: "Main",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "People",
    items: [
      { href: "/teachers", label: "Teachers", icon: Users },
      { href: "/students", label: "Students", icon: GraduationCap },
    ],
  },
  {
    title: "Academic",
    items: [
      { href: "/classes", label: "Classes", icon: BookOpen },
      { href: "/timetable", label: "Timetable", icon: Table2 },
      { href: "/results", label: "Results", icon: ClipboardList },
      { href: "/admit-cards", label: "Admit Cards", icon: IdCard },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/fees", label: "Fees Overview", icon: Wallet },
      { href: "/fees/add", label: "Generate Voucher", icon: Wallet },
      { href: "/fees/defaulters", label: "Fee Defaulters", icon: Wallet },
      { href: "/expenses", label: "Expenses", icon: PieChart },
      { href: "/finance/salaries", label: "Teacher Salaries", icon: Briefcase },
    ],
  },
  {
    title: "Attendance",
    items: [
      { href: "/attendance", label: "Student Attendance", icon: CalendarCheck },
      { href: "/attendance/history", label: "Student Att. history", icon: CalendarDays },
      { href: "/teacher-attendance", label: "Teacher Attendance", icon: UserCheck },
    ],
  },
  {
    title: "History",
    items: [
      { href: "/history/monthly", label: "Monthly History", icon: CalendarDays },
      { href: "/history/yearly", label: "Yearly Archive", icon: CalendarDays },
    ],
  },
  {
    title: "Other",
    items: [
      { href: "/announcements", label: "Announcements", icon: Bell },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const flatItems = groups.flatMap((g) => g.items);

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const sorted = [...flatItems].sort((a, b) => b.href.length - a.href.length);
  const current = sorted.find((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));

  return (
    <aside
      className={clsx(
        "flex h-screen w-72 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] p-4 shadow-sm transition-transform duration-200 ease-out md:translate-x-0",
        "dark:bg-gradient-to-b dark:from-[var(--bg-sidebar)] dark:to-[#0f172a]",
        className,
      )}
    >
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-blue)]/12 to-transparent p-3 dark:from-[var(--accent-blue)]/20">
        <div className="flex items-center gap-3">
          <SchoolLogo size={40} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              NEW OXFORD GRAMMER SCHOOL
            </p>
            <h1 className="text-sm font-semibold text-[var(--accent-blue)]">Management System</h1>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => onNavigate?.()}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm transition-all duration-200",
                    current?.href === href
                      ? "border-l-[var(--accent-blue)] bg-[var(--accent-blue)]/10 font-semibold text-[var(--text-primary)] dark:bg-[var(--bg-surface-2)]"
                      : "border-l-transparent text-[color-mix(in_srgb,var(--text-primary)_85%,white)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]",
                  )}
                >
                  <Icon size={16} className="shrink-0 opacity-90" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <UserMenu />
    </aside>
  );
}
