"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMonthlyHistory } from "@/lib/hooks/useMonthlyHistory";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Button } from "@/components/ui/Button";

export default function MonthlyHistoryPage() {
  const [tab, setTab] = useState<"summary" | "fees" | "expenses" | "attendance" | "results">("summary");
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7));
  const { feeRows, expenseRows, attendanceRows, resultRows, snapshots, saveCurrentSnapshot, deleteSnapshot } = useMonthlyHistory(monthYear);
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => {
    const rows = (feeRows ?? []) as { amount: number; status: string }[];
    const collected = rows.filter((r) => r.status === "paid").reduce((a, r) => a + Number(r.amount), 0);
    const pending = rows.filter((r) => r.status !== "paid").reduce((a, r) => a + Number(r.amount), 0);
    const expenses = (expenseRows as { amount: number }[]).reduce((a, r) => a + Number(r.amount), 0);
    const avgAttendance = ((attendanceRows as { attendance_percentage: number }[]).reduce((a, r) => a + Number(r.attendance_percentage), 0) /
      Math.max(1, attendanceRows.length));
    return { collected, pending, expenses, net: collected - expenses, avgAttendance };
  }, [feeRows, expenseRows, attendanceRows]);

  const onSaveSnapshot = async () => {
    setSaving(true);
    const { error } = await saveCurrentSnapshot();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Monthly snapshot saved");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Monthly history</h1>
      <div className="flex items-center gap-3">
        <InputMonthLabel value={monthYear} onChange={setMonthYear} />
        <Button type="button" onClick={() => void onSaveSnapshot()} disabled={saving}>
          {saving ? "Saving..." : "Save This Month's Snapshot"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["summary", "fees", "expenses", "attendance", "results"] as const).map((t) => (
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

      {tab === "summary" && (
        <div className="grid gap-4 md:grid-cols-2">
          <article className="surface-card p-4"><p>Students</p><p className="text-lg">{snapshots[0]?.total_students ?? "—"}</p></article>
          <article className="surface-card p-4"><p>Fee Collected</p><p className="text-lg text-emerald-300">{formatCurrency(summary.collected)}</p></article>
          <article className="surface-card p-4"><p>Fee Pending</p><p className="text-lg text-amber-300">{formatCurrency(summary.pending)}</p></article>
          <article className="surface-card p-4"><p>Expenses</p><p className="text-lg text-rose-300">{formatCurrency(summary.expenses)}</p></article>
          <article className="surface-card p-4"><p>Net Balance</p><p className="text-lg">{formatCurrency(summary.net)}</p></article>
          <article className="surface-card p-4"><p>Avg Attendance</p><p className="text-lg">{summary.avgAttendance.toFixed(1)}%</p></article>
        </div>
      )}

      {tab === "fees" && (
        <div className="surface-card overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead><tr><th className="p-2 text-left">Voucher</th><th className="p-2">Month</th><th className="p-2">Amount</th><th className="p-2">Status</th></tr></thead>
            <tbody>{(feeRows as { id: string; voucher_number: string; month: string; amount: number; status: string }[]).map((r) => (
              <tr key={r.id} className="border-t border-slate-700"><td className="p-2">{r.voucher_number}</td><td className="p-2">{r.month}</td><td className="p-2">{formatCurrency(r.amount)}</td><td className="p-2">{r.status}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === "expenses" && (
        <div className="surface-card space-y-3 p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th className="p-2 text-left">Date</th><th className="p-2">Title</th><th className="p-2">Category</th><th className="p-2">Amount</th><th className="p-2">Paid To</th><th className="p-2">Method</th></tr></thead>
              <tbody>{(expenseRows as { id: string; expense_date: string; title: string; category: string; amount: number; paid_to: string; payment_method: string }[]).map((r) => (
                <tr key={r.id} className="border-t border-slate-700"><td className="p-2">{r.expense_date}</td><td className="p-2">{r.title}</td><td className="p-2">{r.category}</td><td className="p-2">{formatCurrency(r.amount)}</td><td className="p-2">{r.paid_to ?? "—"}</td><td className="p-2">{r.payment_method ?? "—"}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p>Total Expenses: <span className="font-semibold">{formatCurrency(summary.expenses)}</span></p>
          <p>Net Balance: <span className="font-semibold">{formatCurrency(summary.net)}</span></p>
        </div>
      )}

      {tab === "attendance" && (
        <div className="surface-card overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Student</th>
                <th className="p-2">Roll</th>
                <th className="p-2">Class</th>
                <th className="p-2">Attendance %</th>
                <th className="p-2">Present</th>
                <th className="p-2">Absent</th>
                <th className="p-2">Late</th>
              </tr>
            </thead>
            <tbody>
              {(attendanceRows as {
                student_id: string;
                full_name: string;
                roll_number: string;
                class_name: string;
                attendance_percentage: number;
                present_count: number;
                absent_count: number;
                late_count: number;
              }[]).map((r) => (
                <tr key={r.student_id} className="border-t border-slate-700">
                  <td className="p-2">{r.full_name}</td>
                  <td className="p-2">{r.roll_number}</td>
                  <td className="p-2">{r.class_name}</td>
                  <td className="p-2">{r.attendance_percentage}%</td>
                  <td className="p-2">{r.present_count}</td>
                  <td className="p-2">{r.absent_count}</td>
                  <td className="p-2">{r.late_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "results" && (
        <div className="surface-card overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Created</th>
                <th className="p-2">Student</th>
                <th className="p-2">Class</th>
                <th className="p-2">Exam</th>
                <th className="p-2">Year</th>
                <th className="p-2">Marks</th>
              </tr>
            </thead>
            <tbody>
              {(resultRows as {
                id: string;
                created_at: string;
                student_id: string;
                class_id: string;
                exam_type: string;
                exam_year: string;
                marks_obtained: number;
              }[]).map((r) => (
                <tr key={r.id} className="border-t border-slate-700">
                  <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2 font-mono text-xs">{r.student_id}</td>
                  <td className="p-2 font-mono text-xs">{r.class_id}</td>
                  <td className="p-2">{r.exam_type}</td>
                  <td className="p-2">{r.exam_year}</td>
                  <td className="p-2">{r.marks_obtained}</td>
                </tr>
              ))}
              {resultRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-3 text-slate-500">No result rows in this month.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Saved Snapshots</h2>
        {snapshots.map((snapshot) => (
          <div key={snapshot.id} className="surface-card flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">{snapshot.month_year}</p>
              <p className="text-sm text-slate-400">
                Students {snapshot.total_students} · Collected {formatCurrency(snapshot.fees_collected)} · Pending {formatCurrency(snapshot.fees_pending)} · Expenses {formatCurrency(snapshot.total_expenses)}
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => void deleteSnapshot(snapshot.id)}>Delete Snapshot</Button>
          </div>
        ))}
        {snapshots.length === 0 && <p className="text-slate-500">No snapshots saved yet.</p>}
      </div>
    </div>
  );
}

function InputMonthLabel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm text-slate-400">Month (YYYY-MM)</label>
      <input
        type="month"
        className="mt-1 w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
