"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Button } from "@/components/ui/Button";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { Input } from "@/components/ui/Input";
import { Loader2 } from "lucide-react";

export type TeacherSalaryRow = {
  id: string;
  teacher_id: string;
  month_year: string;
  salary_amount: number;
  status: "paid" | "unpaid";
  due_date: string;
  paid_date: string | null;
  paid_by: string | null;
  payment_method: "Cash" | "Bank Transfer" | "Cheque" | null;
  remarks: string | null;
  teachers:
    | {
        full_name: string | null;
        employee_code: string;
        subject: string;
        qualification: string | null;
        profile_photo: string | null;
      }
    | {
        full_name: string | null;
        employee_code: string;
        subject: string;
        qualification: string | null;
        profile_photo: string | null;
      }[]
    | null;
};

function monthYearLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
}

function formatShortDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function monthOptions(count = 18) {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: monthYearLabel(value) });
  }
  return out;
}

function receiptNumber(row: TeacherSalaryRow) {
  const seq = row.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `SAL-${row.month_year.replace("-", "")}-${seq}`;
}

type PayModalState = TeacherSalaryRow | null;

export function TeacherSalariesModule() {
  const supabase = useSupabaseClient();
  const [monthYear, setMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [rows, setRows] = useState<TeacherSalaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payRow, setPayRow] = useState<PayModalState>(null);
  const [receiptRow, setReceiptRow] = useState<TeacherSalaryRow | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [payerName, setPayerName] = useState("Admin");

  const [payForm, setPayForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "Cash" as "Cash" | "Bank Transfer" | "Cheque",
    remarks: "",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: receiptRow ? receiptNumber(receiptRow) : "salary-receipt",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { error: genErr } = await supabase.rpc("generate_monthly_salaries", { p_month_year: monthYear });
      if (genErr) {
        // Fallback: if SQL function is not deployed yet, generate current month records client-side.
        if ((genErr as { code?: string }).code === "PGRST202") {
          const { data: teachers, error: tErr } = await supabase
            .from("teachers")
            .select("id,salary,status")
            .eq("status", "active");
          if (!tErr && teachers?.length) {
            const dueDate = `${monthYear}-11`;
            const seedRows = teachers.map((t) => ({
              teacher_id: t.id,
              month_year: monthYear,
              salary_amount: Number(t.salary ?? 0),
              status: "unpaid" as const,
              due_date: dueDate,
            }));
            await supabase.from("teacher_salaries").upsert(seedRows, { onConflict: "teacher_id,month_year" });
          }
        } else {
          toast.error(genErr.message || "Could not sync salary records. Run teacher_salaries.sql in Supabase.");
        }
      }

      const { data, error } = await supabase
        .from("teacher_salaries")
        .select(
          "id,teacher_id,month_year,salary_amount,status,due_date,paid_date,paid_by,payment_method,remarks,teachers(full_name,employee_code,subject,qualification,profile_photo)",
        )
        .eq("month_year", monthYear);

      if (error) throw error;
      const list = ((data ?? []) as TeacherSalaryRow[])
        .map((row) => ({ ...row, teachers: Array.isArray(row.teachers) ? row.teachers[0] ?? null : row.teachers }))
        .sort((a, b) =>
        (a.teachers?.full_name ?? "").localeCompare(b.teachers?.full_name ?? "", undefined, { sensitivity: "base" }),
        );
      setRows(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Load failed";
      toast.error(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, monthYear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async loader updates remote data state
    void load();
  }, [load]);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (data?.full_name) setPayerName(data.full_name);
    });
  }, [supabase]);

  const summary = useMemo(() => {
    const total = rows.reduce((a, r) => a + Number(r.salary_amount), 0);
    const paid = rows.filter((r) => r.status === "paid").reduce((a, r) => a + Number(r.salary_amount), 0);
    const unpaid = rows.filter((r) => r.status === "unpaid").reduce((a, r) => a + Number(r.salary_amount), 0);
    const nextDue = rows.find((r) => r.status === "unpaid");
    const dueLabel = nextDue?.due_date ? formatShortDate(nextDue.due_date) : "—";
    return { total, paid, unpaid, dueLabel };
  }, [rows]);

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
      const title = `Salary — ${teacherName} — ${monthYearLabel(payRow.month_year)}`;

      const { error: upErr } = await supabase
        .from("teacher_salaries")
        .update({
          status: "paid",
          paid_date: payForm.paymentDate,
          paid_by: user.id,
          payment_method: payForm.paymentMethod,
          remarks: payForm.remarks.trim() || null,
        })
        .eq("id", payRow.id)
        .eq("status", "unpaid");

      if (upErr) throw upErr;

      const { error: exErr } = await supabase.from("expenses").insert({
        title,
        category: "Salaries",
        amount: Number(payRow.salary_amount),
        expense_date: payForm.paymentDate,
        paid_to: teacherName,
        payment_method: payForm.paymentMethod,
        notes: "Auto-added from salary payment",
        added_by: user.id,
      });

      if (exErr) throw exErr;

      toast.success("Salary paid and added to expenses");
      setPayRow(null);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const badge = (row: TeacherSalaryRow) => {
    if (row.status === "paid") {
      return <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">PAID</span>;
    }
    const overdue = row.due_date < todayStr;
    if (overdue) {
      return <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">OVERDUE</span>;
    }
    return <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">UNPAID</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <label className="label-text block">Month</label>
          <select
            className="mt-1 w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)]"
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
          >
            {monthOptions().map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Salary This Month", value: formatCurrency(summary.total) },
          { label: "Paid This Month", value: formatCurrency(summary.paid) },
          { label: "Unpaid This Month", value: formatCurrency(summary.unpaid) },
          { label: "Next Due Date", value: summary.dueLabel },
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
                <th>Name</th>
                <th>Designation</th>
                <th>Subject</th>
                <th>Salary</th>
                <th>Month</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[var(--text-muted)]">
                    <Loader2 className="mx-auto size-8 animate-spin opacity-60" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--text-muted)]">
                    No salary records for this month. Add active teachers, then refresh.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const t = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
                  return (
                    <tr key={row.id}>
                      <td>
                        <ProfilePhoto src={t?.profile_photo ?? null} alt={t?.full_name ?? "Teacher"} size={40} />
                      </td>
                      <td className="font-medium">{t?.full_name ?? "—"}</td>
                      <td>{t?.qualification?.trim() || "—"}</td>
                      <td>{t?.subject ?? "—"}</td>
                      <td>{formatCurrency(Number(row.salary_amount))}</td>
                      <td>{monthYearLabel(row.month_year)}</td>
                      <td>{badge(row)}</td>
                      <td>{formatShortDate(row.due_date)}</td>
                      <td>
                        {row.status === "unpaid" ? (
                          <Button type="button" className="px-3 py-1.5 text-xs" onClick={() => setPayRow(row)}>
                            Mark as Paid
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
                            View Receipt
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

      {/* Mark as paid modal */}
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
                <span className="font-medium text-[var(--text-primary)]">{monthYearLabel(payRow.month_year)}</span>
              </p>
              <p>
                <span className="text-[var(--text-muted)]">Amount</span>
                <br />
                <span className="font-medium text-[var(--text-primary)]">{formatCurrency(Number(payRow.salary_amount))}</span>
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
                  "Confirm Payment"
                )}
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
            <div ref={printRef} className="print-salary-receipt rounded-lg border border-[var(--border)] bg-white p-6 text-black dark:bg-white">
              <SalaryReceiptBody row={receiptRow} payerName={payerName} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SalaryReceiptBody({ row, payerName }: { row: TeacherSalaryRow; payerName: string }) {
  const t = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
  if (!t) return null;
  return (
    <div className="font-serif text-sm">
      <h1 className="text-center text-lg font-bold uppercase">New Oxford Grammer School</h1>
      <p className="text-center text-xs uppercase tracking-widest">Salary payment receipt</p>
      <hr className="my-4 border-black" />
      <p>
        <strong>Receipt No:</strong> {receiptNumber(row)}
      </p>
      <p>
        <strong>Date:</strong>{" "}
        {row.paid_date
          ? new Date(row.paid_date + "T12:00:00").toLocaleDateString("en-GB", {
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
        <strong>Month:</strong> {monthYearLabel(row.month_year)}
      </p>
      <hr className="my-4 border-black" />
      <p>
        <strong>Salary Amount:</strong> {formatCurrency(Number(row.salary_amount))}
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
