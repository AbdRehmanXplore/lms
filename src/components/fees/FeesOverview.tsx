"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type Voucher = {
  id: string;
  voucher_number: string;
  amount: number;
  month: string;
  status: string;
  payment_date: string | null;
  payment_method: string | null;
  received_by: string | null;
  is_defaulter: boolean | null;
  due_date: string;
  student_id: string;
  students: {
    full_name: string;
    roll_number: string;
    student_uid: string | null;
    classes: { name: string } | { name: string }[] | null;
  } | null;
};

export function FeesOverview() {
  const supabase = useSupabaseClient();
  const [tab, setTab] = useState<"unpaid" | "paid">("unpaid");
  const [rows, setRows] = useState<Voucher[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [summary, setSummary] = useState({ collected: 0, pending: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [receivedBy, setReceivedBy] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);
  const [markingDefaulterId, setMarkingDefaulterId] = useState<string | null>(null);

  const refresh = async () => {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("fee_vouchers").update({ status: "overdue" }).eq("status", "unpaid").lt("due_date", today);

    const { data: all } = await supabase
      .from("fee_vouchers")
      .select(
        "id,voucher_number,amount,month,status,payment_date,payment_method,received_by,is_defaulter,due_date,student_id,students(full_name,roll_number,student_uid,classes(name))",
      )
      .order("due_date", { ascending: true })
      .limit(100);

    const list = ((all ?? []) as Record<string, unknown>[]).map((row) => {
      const st = row.students as Record<string, unknown> | Record<string, unknown>[] | null;
      const studentObj = Array.isArray(st) ? st[0] : st;
      const cls = studentObj?.classes as { name: string } | { name: string }[] | null;
      const classesNorm = Array.isArray(cls) ? cls[0] ?? null : cls;
      return {
        ...row,
        students: studentObj
          ? {
              full_name: studentObj.full_name as string,
              roll_number: studentObj.roll_number as string,
              student_uid: (studentObj.student_uid as string | null) ?? null,
              classes: classesNorm,
            }
          : null,
      } as Voucher;
    });
    setRows(list);

    const collected = list.filter((v) => v.status.toLowerCase() === "paid").reduce((a, v) => a + Number(v.amount), 0);
    const pending = list.filter((v) => v.status.toLowerCase() === "unpaid").reduce((a, v) => a + Number(v.amount), 0);
    const overdue = list.filter((v) => v.status.toLowerCase() === "overdue").reduce((a, v) => a + Number(v.amount), 0);
    setSummary({ collected, pending, overdue });
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fee list load
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((v) => {
      const paid = v.status.toLowerCase() === "paid";
      if (tab === "paid" && !paid) return false;
      if (tab === "unpaid" && paid) return false;
      const st = v.students;
      const name = st?.full_name?.toLowerCase() ?? "";
      const roll = st?.roll_number?.toLowerCase() ?? "";
      const uid = st?.student_uid?.toLowerCase() ?? "";
      const cls = st?.classes;
      const cname = (Array.isArray(cls) ? cls[0]?.name : cls?.name) ?? "";
      const matchQ = !q || name.includes(q) || roll.includes(q) || uid.includes(q);
      const matchC = !classFilter || cname.toLowerCase().includes(classFilter.toLowerCase());
      return matchQ && matchC;
    });
  }, [rows, tab, search, classFilter]);

  const openPaidModal = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("Cash");
    setReceivedBy("");
  };

  const confirmPaid = async () => {
    if (!selectedVoucher) return;
    setMarkingPaid(true);
    const { error } = await supabase
      .from("fee_vouchers")
      .update({
        status: "paid",
        payment_date: paymentDate,
        payment_method: paymentMethod,
        received_by: receivedBy || null,
        is_defaulter: false,
      })
      .eq("id", selectedVoucher.id);
    setMarkingPaid(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Voucher marked as paid");
    setSelectedVoucher(null);
    void refresh();
  };

  const toggleDefaulter = async (voucher: Voucher) => {
    if (voucher.status === "paid") return;
    setMarkingDefaulterId(voucher.id);
    const next = !voucher.is_defaulter;
    const { error } = await supabase
      .from("fee_vouchers")
      .update({ is_defaulter: next })
      .eq("student_id", voucher.student_id)
      .in("status", ["unpaid", "overdue"]);
    setMarkingDefaulterId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Student marked as defaulter" : "Defaulter cleared");
    void refresh();
  };

  if (loading) {
    return <p className="text-slate-400">Loading fees…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Total collected (all)</p>
          <p className="mt-2 text-xl font-semibold text-emerald-400">{formatCurrency(summary.collected)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Pending (unpaid)</p>
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
        <Link href="/fees/add" className="ml-auto">
          <Button type="button">Generate voucher</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <Input placeholder="Search name / roll / Student ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input placeholder="Filter class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-800/80 text-slate-300">
            <tr>
              <th className="p-3">Voucher</th>
              <th className="p-3">Student ID</th>
              <th className="p-3">Student</th>
              <th className="p-3">Class</th>
              <th className="p-3">Month</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Due</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const st = v.students;
              const cls = st?.classes;
              const cname = Array.isArray(cls) ? cls[0]?.name : cls?.name;
              const unpaid = v.status.toLowerCase() !== "paid";
              return (
                <tr
                  key={v.id}
                  className={
                    unpaid ? (v.status === "overdue" ? "bg-red-950/30" : "bg-amber-950/20") : undefined
                  }
                >
                  <td className="p-3">{v.voucher_number}</td>
                  <td className="p-3 font-mono text-xs font-semibold text-blue-200">{st?.student_uid ?? "—"}</td>
                  <td className="p-3">
                    {st?.full_name} ({st?.roll_number})
                  </td>
                  <td className="p-3">{cname ?? "—"}</td>
                  <td className="p-3">{v.month}</td>
                  <td className="p-3">{formatCurrency(Number(v.amount))}</td>
                  <td className="p-3 capitalize">
                    <div className="flex flex-wrap items-center gap-2">
                    <span className={v.status.toLowerCase() === "paid" ? "rounded bg-emerald-500/20 px-2 py-1 text-emerald-300" : ""}>{v.status}</span>
                      {v.is_defaulter && <span className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300">Defaulter</span>}
                    </div>
                  </td>
                  <td className="p-3">{v.due_date}</td>
                  <td className="p-3">
                    <Link href={`/fees/${v.id}`} className="text-blue-400 hover:underline">
                      Open
                    </Link>
                    {v.status.toLowerCase() !== "paid" && (
                      <button type="button" className="ml-3 text-emerald-400 hover:underline" onClick={() => openPaidModal(v)}>
                        Mark as Paid
                      </button>
                    )}
                    {v.status.toLowerCase() !== "paid" && (
                      <button
                        type="button"
                        className="ml-3 text-rose-300 hover:underline"
                        disabled={markingDefaulterId === v.id}
                        onClick={() => void toggleDefaulter(v)}
                      >
                        {markingDefaulterId === v.id ? "Saving..." : v.is_defaulter ? "Remove Defaulter" : "Mark Defaulter"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500">
                  No vouchers found for this tab/filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Modal
        open={Boolean(selectedVoucher)}
        title="Mark voucher as paid"
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
