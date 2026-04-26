"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type SalaryVoucher = {
  id: string;
  voucher_number: string;
  amount: number;
  month: string;
  status: string;
  payment_date: string | null;
  payment_method: string | null;
  received_by: string | null;
  due_date: string;
  teacher_id: string;
  teachers: {
    employee_code: string;
    full_name: string | null;
    subject: string;
  } | null;
};

export function SalariesOverview() {
  const supabase = useSupabaseClient();
  const [tab, setTab] = useState<"unpaid" | "paid">("unpaid");
  const [rows, setRows] = useState<SalaryVoucher[]>([]);
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState({ paid: 0, pending: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<SalaryVoucher | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [receivedBy, setReceivedBy] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);

  const refresh = async () => {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("salary_vouchers").update({ status: "overdue" }).eq("status", "unpaid").lt("due_date", today);

    const { data: all } = await supabase
      .from("salary_vouchers")
      .select(
        "id,voucher_number,amount,month,status,payment_date,payment_method,received_by,due_date,teacher_id,teachers(employee_code,full_name,subject)",
      )
      .order("due_date", { ascending: true });

    const list = ((all ?? []) as Record<string, unknown>[]).map((row) => {
      const teacher = row.teachers as Record<string, unknown> | null;
      return {
        ...row,
        teachers: teacher
          ? {
              employee_code: teacher.employee_code as string,
              full_name: (teacher.full_name as string | null) ?? null,
              subject: teacher.subject as string,
            }
          : null,
      } as SalaryVoucher;
    });
    setRows(list);

    const paid = list.filter((v) => v.status.toLowerCase() === "paid").reduce((a, v) => a + Number(v.amount), 0);
    const pending = list.filter((v) => v.status.toLowerCase() === "unpaid").reduce((a, v) => a + Number(v.amount), 0);
    const overdue = list.filter((v) => v.status.toLowerCase() === "overdue").reduce((a, v) => a + Number(v.amount), 0);
    setSummary({ paid, pending, overdue });
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial salary list load
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((v) => {
      const paid = v.status.toLowerCase() === "paid";
      if (tab === "paid" && !paid) return false;
      if (tab === "unpaid" && paid) return false;
      const teacher = v.teachers;
      const name = teacher?.full_name?.toLowerCase() ?? "";
      const code = teacher?.employee_code?.toLowerCase() ?? "";
      const subject = teacher?.subject?.toLowerCase() ?? "";
      return !q || name.includes(q) || code.includes(q) || subject.includes(q);
    });
  }, [rows, tab, search]);

  const openPaidModal = (voucher: SalaryVoucher) => {
    setSelectedVoucher(voucher);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("Cash");
    setReceivedBy("");
  };

  const confirmPaid = async () => {
    if (!selectedVoucher) return;
    setMarkingPaid(true);
    const { error } = await supabase
      .from("salary_vouchers")
      .update({
        status: "paid",
        payment_date: paymentDate,
        payment_method: paymentMethod,
        received_by: receivedBy || null,
      })
      .eq("id", selectedVoucher.id);
    setMarkingPaid(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Salary marked as paid");
    setSelectedVoucher(null);
    void refresh();
  };

  if (loading) {
    return <p className="text-slate-400">Loading salaries…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Total paid</p>
          <p className="mt-2 text-xl font-semibold text-emerald-400">{formatCurrency(summary.paid)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Pending</p>
          <p className="mt-2 text-xl font-semibold text-amber-400">{formatCurrency(summary.pending)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Overdue</p>
          <p className="mt-2 text-xl font-semibold text-red-400">{formatCurrency(summary.overdue)}</p>
        </article>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={tab === "unpaid" ? "primary" : "secondary"} onClick={() => setTab("unpaid")}>
          Unpaid
        </Button>
        <Button type="button" variant={tab === "paid" ? "primary" : "secondary"} onClick={() => setTab("paid")}>
          Paid
        </Button>
        <Link href="/salaries/generate" className="ml-auto">
          <Button type="button">Generate Monthly Salaries</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <Input placeholder="Search teacher name / employee code / subject" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-800/80 text-slate-300">
            <tr>
              <th className="p-3">Voucher</th>
              <th className="p-3">Employee Code</th>
              <th className="p-3">Teacher</th>
              <th className="p-3">Subject</th>
              <th className="p-3">Month</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Due</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const teacher = v.teachers;
              const unpaid = v.status.toLowerCase() !== "paid";
              return (
                <tr
                  key={v.id}
                  className={
                    unpaid ? (v.status === "overdue" ? "bg-red-950/30" : "bg-amber-950/20") : undefined
                  }
                >
                  <td className="p-3">{v.voucher_number}</td>
                  <td className="p-3 font-mono text-xs font-semibold text-blue-200">{teacher?.employee_code ?? "—"}</td>
                  <td className="p-3">{teacher?.full_name ?? "—"}</td>
                  <td className="p-3">{teacher?.subject ?? "—"}</td>
                  <td className="p-3">{v.month}</td>
                  <td className="p-3">{formatCurrency(Number(v.amount))}</td>
                  <td className="p-3 capitalize">
                    <span className={v.status.toLowerCase() === "paid" ? "rounded bg-emerald-500/20 px-2 py-1 text-emerald-300" : ""}>{v.status}</span>
                  </td>
                  <td className="p-3">{v.due_date}</td>
                  <td className="p-3">
                    <Link href={`/salaries/${v.id}`} className="text-blue-400 hover:underline">
                      Open
                    </Link>
                    {v.status.toLowerCase() !== "paid" && (
                      <button type="button" className="ml-3 text-emerald-400 hover:underline" onClick={() => openPaidModal(v)}>
                        Mark as Paid
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500">
                  No salary vouchers found for this tab/filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Modal
        open={Boolean(selectedVoucher)}
        title="Mark salary as paid"
        onClose={() => setSelectedVoucher(null)}
        onConfirm={() => void confirmPaid()}
        confirmLabel="Confirm Payment"
        loading={markingPaid}
      >
        <div className="space-y-3">
          <Input label="Payment Date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          <div className="space-y-1">
            <label className="text-sm text-slate-300">Payment Method</label>
            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <Input label="Received By" placeholder="Admin name" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
