"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
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
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { scheduleEffectLoad } from "@/lib/utils/scheduleEffectLoad";

const CATEGORIES = [
  "Salaries",
  "Utilities",
  "Maintenance",
  "Stationery",
  "Events",
  "Equipment",
  "Other",
] as const;

const PAY_METHODS = ["Cash", "Bank Transfer", "Cheque"] as const;

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

type ExpenseRow = {
  id: string;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  paid_to: string | null;
  payment_method: string | null;
  receipt_number: string | null;
  notes: string | null;
};

export function ExpensesModule() {
  const supabase = useSupabaseClient();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Other");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidTo, setPaidTo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [summary, setSummary] = useState({
    monthTotal: 0,
    yearTotal: 0,
    topCategory: "—",
    topCategoryAmt: 0,
    feesMonth: 0,
    netMonth: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: ex } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    setExpenses((ex ?? []) as ExpenseRow[]);

    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    const monthStart = `${cy}-${String(cm).padStart(2, "0")}-01`;
    const monthEnd = new Date(cy, cm, 0).toISOString().slice(0, 10);
    const yearStart = `${cy}-01-01`;
    const yearEnd = `${cy}-12-31`;

    const { data: monthRows } = await supabase
      .from("expenses")
      .select("amount,category")
      .gte("expense_date", monthStart)
      .lte("expense_date", monthEnd);
    const { data: yearRows } = await supabase
      .from("expenses")
      .select("amount,category")
      .gte("expense_date", yearStart)
      .lte("expense_date", yearEnd);

    const monthTotal = (monthRows ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const yearTotal = (yearRows ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const catMap = new Map<string, number>();
    (monthRows ?? []).forEach((r) => {
      catMap.set(r.category, (catMap.get(r.category) ?? 0) + Number(r.amount));
    });
    let topCategory = "—";
    let topCategoryAmt = 0;
    catMap.forEach((amt, k) => {
      if (amt > topCategoryAmt) {
        topCategoryAmt = amt;
        topCategory = k;
      }
    });

    const { data: paidV } = await supabase
      .from("fee_vouchers")
      .select("amount_paid")
      .in("status", ["paid", "partial"])
      .gte("payment_date", monthStart)
      .lte("payment_date", monthEnd);
    const feesMonth = (paidV ?? []).reduce((a, r) => a + Number((r as { amount_paid?: number }).amount_paid ?? 0), 0);

    setSummary({
      monthTotal,
      yearTotal,
      topCategory,
      topCategoryAmt,
      feesMonth,
      netMonth: feesMonth - monthTotal,
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    return scheduleEffectLoad(() => {
      void load();
    });
  }, [load]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (filterCat && e.category !== filterCat) return false;
      const d = e.expense_date.slice(0, 7);
      const want = `${filterYear}-${filterMonth.padStart(2, "0")}`;
      if (d !== want) return false;
      return true;
    });
  }, [expenses, filterCat, filterMonth, filterYear]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount)));
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const [barData, setBarData] = useState<{ label: string; fees: number; expenses: number }[]>([]);

  useEffect(() => {
    const y = Number(filterYear);
    const m = Number(filterMonth);
    const run = async () => {
      const out: { label: string; fees: number; expenses: number }[] = [];
      for (let i = -5; i <= 0; i += 1) {
        const dt = new Date(y, m - 1 + i, 1);
        const start = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`;
        const end = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).toISOString().slice(0, 10);
        const { data: paid } = await supabase
          .from("fee_vouchers")
          .select("amount_paid")
          .in("status", ["paid", "partial"])
          .gte("payment_date", start)
          .lte("payment_date", end);
        const { data: ex } = await supabase
          .from("expenses")
          .select("amount")
          .gte("expense_date", start)
          .lte("expense_date", end);
        const fees = (paid ?? []).reduce((a, r) => a + Number((r as { amount_paid?: number }).amount_paid ?? 0), 0);
        const exp = (ex ?? []).reduce((a, r) => a + Number(r.amount), 0);
        out.push({
          label: dt.toLocaleString("en", { month: "short", year: "2-digit" }),
          fees,
          expenses: exp,
        });
      }
      setBarData(out);
    };
    void run();
  }, [filterMonth, filterYear, supabase]);

  const submit = async () => {
    const n = parseFloat(amount);
    if (!title.trim() || Number.isNaN(n) || n <= 0) {
      toast.error("Title and valid amount required");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const { error } = await supabase.from("expenses").insert({
      title: title.trim(),
      category,
      amount: n,
      expense_date: expenseDate,
      paid_to: paidTo.trim() || null,
      payment_method: paymentMethod,
      receipt_number: receiptNumber.trim() || null,
      notes: notes.trim() || null,
      added_by: uid,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense recorded");
    setTitle("");
    setAmount("");
    setNotes("");
    setReceiptNumber("");
    void load();
  };

  const del = async (id: string) => {
    setDeleting(true);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    void load();
    setDeleteId(null);
  };

  const exportCsv = () => {
    const header = ["Date", "Title", "Category", "Amount", "Paid To", "Method", "Receipt", "Notes"];
    const lines = [header.join(",")].concat(
      filtered.map((e) =>
        [
          e.expense_date,
          `"${e.title.replace(/"/g, '""')}"`,
          e.category,
          e.amount,
          e.paid_to ?? "",
          e.payment_method ?? "",
          e.receipt_number ?? "",
          `"${(e.notes ?? "").replace(/"/g, '""')}"`,
        ].join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `expenses-${filterYear}-${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading && expenses.length === 0) {
    return <p className="text-slate-400">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Total expenses (this month)</p>
          <p className="mt-2 text-xl font-semibold">{formatCurrency(summary.monthTotal)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Total expenses (this year)</p>
          <p className="mt-2 text-xl font-semibold">{formatCurrency(summary.yearTotal)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Biggest category (month)</p>
          <p className="mt-2 text-lg font-semibold">{summary.topCategory}</p>
          <p className="text-sm text-slate-500">{formatCurrency(summary.topCategoryAmt)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Net balance (fees − expenses, month)</p>
          <p className="mt-2 text-xl font-semibold text-emerald-300">{formatCurrency(summary.netMonth)}</p>
          <p className="text-xs text-slate-500">Fees collected: {formatCurrency(summary.feesMonth)}</p>
        </article>
      </div>

      <div className="surface-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Add expense</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-xs text-slate-400">Title</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Category</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Amount</label>
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Paid to</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Payment method</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAY_METHODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Receipt #</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-400">Notes</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-4" type="button" disabled={saving} onClick={() => void submit()}>
          {saving ? "Saving…" : "Save expense"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-slate-400">Month</label>
          <select
            className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400">Year</label>
          <input
            className="mt-1 w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Category</label>
          <select
            className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="secondary" onClick={() => void exportCsv()}>
          Export CSV
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-4">
          <h3 className="mb-3 font-semibold">Category split (filtered month)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="surface-card p-4">
          <h3 className="mb-3 font-semibold">Fees vs expenses (6 months)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
                  formatter={(v) => formatCurrency(Number(v ?? 0))}
                />
                <Legend />
                <Bar dataKey="fees" fill="#10b981" name="Fee income" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="surface-card overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-800/80 text-left text-slate-400">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Title</th>
              <th className="p-3">Category</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Paid to</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={6}>
                  No expenses for this filter.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-t border-slate-700">
                  <td className="p-3">{e.expense_date}</td>
                  <td className="p-3">{e.title}</td>
                  <td className="p-3">{e.category}</td>
                  <td className="p-3">{formatCurrency(Number(e.amount))}</td>
                  <td className="p-3">{e.paid_to ?? "—"}</td>
                  <td className="p-3">
                    <Button type="button" variant="danger" onClick={() => setDeleteId(e.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Modal
        open={Boolean(deleteId)}
        title="Delete expense?"
        onClose={() => setDeleteId(null)}
        onConfirm={() => (deleteId ? void del(deleteId) : undefined)}
        confirmLabel="Delete"
        loading={deleting}
      >
        <p className="text-slate-300">This expense entry will be removed permanently.</p>
      </Modal>
    </div>
  );
}
