"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { currentSalaryMonthYear } from "@/lib/utils/salaryPeriod";
import { scheduleEffectLoad } from "@/lib/utils/scheduleEffectLoad";
import { Button } from "@/components/ui/Button";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { Input } from "@/components/ui/Input";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export type SalaryRecordRow = {
  id: string;
  teacher_id: string;
  month: string;
  year: string;
  amount: number;
  status: "paid" | "unpaid";
  payment_date: string | null;
  payment_method: string | null;
  paid_by: string | null;
  teachers:
    | {
        full_name: string | null;
        employee_code: string;
        subject: string;
        class_assigned: string | null;
        profile_photo: string | null;
      }
    | {
        full_name: string | null;
        employee_code: string;
        subject: string;
        class_assigned: string | null;
        profile_photo: string | null;
      }[]
    | null;
};

function monthYearLabel(m: string, y: string) {
  return `${m} ${y}`;
}

function formatShortDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function salaryReceiptNumber(row: SalaryRecordRow) {
  const seq = row.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `SAL-${row.year}-${row.month.slice(0, 3).toUpperCase()}-${seq}`;
}

type PayModalState = SalaryRecordRow | null;

type FilterTab = "all" | "paid" | "unpaid";

type CancelRef = { cancelled: boolean };

export function TeacherSalariesModule() {
  const supabase = useSupabaseClient();
  const [{ month: curMonth, year: curYear }, setPeriod] = useState(() => currentSalaryMonthYear());
  const [rows, setRows] = useState<SalaryRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [payRow, setPayRow] = useState<PayModalState>(null);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [receiptRow, setReceiptRow] = useState<SalaryRecordRow | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [payerName, setPayerName] = useState("Admin");

  const [payForm, setPayForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "Cash" as "Cash" | "Bank Transfer" | "Cheque",
    remarks: "",
  });

  const [bulkPayForm, setBulkPayForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "Cash" as "Cash" | "Bank Transfer" | "Cheque",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: receiptRow ? salaryReceiptNumber(receiptRow) : "salary-receipt",
  });

  const applyIfActive = (cancel: CancelRef | undefined, fn: () => void) => {
    if (cancel?.cancelled) return;
    fn();
  };

  const loadData = useCallback(
    async (cancel?: CancelRef) => {
      applyIfActive(cancel, () => setLoading(true));
      try {
        const { month, year } = currentSalaryMonthYear();
        applyIfActive(cancel, () => setPeriod({ month, year }));

        const { error: rpcErr } = await supabase.rpc("generate_monthly_salaries");
        if (rpcErr && (rpcErr as { code?: string }).code !== "PGRST202") {
          if (!cancel?.cancelled) {
            toast.error(rpcErr.message || "Could not run salary sync. Run supabase SQL (generate_monthly_salaries) in Supabase.");
          }
        }

        const { data, error } = await supabase
          .from("salary_records")
          .select(
            "id,teacher_id,month,year,amount,status,payment_date,payment_method,paid_by,teachers(full_name,employee_code,subject,class_assigned,profile_photo)",
          )
          .eq("month", month)
          .eq("year", year);

        if (error) throw error;
        const list = ((data ?? []) as SalaryRecordRow[]).map((row) => ({
          ...row,
          teachers: Array.isArray(row.teachers) ? row.teachers[0] ?? null : row.teachers,
        }));
        list.sort((a, b) => (a.teachers?.full_name ?? "").localeCompare(b.teachers?.full_name ?? "", undefined, { sensitivity: "base" }));
        applyIfActive(cancel, () => setRows(list));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Load failed";
        if (!cancel?.cancelled) {
          toast.error(msg);
        }
        applyIfActive(cancel, () => setRows([]));
      } finally {
        applyIfActive(cancel, () => setLoading(false));
      }
    },
    [supabase],
  );

  const load = useCallback(async () => {
    await loadData();
  }, [loadData]);

  useEffect(() => {
    const cancel: CancelRef = { cancelled: false };
    const cleanupSched = scheduleEffectLoad(() => {
      void loadData(cancel);
    });
    return () => {
      cancel.cancelled = true;
      cleanupSched();
    };
  }, [loadData]);

  useEffect(() => {
    const cancel: CancelRef = { cancelled: false };
    const cleanupSched = scheduleEffectLoad(() => {
      void supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user || cancel.cancelled) return;
        const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        if (cancel.cancelled) return;
        if (data?.full_name) setPayerName(data.full_name);
      });
    });
    return () => {
      cancel.cancelled = true;
      cleanupSched();
    };
  }, [supabase]);

  const filteredRows = useMemo(() => {
    if (filter === "paid") return rows.filter((r) => r.status === "paid");
    if (filter === "unpaid") return rows.filter((r) => r.status === "unpaid");
    return rows;
  }, [rows, filter]);

  const summary = useMemo(() => {
    const total = rows.reduce((a, r) => a + Number(r.amount), 0);
    const paid = rows.filter((r) => r.status === "paid").reduce((a, r) => a + Number(r.amount), 0);
    const unpaid = rows.filter((r) => r.status === "unpaid").reduce((a, r) => a + Number(r.amount), 0);
    return { total, paid, unpaid };
  }, [rows]);

  const unpaidRows = useMemo(() => rows.filter((r) => r.status === "unpaid"), [rows]);

  const confirmPayment = async () => {
    if (!payRow) return;
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const teacher = Array.isArray(payRow.teachers) ? payRow.teachers[0] : payRow.teachers;
      const teacherName = teacher?.full_name ?? "Teacher";
      const title = `Salary — ${teacherName} — ${monthYearLabel(payRow.month, payRow.year)}`;

      const { error: upErr } = await supabase
        .from("salary_records")
        .update({
          status: "paid",
          payment_date: payForm.paymentDate,
          paid_by: user.id,
          payment_method: payForm.paymentMethod,
        })
        .eq("id", payRow.id)
        .eq("status", "unpaid");

      if (upErr) throw upErr;

      const { error: exErr } = await supabase.from("expenses").insert({
        title,
        category: "Salaries",
        amount: Number(payRow.amount),
        expense_date: payForm.paymentDate,
        paid_to: teacherName,
        payment_method: payForm.paymentMethod,
        notes: payForm.remarks.trim() || "Auto-added from salary payment",
        added_by: user.id,
      });

      if (exErr) throw exErr;

      toast.success("Salary marked paid and added to expenses");
      setPayRow(null);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmBulkPayment = async () => {
    if (unpaidRows.length === 0) {
      toast.error("No unpaid salaries");
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      for (const row of unpaidRows) {
        const teacher = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
        const teacherName = teacher?.full_name ?? "Teacher";
        const title = `Salary — ${teacherName} — ${monthYearLabel(row.month, row.year)}`;

        const { error: upErr } = await supabase
          .from("salary_records")
          .update({
            status: "paid",
            payment_date: bulkPayForm.paymentDate,
            paid_by: user.id,
            payment_method: bulkPayForm.paymentMethod,
          })
          .eq("id", row.id)
          .eq("status", "unpaid");
        if (upErr) throw upErr;

        const { error: exErr } = await supabase.from("expenses").insert({
          title,
          category: "Salaries",
          amount: Number(row.amount),
          expense_date: bulkPayForm.paymentDate,
          paid_to: teacherName,
          payment_method: bulkPayForm.paymentMethod,
          notes: "Bulk mark all paid (Teacher Salaries)",
          added_by: user.id,
        });
        if (exErr) throw exErr;
      }

      toast.success(`Marked ${unpaidRows.length} salary record(s) as paid`);
      setBulkPayOpen(false);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Bulk payment failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const badge = (row: SalaryRecordRow) => {
    if (row.status === "paid") {
      return (
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          🟢 PAID
        </span>
      );
    }
    return (
      <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
        🔴 UNPAID
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[var(--text-muted)]">Current payroll period</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{monthYearLabel(curMonth, curYear)}</p>
          {!loading && rows.length === 0 && (
            <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)]">
              No payroll rows for this month yet. New teachers get an unpaid row when added; the monthly job also creates any missing rows.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "paid", "unpaid"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                filter === f ? "bg-[var(--accent-blue)] text-white" : "bg-[var(--bg-surface-2)] text-[var(--text-primary)]"
              }`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
          <Button type="button" variant="secondary" disabled={unpaidRows.length === 0 || submitting} onClick={() => setBulkPayOpen(true)}>
            Mark all as paid
          </Button>
          <Link href="/teachers" className="inline-flex items-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">
            Teachers
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Total salary this month", value: formatCurrency(summary.total) },
          { label: "Paid", value: formatCurrency(summary.paid) },
          { label: "Unpaid", value: formatCurrency(summary.unpaid) },
        ].map((c) => (
          <article
            key={c.label}
            className="surface-card border-l-4 border-l-[var(--accent-blue)] p-4 transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{c.label}</p>
            <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">{c.value}</p>
          </article>
        ))}
      </div>

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[960px]">
            <thead className="sticky top-0 z-[1]">
              <tr>
                <th>Photo</th>
                <th>Teacher</th>
                <th>Subject</th>
                <th>Class</th>
                <th>Salary</th>
                <th>Status</th>
                <th>Payment date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[var(--text-muted)]">
                    <Loader2 className="mx-auto size-8 animate-spin opacity-60" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                    No salary records for this month yet.
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                    No records for this filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const t = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
                  return (
                    <tr key={row.id}>
                      <td>
                        <ProfilePhoto src={t?.profile_photo ?? null} alt={t?.full_name ?? "Teacher"} size={40} />
                      </td>
                      <td className="font-medium">{t?.full_name ?? "—"}</td>
                      <td>{t?.subject ?? "—"}</td>
                      <td>{t?.class_assigned ?? "—"}</td>
                      <td>{formatCurrency(Number(row.amount))}</td>
                      <td>{badge(row)}</td>
                      <td>{row.payment_date ? formatShortDate(row.payment_date) : "—"}</td>
                      <td>
                        {row.status === "unpaid" ? (
                          <Button type="button" className="px-3 py-1.5 text-xs" onClick={() => setPayRow(row)}>
                            Mark as paid
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => {
                              setReceiptRow(row);
                              setReceiptOpen(true);
                            }}
                          >
                            Print
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && !submitting && setPayRow(null)}
        >
          <div
            className="surface-card max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-xl transition-all duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Record salary payment</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p>
                <span className="text-[var(--text-muted)]">Teacher</span>
                <br />
                <span className="font-medium text-[var(--text-primary)]">
                  {(Array.isArray(payRow.teachers) ? payRow.teachers[0] : payRow.teachers)?.full_name ?? "Teacher"}
                </span>
              </p>
              <p>
                <span className="text-[var(--text-muted)]">Month</span>
                <br />
                <span className="font-medium text-[var(--text-primary)]">{monthYearLabel(payRow.month, payRow.year)}</span>
              </p>
              <p>
                <span className="text-[var(--text-muted)]">Amount</span>
                <br />
                <span className="font-medium text-[var(--text-primary)]">{formatCurrency(Number(payRow.amount))}</span>
              </p>
              <Input
                label="Payment date"
                type="date"
                value={payForm.paymentDate}
                onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))}
              />
              <div className="space-y-1">
                <label className="text-sm text-[var(--text-muted)]">Payment method</label>
                <select
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-primary)]"
                  value={payForm.paymentMethod}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, paymentMethod: e.target.value as typeof payForm.paymentMethod }))
                  }
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <Input
                label="Remarks (optional)"
                value={payForm.remarks}
                onChange={(e) => setPayForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" type="button" disabled={submitting} onClick={() => setPayRow(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void confirmPayment()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Confirm payment"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {bulkPayOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && !submitting && setBulkPayOpen(false)}
        >
          <div className="surface-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Mark all unpaid as paid</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Applies to {unpaidRows.length} teacher(s) for {monthYearLabel(curMonth, curYear)}. Each payment is logged as a separate expense.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                label="Payment date"
                type="date"
                value={bulkPayForm.paymentDate}
                onChange={(e) => setBulkPayForm((f) => ({ ...f, paymentDate: e.target.value }))}
              />
              <div className="space-y-1">
                <label className="text-sm text-[var(--text-muted)]">Payment method</label>
                <select
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-primary)]"
                  value={bulkPayForm.paymentMethod}
                  onChange={(e) =>
                    setBulkPayForm((f) => ({ ...f, paymentMethod: e.target.value as typeof bulkPayForm.paymentMethod }))
                  }
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" type="button" disabled={submitting} onClick={() => setBulkPayOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void confirmBulkPayment()}>
                {submitting ? "Saving…" : "Confirm all"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {receiptOpen && receiptRow?.teachers && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setReceiptOpen(false)}
        >
          <div
            className="surface-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Salary receipt</h2>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setReceiptOpen(false)}>
                  Close
                </Button>
                <Button type="button" onClick={() => void handlePrint()}>
                  Print
                </Button>
              </div>
            </div>
            <div
              ref={printRef}
              className="print-salary-receipt rounded-lg border border-[var(--border)] bg-white p-6 text-black dark:bg-white"
            >
              <SalaryReceiptBody row={receiptRow} payerName={payerName} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SalaryReceiptBody({ row, payerName }: { row: SalaryRecordRow; payerName: string }) {
  const t = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
  if (!t) return null;
  return (
    <div className="font-serif text-sm">
      <h1 className="text-center text-lg font-bold uppercase">New Oxford Grammer School</h1>
      <p className="text-center text-xs uppercase tracking-widest">Salary payment receipt</p>
      <hr className="my-4 border-black" />
      <p>
        <strong>Receipt No:</strong> {salaryReceiptNumber(row)}
      </p>
      <p>
        <strong>Date:</strong>{" "}
        {row.payment_date
          ? new Date(`${row.payment_date}T12:00:00`).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—"}
      </p>
      <hr className="my-4 border-black" />
      <p>
        <strong>Teacher Name:</strong> {t.full_name}
      </p>
      <p>
        <strong>Employee Code:</strong> {t.employee_code}
      </p>
      <p>
        <strong>Subject:</strong> {t.subject}
      </p>
      <p>
        <strong>Month:</strong> {monthYearLabel(row.month, row.year)}
      </p>
      <hr className="my-4 border-black" />
      <p>
        <strong>Salary Amount:</strong> {formatCurrency(Number(row.amount))}
      </p>
      <p>
        <strong>Payment Method:</strong> {row.payment_method ?? "—"}
      </p>
      <p>
        <strong>Paid By:</strong> {payerName}
      </p>
      <hr className="my-4 border-black" />
      <p>Received By: ____________________</p>
      <p>Signature: ____________________</p>
      <p>Date: ____________________</p>
    </div>
  );
}
