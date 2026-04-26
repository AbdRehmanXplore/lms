"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useYearlyArchive } from "@/lib/hooks/useYearlyArchive";
import { formatCurrency } from "@/lib/utils/formatCurrency";

export default function YearlyHistoryPage() {
  const [chartsReady, setChartsReady] = useState(false);
  const [tab, setTab] = useState<"overview" | "fees" | "attendance" | "results">("overview");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { results, expenses, snapshots, feeVouchers, students, attendanceMonthly } = useYearlyArchive(year);
  const monthNames = useMemo(
    () => ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    [],
  );
  const totals = useMemo(() => {
    const feeCollected = (snapshots as { fees_collected: number }[]).reduce((sum, s) => sum + Number(s.fees_collected), 0);
    const totalExpenses = (expenses as { amount: number }[]).reduce((sum, e) => sum + Number(e.amount), 0);
    return { feeCollected, totalExpenses, net: feeCollected - totalExpenses };
  }, [snapshots, expenses]);

  const chartData = useMemo(
    () =>
      (snapshots as { month_year: string; fees_collected: number; total_expenses: number }[]).map((s) => ({
        month: s.month_year,
        fees: Number(s.fees_collected),
        expenses: Number(s.total_expenses),
      })),
    [snapshots],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only chart render gate
    setChartsReady(true);
  }, []);

  const feeGrid = useMemo(() => {
    const byStudentMonth = new Map<string, string>();
    (feeVouchers as { student_id: string; month: string; status: string }[]).forEach((v) => {
      byStudentMonth.set(`${v.student_id}::${v.month}`, v.status);
    });

    return (students as { id: string; full_name: string; roll_number: string; student_uid: string | null }[]).map((s) => ({
      ...s,
      months: monthNames.map((m) => {
        const key = `${s.id}::${m} ${year}`;
        const status = byStudentMonth.get(key);
        return status === "paid" ? "paid" : status ? "unpaid" : "none";
      }),
    }));
  }, [students, feeVouchers, monthNames, year]);

  const annualAttendance = useMemo(() => {
    const map = new Map<
      string,
      { student_id: string; full_name: string; roll_number: string; class_name: string; sum: number; n: number }
    >();
    (attendanceMonthly as {
      student_id: string;
      full_name: string;
      roll_number: string;
      class_name: string;
      attendance_percentage: number;
    }[]).forEach((r) => {
      const cur = map.get(r.student_id) ?? {
        student_id: r.student_id,
        full_name: r.full_name,
        roll_number: r.roll_number,
        class_name: r.class_name,
        sum: 0,
        n: 0,
      };
      cur.sum += Number(r.attendance_percentage);
      cur.n += 1;
      map.set(r.student_id, cur);
    });
    return [...map.values()]
      .map((r) => ({ ...r, annual: r.n ? r.sum / r.n : 0 }))
      .sort((a, b) => b.annual - a.annual);
  }, [attendanceMonthly]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Yearly archive</h1>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs text-slate-400">Year</label>
          <input
            type="number"
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        {(["overview", "fees", "attendance", "results"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded-lg px-4 py-2 text-sm capitalize ${
              tab === t ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <article className="surface-card p-4"><p>Total Fee Collected</p><p className="text-xl font-semibold text-emerald-300">{formatCurrency(totals.feeCollected)}</p></article>
            <article className="surface-card p-4"><p>Total Expenses</p><p className="text-xl font-semibold text-rose-300">{formatCurrency(totals.totalExpenses)}</p></article>
            <article className="surface-card p-4"><p>Net Profit/Loss</p><p className="text-xl font-semibold">{formatCurrency(totals.net)}</p></article>
          </div>
          <div className="surface-card h-80 min-w-0 p-4">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="fees" fill="#10b981" name="Fees" />
                  <Bar dataKey="expenses" fill="#f43f5e" name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full animate-pulse rounded-lg bg-[var(--bg-surface-2)]" />
            )}
          </div>
        </div>
      )}
      {tab === "fees" && (
        <div className="surface-card overflow-x-auto p-4">
          <p className="mb-3 text-sm text-slate-400">12-month fee grid (green = paid, red = unpaid)</p>
          <table className="w-full min-w-[1300px] text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Student ID</th>
                <th className="p-2">Roll</th>
                <th className="p-2">Name</th>
                {monthNames.map((m) => (
                  <th key={m} className="p-2">{m.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feeGrid.map((s) => (
                <tr key={s.id} className="border-t border-slate-700">
                  <td className="p-2 font-mono text-xs text-blue-200">{s.student_uid ?? "—"}</td>
                  <td className="p-2">{s.roll_number}</td>
                  <td className="p-2">{s.full_name}</td>
                  {s.months.map((st, i) => (
                    <td key={`${s.id}-${i}`} className="p-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs ${
                          st === "paid"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : st === "unpaid"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {st === "paid" ? "P" : st === "unpaid" ? "U" : "-"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "attendance" && (
        <div className="surface-card overflow-x-auto p-4">
          <p className="mb-3 text-sm text-slate-400">Annual attendance % per student</p>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Roll</th>
                <th className="p-2">Name</th>
                <th className="p-2">Class</th>
                <th className="p-2">Annual Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {annualAttendance.map((r) => (
                <tr key={r.student_id} className="border-t border-slate-700">
                  <td className="p-2">{r.roll_number}</td>
                  <td className="p-2">{r.full_name}</td>
                  <td className="p-2">{r.class_name}</td>
                  <td className="p-2">{r.annual.toFixed(1)}%</td>
                </tr>
              ))}
              {annualAttendance.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-3 text-slate-500">No attendance data for this year.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tab === "results" && (
        <p className="text-slate-400">Result rows for year {year}: {results.length} record(s) in database (exam_year = {year}).</p>
      )}
    </div>
  );
}
