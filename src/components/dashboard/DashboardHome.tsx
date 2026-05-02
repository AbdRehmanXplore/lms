"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  GraduationCap,
  Users,
  Wallet,
  AlertTriangle,
  PieChart as PieChartIcon,
  Briefcase,
  ArrowRight,
  Plus,
  FileText,
  ClipboardList,
  CalendarCheck,
  CreditCard,
  Printer,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { useFeeDefaulters } from "@/lib/hooks/useFeeDefaulters";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { cn } from "@/lib/utils/cn";

const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

type ClassFeeRow = { name: string; pct: number; paid: number; pending: number };

type SalaryDueRow = {
  id: string;
  due_date: string;
  salary_amount: number;
  teachers: { full_name: string | null } | { full_name: string | null }[] | null;
};

type ActivityItem = { id: string; label: string; sub: string; at: string; icon: string };

type RecentFeeRow = {
  id: string;
  amount: number;
  amount_paid: number | null;
  payment_date: string | null;
  status: string;
  students:
    | { full_name: string; classes: { name: string } | { name: string }[] | null }
    | { full_name: string; classes: { name: string } | { name: string }[] | null }[]
    | null;
};

function classNameFromStudent(row: { classes?: { name: string } | { name: string }[] | null } | null) {
  if (!row?.classes) return "—";
  const c = row.classes;
  return Array.isArray(c) ? (c[0]?.name ?? "—") : c.name;
}

function currentMonthYear() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function greeting(hour: number) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const tooltipStyle = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--text-primary)",
};

export function DashboardHome() {
  const supabase = useSupabaseClient();
  const { data: defaulters, loading: defLoading } = useFeeDefaulters();
  const [chartsReady, setChartsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), [now]);
  const monthEnd = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10), [now]);
  const today = useMemo(() => now.toISOString().slice(0, 10), [now]);
  const ym = useMemo(() => currentMonthYear(), []);

  const [stats, setStats] = useState({
    students: 0,
    studentsNewMonth: 0,
    teachers: 0,
    teachersOnLeave: 0,
    feeToday: 0,
    feeTodayCount: 0,
    unpaidTotal: 0,
    unpaidStudents: 0,
    expensesMonth: 0,
    salaryDue: 0,
    salaryDueTeachers: 0,
    studentAtt: 0,
    teacherAtt: 0,
    pendingFeesCount: 0,
  });

  const [feeExpenseMonths, setFeeExpenseMonths] = useState<{ month: string; fees: number; expenses: number }[]>([]);
  const [classDist, setClassDist] = useState<{ name: string; value: number }[]>([]);
  const [att30, setAtt30] = useState<{ day: string; rate: number }[]>([]);
  const [feeByClass, setFeeByClass] = useState<ClassFeeRow[]>([]);
  const [salaryDueList, setSalaryDueList] = useState<SalaryDueRow[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [recentFees, setRecentFees] = useState<RecentFeeRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { count: studentCount },
        { count: teacherCount },
        { count: newStudents },
        { data: paidToday },
        { data: unpaidRows },
        { count: pendingFeesCount },
        { data: expMonth },
      ] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gte("created_at", monthStart),
        supabase
          .from("fee_vouchers")
          .select("amount_paid")
          .in("status", ["paid", "partial"])
          .eq("payment_date", today),
        supabase.from("fee_vouchers").select("amount,remaining_amount,student_id").in("status", ["unpaid", "overdue"]),
        supabase
          .from("fee_vouchers")
          .select("id", { count: "exact", head: true })
          .in("status", ["unpaid", "overdue"]),
        supabase.from("expenses").select("amount").gte("expense_date", monthStart).lte("expense_date", monthEnd),
      ]);
      const feeToday = (paidToday ?? []).reduce((a, r) => a + Number((r as { amount_paid?: number }).amount_paid ?? 0), 0);
      const unpaidTotal = (unpaidRows ?? []).reduce(
        (a, r) => a + Number((r as { remaining_amount?: number; amount?: number }).remaining_amount ?? (r as { amount?: number }).amount ?? 0),
        0,
      );
      const unpaidSet = new Set((unpaidRows ?? []).map((r) => r.student_id).filter(Boolean));
      const unpaidStudents = unpaidSet.size;
      const expensesMonth = (expMonth ?? []).reduce((a, r) => a + Number(r.amount), 0);

      const [
        { data: attToday },
        { data: taToday },
        salRes,
        { data: byClass },
        { data: attRows },
        { data: fvClass },
        { data: rf10 },
        { data: rs },
        { data: rf },
        { data: tsal },
        { data: res },
      ] = await Promise.all([
        supabase.from("attendance").select("status").eq("date", today),
        supabase.from("teacher_attendance").select("status").eq("date", today),
        supabase
          .from("teacher_salaries")
          .select("id,due_date,salary_amount,teachers(full_name)")
          .eq("month_year", ym)
          .eq("status", "unpaid"),
        supabase.from("students").select("class_id, classes(name)").eq("status", "active").limit(300),
        supabase.from("attendance").select("date,status").gte("date", new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
        supabase.from("fee_vouchers").select("amount,amount_paid,remaining_amount,status, students(classes(name))").limit(1000),
        supabase
          .from("fee_vouchers")
          .select("id,amount,amount_paid,payment_date,status,students(full_name,classes(name))")
          .in("status", ["paid", "partial"])
          .order("payment_date", { ascending: false, nullsFirst: false })
          .limit(10),
        supabase.from("students").select("id,full_name,created_at").order("created_at", { ascending: false }).limit(4),
        supabase
          .from("fee_vouchers")
          .select("id,month,amount,amount_paid,payment_date,status")
          .in("status", ["paid", "partial"])
          .order("payment_date", { ascending: false, nullsFirst: false })
          .limit(4),
        supabase
          .from("teacher_salaries")
          .select("id,month_year,salary_amount,paid_date")
          .eq("status", "paid")
          .order("paid_date", { ascending: false, nullsFirst: false })
          .limit(3),
        supabase.from("results").select("id,created_at").order("created_at", { ascending: false }).limit(3),
      ]);

      const rows = attToday ?? [];
      const present = rows.filter((r) => r.status === "present" || r.status === "late").length;
      const studentAtt = rows.length ? Math.round((present / rows.length) * 100) : 0;

      const trows = taToday ?? [];
      const tPresent = trows.filter((r) => r.status === "present" || r.status === "late").length;
      const teacherAtt = trows.length ? Math.round((tPresent / trows.length) * 100) : 0;
      const teachersOnLeave = trows.filter((r) => r.status === "leave").length;

      let salaryDue = 0;
      let salaryDueTeachers = 0;
      let salList: SalaryDueRow[] = [];
      if (!salRes.error && salRes.data) {
        salList = (salRes.data as SalaryDueRow[]).map((row) => ({
          ...row,
          teachers: Array.isArray(row.teachers) ? row.teachers[0] ?? null : row.teachers,
        }));
        salaryDue = salList.reduce((a, r) => a + Number(r.salary_amount), 0);
        salaryDueTeachers = salList.length;
      }

      const monthJobs: Promise<{ month: string; fees: number; expenses: number }>[] = [];
      for (let i = 0; i <= 5; i += 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
        monthJobs.push(
          Promise.all([
            supabase
              .from("fee_vouchers")
              .select("amount_paid, payment_date, status")
              .in("status", ["paid", "partial"])
              .gte("payment_date", start)
              .lte("payment_date", end),
            supabase.from("expenses").select("amount").gte("expense_date", start).lte("expense_date", end),
          ]).then(([{ data: vouchers }, { data: exps }]) => ({
            month: d.toLocaleString("en", { month: "short" }),
            fees: (vouchers ?? []).reduce((a, r) => a + Number((r as { amount_paid?: number }).amount_paid ?? 0), 0),
            expenses: (exps ?? []).reduce((a, r) => a + Number(r.amount), 0),
          })),
        );
      }
      const months = await Promise.all(monthJobs);
      setFeeExpenseMonths(months.reverse());

      const map = new Map<string, number>();
      (byClass ?? []).forEach((row: { classes: { name: string } | { name: string }[] | null }) => {
        const c = row.classes;
        const name = Array.isArray(c) ? c[0]?.name : c?.name;
        if (!name) return;
        map.set(name, (map.get(name) ?? 0) + 1);
      });
      setClassDist(
        map.size > 0 ? [...map.entries()].map(([name, value]) => ({ name, value })) : [{ name: "No data", value: 1 }],
      );

      const dayMap = new Map<string, { p: number; t: number }>();
      (attRows ?? []).forEach((r) => {
        const cur = dayMap.get(r.date) ?? { p: 0, t: 0 };
        cur.t += 1;
        if (r.status === "present" || r.status === "late") cur.p += 1;
        dayMap.set(r.date, cur);
      });
      const trend: { day: string; rate: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        const ds = day.toISOString().slice(0, 10);
        const agg = dayMap.get(ds);
        trend.push({
          day: day.toLocaleDateString("en", { month: "short", day: "numeric" }),
          rate: agg && agg.t ? Math.round((agg.p / agg.t) * 100) : 0,
        });
      }
      setAtt30(trend);

      const feeMap = new Map<string, { paid: number; pending: number }>();
      (fvClass ?? []).forEach((row: Record<string, unknown>) => {
        const st = row.students as { classes?: { name: string } | { name: string }[] } | null;
        const cn = classNameFromStudent(st ?? null);
        const cur = feeMap.get(cn) ?? { paid: 0, pending: 0 };
        const status = String(row.status ?? "");
        const amt = Number(row.amount ?? 0);
        const ap = Number((row.amount_paid as number | undefined) ?? 0);
        const rem = Number((row.remaining_amount as number | undefined) ?? amt);
        if (status === "paid" || status === "partial") {
          cur.paid += status === "partial" ? ap : Number(ap || amt);
        } else if (status === "unpaid" || status === "overdue") {
          cur.pending += rem;
        }
        feeMap.set(cn, cur);
      });
      const feeBars: ClassFeeRow[] = [...feeMap.entries()]
        .map(([name, v]) => {
          const t = v.paid + v.pending;
          const pct = t > 0 ? Math.round((v.paid / t) * 100) : 0;
          return { name, pct, paid: v.paid, pending: v.pending };
        })
        .filter((r) => r.paid + r.pending > 0)
        .sort((a, b) => b.paid + b.pending - (a.paid + a.pending))
        .slice(0, 8);
      setFeeByClass(feeBars);

      setSalaryDueList(salList.slice(0, 6));

      const acts: ActivityItem[] = [];
      (rs ?? []).forEach((r: { id: string; full_name: string; created_at: string }) =>
        acts.push({
          id: `s-${r.id}`,
          label: `Student added: ${r.full_name}`,
          sub: new Date(r.created_at).toLocaleString(),
          at: r.created_at,
          icon: "👤",
        }),
      );
      (rf ?? []).forEach((r: { id: string; month: string; amount: number; payment_date: string | null }) =>
        acts.push({
          id: `f-${r.id}`,
          label: `Fee paid: ${r.month}`,
          sub: r.payment_date ? new Date(r.payment_date).toLocaleString() : "",
          at: r.payment_date ?? "",
          icon: "💰",
        }),
      );
      (tsal ?? []).forEach(
        (r: { id: string; month_year: string; salary_amount: number; paid_date: string | null }) =>
          acts.push({
            id: `sal-${r.id}`,
            label: `Salary paid: ${r.month_year}`,
            sub: r.paid_date ? new Date(r.paid_date).toLocaleString() : "",
            at: r.paid_date ?? "",
            icon: "💼",
          }),
      );
      (res ?? []).forEach((r: { id: string; created_at: string }) =>
        acts.push({
          id: `res-${r.id}`,
          label: "Result entered",
          sub: new Date(r.created_at).toLocaleString(),
          at: r.created_at,
          icon: "📝",
        }),
      );
      acts.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
      setActivities(acts.slice(0, 8));

      setRecentFees(
        ((rf10 ?? []) as RecentFeeRow[]).map((row) => ({
          ...row,
          students: Array.isArray(row.students) ? row.students[0] ?? null : row.students,
        })),
      );

      setStats({
        students: studentCount ?? 0,
        studentsNewMonth: newStudents ?? 0,
        teachers: teacherCount ?? 0,
        teachersOnLeave,
        feeToday,
        feeTodayCount: paidToday?.length ?? 0,
        unpaidTotal,
        unpaidStudents,
        expensesMonth,
        salaryDue,
        salaryDueTeachers,
        studentAtt,
        teacherAtt,
        pendingFeesCount: pendingFeesCount ?? 0,
      });
    } catch (e) {
      console.error("Dashboard load failed:", e);
      toast.error(
        "Could not load dashboard data. Check Supabase connection and run migrations (e.g. partial_payment.sql).",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, monthStart, monthEnd, today, ym, now]);

  useEffect(() => {
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setChartsReady(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void load();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel("dash-refresh")
        .on("postgres_changes", { event: "*", schema: "public", table: "teacher_attendance" }, () => void load())
        .on("postgres_changes", { event: "*", schema: "public", table: "fee_vouchers" }, () => void load())
        .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => void load())
        .on("postgres_changes", { event: "*", schema: "public", table: "teacher_salaries" }, () => void load())
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            console.warn("Dashboard realtime subscription unavailable");
          }
        });
    } catch (e) {
      console.warn("Realtime subscribe skipped:", e);
    }
    return () => {
      if (ch) void supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const hour = now.getHours();
  const dateLine = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="grid animate-pulse gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-[var(--bg-surface-2)]" />
        ))}
      </div>
    );
  }

  const statCards = [
    {
      href: "/students",
      icon: GraduationCap,
      color: "border-l-blue-500 text-blue-500",
      bg: "bg-blue-500/15",
      title: "Students",
      value: String(stats.students),
      sub: `+${stats.studentsNewMonth} this month`,
    },
    {
      href: "/teachers",
      icon: Users,
      color: "border-l-violet-500 text-violet-500",
      bg: "bg-violet-500/15",
      title: "Teachers",
      value: String(stats.teachers),
      sub: `${stats.teachersOnLeave} on leave today`,
    },
    {
      href: "/fees",
      icon: Wallet,
      color: "border-l-emerald-500 text-emerald-500",
      bg: "bg-emerald-500/15",
      title: "Fee Today",
      value: formatCurrency(stats.feeToday),
      sub: `${stats.feeTodayCount} paid today`,
    },
    {
      href: "/fees/defaulters",
      icon: AlertTriangle,
      color: "border-l-amber-500 text-amber-500",
      bg: "bg-amber-500/15",
      title: "Unpaid Fees",
      value: formatCurrency(stats.unpaidTotal),
      sub: `${stats.unpaidStudents} students`,
    },
    {
      href: "/expenses",
      icon: PieChartIcon,
      color: "border-l-rose-500 text-rose-500",
      bg: "bg-rose-500/15",
      title: "Expenses",
      value: formatCurrency(stats.expensesMonth),
      sub: "This month",
    },
    {
      href: "/finance/salaries",
      icon: Briefcase,
      color: "border-l-cyan-500 text-cyan-500",
      bg: "bg-cyan-500/15",
      title: "Salary Due",
      value: formatCurrency(stats.salaryDue),
      sub: `${stats.salaryDueTeachers} teachers`,
    },
  ];

  const quickActions = [
    { href: "/students/add", label: "Add Student", icon: Plus, className: "bg-blue-600 hover:bg-blue-700 text-white" },
    { href: "/teachers/add", label: "Add Teacher", icon: Plus, className: "bg-violet-600 hover:bg-violet-700 text-white" },
    { href: "/fees/generate", label: "New Voucher", icon: FileText, className: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    { href: "/results", label: "Enter Result", icon: ClipboardList, className: "bg-amber-600 hover:bg-amber-700 text-white" },
    { href: "/attendance", label: "Attendance", icon: CalendarCheck, className: "bg-sky-600 hover:bg-sky-700 text-white" },
    { href: "/finance/salaries", label: "Pay Salary", icon: CreditCard, className: "bg-teal-600 hover:bg-teal-700 text-white" },
    { href: "/admit-cards", label: "Admit Cards", icon: Printer, className: "bg-indigo-600 hover:bg-indigo-700 text-white" },
    { href: "/history/monthly", label: "Monthly Snap", icon: Archive, className: "bg-slate-600 hover:bg-slate-700 text-white" },
  ];

  return (
    <div className="space-y-8">
      <section className="surface-card relative overflow-hidden border border-[var(--border)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[var(--accent-blue)]/10 to-transparent pointer-events-none" />
        <p className="text-2xl font-bold text-[var(--text-primary)]">
          {greeting(hour)}, Admin! <span className="inline-block">👋</span>
        </p>
        <p className="mt-1 text-[var(--text-secondary)]">{dateLine}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="rounded-lg bg-[var(--bg-surface-2)] px-3 py-1.5 font-medium text-[var(--text-primary)]">
            Student attendance today: <strong>{stats.studentAtt}%</strong>
          </span>
          <span className="rounded-lg bg-[var(--bg-surface-2)] px-3 py-1.5 font-medium text-[var(--text-primary)]">
            Teacher attendance today: <strong>{stats.teacherAtt}%</strong>
          </span>
          <span className="rounded-lg bg-[var(--bg-surface-2)] px-3 py-1.5 font-medium text-[var(--text-primary)]">
            Pending fee vouchers: <strong>{stats.pendingFeesCount}</strong>
          </span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {statCards.map((c) => (
          <Link key={c.title} href={c.href} className="group block">
            <article
              className={cn(
                "surface-card h-full border-l-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                c.color.split(" ")[0],
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{c.title}</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{c.value}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{c.sub}</p>
                </div>
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-full", c.bg, c.color.split(" ").slice(1).join(" "))}>
                  <c.icon size={22} />
                </div>
              </div>
            </article>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card min-w-0 p-4 transition-all duration-200 hover:shadow-lg lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Monthly overview</h2>
          <div className="h-72 min-w-0">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feeExpenseMonths}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [formatCurrency(Number(value ?? 0)), name === "fees" ? "Fees collected" : "Expenses"]}
                  />
                  <Legend />
                  <Bar dataKey="fees" name="Fee Collected" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full animate-pulse rounded-lg bg-[var(--bg-surface-2)]" />
            )}
          </div>
        </div>
        <div className="surface-card min-w-0 p-4 transition-all duration-200 hover:shadow-lg">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Student distribution</h2>
          <div className="h-72 min-w-0">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={classDist} dataKey="value" nameKey="name" cx="42%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2}>
                    {classDist.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full animate-pulse rounded-lg bg-[var(--bg-surface-2)]" />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card min-w-0 p-4 transition-all duration-200 hover:shadow-lg">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Attendance trend (30 days)</h2>
          <div className="h-64 min-w-0">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={att30}>
                  <defs>
                    <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
                  <XAxis dataKey="day" stroke="var(--text-muted)" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v ?? 0)}%`, "Attendance"]} />
                  <Area type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} fill="url(#attFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full animate-pulse rounded-lg bg-[var(--bg-surface-2)]" />
            )}
          </div>
        </div>
        <div className="surface-card min-w-0 p-4 transition-all duration-200 hover:shadow-lg">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Fee collection by class</h2>
          {feeByClass.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No voucher data yet.</p>
          ) : (
            <div className="h-64 min-w-0">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={feeByClass} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={88} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as ClassFeeRow;
                        return (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-xs text-[var(--text-primary)] shadow-lg">
                            <p className="font-semibold">{p.name}</p>
                            <p className="mt-1 text-[var(--text-muted)]">
                              {p.pct}% collected · {formatCurrency(p.paid)} paid · {formatCurrency(p.pending)} pending
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="pct" name="% collected" radius={[0, 4, 4, 0]} fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full animate-pulse rounded-lg bg-[var(--bg-surface-2)]" />
              )}
            </div>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a) => {
            const QIcon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                  a.className,
                )}
              >
                <QIcon size={20} />
                {a.label}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card p-4 transition-all duration-200 hover:shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">Fee defaulters</h3>
            <Link href="/fees/defaulters" className="text-xs font-medium text-[var(--accent-blue)] hover:underline">
              View all
            </Link>
          </div>
          {defLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading…</p>
          ) : defaulters.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No defaulters.</p>
          ) : (
            <ul className="space-y-2">
              {defaulters.slice(0, 5).map((d) => (
                <li key={d.student_id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm">
                  <Link href={`/students/${d.student_id}`} className="truncate font-medium text-[var(--text-primary)] hover:underline">
                    {d.full_name}
                  </Link>
                  <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                    {d.unpaid_months} mo
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-card p-4 transition-all duration-200 hover:shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">Salary due</h3>
            <Link href="/finance/salaries" className="text-xs font-medium text-[var(--accent-blue)] hover:underline">
              Open
            </Link>
          </div>
          {salaryDueList.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">All caught up for this month.</p>
          ) : (
            <ul className="space-y-2">
              {salaryDueList.map((s) => {
                const overdue = s.due_date < today;
                const teacher = Array.isArray(s.teachers) ? s.teachers[0] : s.teachers;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm">
                    <span className="truncate font-medium text-[var(--text-primary)]">{teacher?.full_name ?? "Teacher"}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {overdue ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          OVERDUE
                        </span>
                      ) : null}
                      <Link
                        href="/finance/salaries"
                        className="rounded-lg bg-[var(--accent-blue)] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[var(--accent-blue-hover)]"
                      >
                        Pay
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="surface-card p-4 transition-all duration-200 hover:shadow-lg">
          <h3 className="mb-3 font-semibold text-[var(--text-primary)]">Recent activity</h3>
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
            {activities.length === 0 ? (
              <li className="text-[var(--text-muted)]">No recent activity.</li>
            ) : (
              activities.map((a) => (
                <li key={a.id} className="flex gap-2 border-b border-[var(--border)] pb-2 last:border-0">
                  <span className="text-lg">{a.icon}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--text-primary)]">{a.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{a.sub}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <section className="surface-card overflow-hidden transition-all duration-200 hover:shadow-lg">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="font-semibold text-[var(--text-primary)]">Recent fee payments</h3>
          <Link href="/fees" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent-blue)] hover:underline">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[640px]">
            <thead className="sticky top-0 z-[1]">
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentFees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--text-muted)]">
                    No payments yet.
                  </td>
                </tr>
              ) : (
                recentFees.map((f, idx) => (
                  <tr key={f.id} className={cn(idx % 2 === 1 && "bg-[var(--bg-surface-2)]/50")}>
                    <td className="font-medium">{(Array.isArray(f.students) ? f.students[0] : f.students)?.full_name ?? "—"}</td>
                    <td>{classNameFromStudent(Array.isArray(f.students) ? f.students[0] ?? null : f.students)}</td>
                    <td>{formatCurrency(Number(f.amount_paid ?? f.amount))}</td>
                    <td>{f.payment_date ? new Date(f.payment_date).toLocaleDateString() : "—"}</td>
                    <td>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
