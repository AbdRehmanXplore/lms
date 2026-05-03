"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { allocateFeeVoucherNumber } from "@/lib/utils/generateVoucherNumber";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

type StudentJoin = {
  full_name: string;
  roll_number: string;
  student_uid: string | null;
  phone: string | null;
  whatsapp_reminders: boolean | null;
  profile_photo: string | null;
  classes: { name: string } | { name: string }[] | null;
};

type Voucher = {
  id: string;
  voucher_number: string;
  amount: number;
  amount_paid: number | null;
  remaining_amount: number | null;
  is_partial: boolean | null;
  month: string;
  status: string;
  payment_date: string | null;
  payment_method: string | null;
  received_by: string | null;
  is_defaulter: boolean | null;
  due_date: string;
  student_id: string;
  student_phone: string | null;
  students: StudentJoin | null;
};

type DefaulterAgg = {
  student_id: string;
  full_name: string;
  roll_number: string;
  student_uid: string | null;
  phone: string | null;
  profile_photo: string | null;
  className: string;
  whatsapp_reminders: boolean;
  unpaidSince: string;
  totalDue: number;
};

function outstandingBalance(v: Voucher): number {
  const s = v.status.toLowerCase();
  if (s === "unpaid" || s === "overdue") return Number(v.remaining_amount ?? v.amount ?? 0);
  return 0;
}

export function FeesOverview() {
  const supabase = useSupabaseClient();
  const [tab, setTab] = useState<"unpaid" | "paid" | "defaulters">("unpaid");
  const [rows, setRows] = useState<Voucher[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [summary, setSummary] = useState({ collected: 0, pending: 0, partialCount: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [receivedBy, setReceivedBy] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);

  const [confirmMarkDefaulter, setConfirmMarkDefaulter] = useState<Voucher | null>(null);
  const [markDefaulterLoading, setMarkDefaulterLoading] = useState(false);

  const [reminderSavingStudentId, setReminderSavingStudentId] = useState<string | null>(null);
  const [removeSavingStudentId, setRemoveSavingStudentId] = useState<string | null>(null);

  const refresh = async () => {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("fee_vouchers").update({ status: "overdue" }).eq("status", "unpaid").lt("due_date", today);

    const { data: all } = await supabase
      .from("fee_vouchers")
      .select(
        "id,voucher_number,amount,amount_paid,remaining_amount,is_partial,month,status,payment_date,payment_method,received_by,is_defaulter,due_date,student_id,student_phone,students(full_name,roll_number,student_uid,phone,whatsapp_reminders,profile_photo,classes(name))",
      )
      .order("due_date", { ascending: true })
      .limit(800);

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
              phone: (studentObj.phone as string | null) ?? null,
              whatsapp_reminders: studentObj.whatsapp_reminders as boolean | null,
              profile_photo: (studentObj.profile_photo as string | null) ?? null,
              classes: classesNorm,
            }
          : null,
      } as Voucher;
    });
    setRows(list);

    const collected = list.reduce((a, v) => a + Number(v.amount_paid ?? 0), 0);
    const pending = list
      .filter((v) => ["unpaid", "overdue"].includes(v.status.toLowerCase()))
      .reduce((a, v) => a + outstandingBalance(v), 0);
    const partialCount = list.filter((v) => v.is_partial === true).length;
    setSummary({ collected, pending, partialCount });
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fee list load
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const defaulterRows = useMemo(() => {
    const map = new Map<string, DefaulterAgg>();
    for (const v of rows) {
      const st = v.status.toLowerCase();
      if (st === "paid" || st === "partial") continue;
      if (!v.is_defaulter) continue;
      const student = v.students;
      if (!student) continue;
      const cls = student.classes;
      const cname = Array.isArray(cls) ? cls[0]?.name : cls?.name;
      const prev = map.get(v.student_id);
      const amt = outstandingBalance(v);
      const due = v.due_date;
      if (!prev) {
        map.set(v.student_id, {
          student_id: v.student_id,
          full_name: student.full_name,
          roll_number: student.roll_number,
          student_uid: student.student_uid,
          phone: student.phone,
          profile_photo: student.profile_photo,
          className: cname ?? "—",
          whatsapp_reminders: Boolean(student.whatsapp_reminders ?? false),
          unpaidSince: due,
          totalDue: amt,
        });
      } else {
        prev.totalDue += amt;
        if (due < prev.unpaidSince) prev.unpaidSince = due;
      }
    }
    return [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((v) => {
      const s = v.status.toLowerCase();
      const inPaidTab = s === "paid" || s === "partial";
      const inUnpaidTab = s === "unpaid" || s === "overdue";
      if (tab === "paid" && !inPaidTab) return false;
      if (tab === "unpaid" && !inUnpaidTab) return false;
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

  const filteredDefaulters = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cf = classFilter.trim().toLowerCase();
    return defaulterRows.filter((d) => {
      const matchQ =
        !q ||
        d.full_name.toLowerCase().includes(q) ||
        d.roll_number.toLowerCase().includes(q) ||
        (d.student_uid ?? "").toLowerCase().includes(q);
      const matchC = !cf || d.className.toLowerCase().includes(cf);
      return matchQ && matchC;
    });
  }, [defaulterRows, search, classFilter]);

  const openPaidModal = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setAmountPaidInput("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("Cash");
    setReceivedBy("");
  };

  const totalDueModal = selectedVoucher ? Number(selectedVoucher.amount) : 0;
  const parsedPaid = parseFloat(amountPaidInput.replace(/,/g, ""));
  const remainingPreview =
    selectedVoucher && !Number.isNaN(parsedPaid)
      ? Math.max(roundMoney(totalDueModal - parsedPaid), 0)
      : totalDueModal;

  const confirmPaid = async () => {
    if (!selectedVoucher) return;
    const totalDue = Number(selectedVoucher.amount);
    const paid = parseFloat(amountPaidInput.replace(/,/g, ""));
    if (Number.isNaN(paid) || paid <= 0) {
      toast.error("Enter amount paid");
      return;
    }
    if (paid > totalDue + 1e-9) {
      toast.error("Amount paid cannot exceed total due");
      return;
    }

    const fullPay = paid >= totalDue - 1e-9;

    setMarkingPaid(true);
    try {
      if (fullPay) {
        const { error } = await supabase
          .from("fee_vouchers")
          .update({
            status: "paid",
            amount_paid: totalDue,
            remaining_amount: 0,
            is_partial: false,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            received_by: receivedBy || null,
            is_defaulter: false,
          })
          .eq("id", selectedVoucher.id);
        if (error) throw error;
        toast.success("Payment recorded — paid in full");
      } else {
        const remaining = roundMoney(totalDue - paid);
        const { error: uErr } = await supabase
          .from("fee_vouchers")
          .update({
            status: "partial",
            amount_paid: paid,
            remaining_amount: remaining,
            is_partial: true,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            received_by: receivedBy || null,
          })
          .eq("id", selectedVoucher.id);
        if (uErr) throw uErr;

        const phone = selectedVoucher.students?.phone ?? selectedVoucher.student_phone ?? null;
        const baseMonth = selectedVoucher.month.replace(/\s*\(Remaining\)\s*$/i, "").trim();
        const issueDate = new Date().toISOString().slice(0, 10);

        const vnRemain = `${selectedVoucher.voucher_number}-R`;
        let insertPayload = {
          student_id: selectedVoucher.student_id,
          voucher_number: vnRemain,
          amount: remaining,
          remaining_amount: remaining,
          amount_paid: 0,
          is_partial: false,
          due_date: selectedVoucher.due_date,
          issue_date: issueDate,
          month: `${baseMonth} (Remaining)`,
          status: "unpaid" as const,
          is_defaulter: selectedVoucher.is_defaulter ?? false,
          student_phone: phone,
        };

        let ins = await supabase.from("fee_vouchers").insert(insertPayload);
        const dup =
          ins.error &&
          (String((ins.error as { code?: string }).code ?? "") === "23505" ||
            String(ins.error.message ?? "").toLowerCase().includes("duplicate"));
        if (dup) {
          const altNum = await allocateFeeVoucherNumber(
            supabase,
            Number(selectedVoucher.voucher_number.match(/^VCH-(\d{4})-/)?.[1] ?? new Date().getFullYear()),
          );
          insertPayload = { ...insertPayload, voucher_number: altNum };
          ins = await supabase.from("fee_vouchers").insert(insertPayload);
        }
        if (ins.error) throw ins.error;

        toast.success("Partial payment recorded — remainder voucher created");
      }

      setSelectedVoucher(null);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setMarkingPaid(false);
    }
  };

  const confirmMarkDefaulterAction = async () => {
    if (!confirmMarkDefaulter) return;
    const sid = confirmMarkDefaulter.student_id;
    const name = confirmMarkDefaulter.students?.full_name ?? "Student";
    setMarkDefaulterLoading(true);

    const { error: stErr } = await supabase.from("students").update({ whatsapp_reminders: true }).eq("id", sid);
    if (stErr) {
      toast.error(stErr.message);
      setMarkDefaulterLoading(false);
      return;
    }

    const { error: fvErr } = await supabase
      .from("fee_vouchers")
      .update({ is_defaulter: true })
      .eq("student_id", sid)
      .in("status", ["unpaid", "overdue"]);

    setMarkDefaulterLoading(false);
    if (fvErr) {
      toast.error(fvErr.message);
      return;
    }

    toast.success(`${name} added to defaulters list`);
    setConfirmMarkDefaulter(null);
    void refresh();
  };

  const toggleDefaulterReminder = async (studentId: string, next: boolean) => {
    setReminderSavingStudentId(studentId);
    const { error } = await supabase.from("students").update({ whatsapp_reminders: next }).eq("id", studentId);
    setReminderSavingStudentId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Automatic reminders enabled" : "Automatic reminders disabled");
    void refresh();
  };

  const removeFromDefaulters = async (studentId: string, name: string) => {
    setRemoveSavingStudentId(studentId);
    const { error } = await supabase
      .from("fee_vouchers")
      .update({ is_defaulter: false })
      .eq("student_id", studentId)
      .in("status", ["unpaid", "overdue"]);
    setRemoveSavingStudentId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${name} removed from defaulters`);
    void refresh();
  };

  if (loading) {
    return <p className="text-slate-400">Loading fees…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Total collected (payments received)</p>
          <p className="mt-2 text-xl font-semibold text-emerald-400">{formatCurrency(summary.collected)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Total pending (outstanding)</p>
          <p className="mt-2 text-xl font-semibold text-amber-400">{formatCurrency(summary.pending)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-sm text-slate-400">Partial payment vouchers</p>
          <p className="mt-2 text-xl font-semibold text-violet-400">{summary.partialCount}</p>
        </article>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={tab === "unpaid" ? "primary" : "secondary"} onClick={() => setTab("unpaid")}>
          Unpaid
        </Button>
        <Button type="button" variant={tab === "paid" ? "primary" : "secondary"} onClick={() => setTab("paid")}>
          Paid
        </Button>
        <Button
          type="button"
          variant={tab === "defaulters" ? "danger" : "secondary"}
          onClick={() => setTab("defaulters")}
          className={cn(tab === "defaulters" && "ring-2 ring-red-400/40")}
        >
          Defaulters
          <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{defaulterRows.length}</span>
        </Button>
        <Link
          href="/fees/generate"
          className={cn(
            "ml-auto inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
            "bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] text-white shadow-sm shadow-blue-500/20",
          )}
        >
          Generate voucher
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <Input placeholder="Search name / roll / Student ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input placeholder="Filter class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} />
      </div>

      {tab !== "defaulters" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-800/80 text-slate-300">
              <tr>
                <th className="p-3">Voucher</th>
                <th className="p-3">Student ID</th>
                <th className="p-3">Student</th>
                <th className="p-3">Class</th>
                <th className="p-3">Month</th>
                <th className="p-3">Total Due</th>
                <th className="p-3">Amount Paid</th>
                <th className="p-3">Remaining</th>
                <th className="p-3">Status</th>
                <th className="p-3">Due</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const st = v.students;
                const cls = st?.classes;
                const cname = Array.isArray(cls) ? cls[0]?.name : cls?.name;
                const sl = v.status.toLowerCase();
                const unpaid = sl === "unpaid" || sl === "overdue";
                const td = Number(v.amount);
                const ap = Number(v.amount_paid ?? 0);
                const rem =
                  unpaid ? outstandingBalance(v) : Number(v.remaining_amount ?? Math.max(td - ap, 0));
                return (
                  <tr
                    key={v.id}
                    className={
                      unpaid ? (v.status === "overdue" ? "bg-red-950/30" : "bg-amber-950/20") : undefined
                    }
                  >
                    <td className="p-3 font-mono text-xs">{v.voucher_number}</td>
                    <td className="p-3 font-mono text-xs font-semibold text-blue-200">{st?.student_uid ?? "—"}</td>
                    <td className="p-3">
                      {st?.full_name} ({st?.roll_number})
                    </td>
                    <td className="p-3">{cname ?? "—"}</td>
                    <td className="p-3">{v.month}</td>
                    <td className="p-3">{formatCurrency(td)}</td>
                    <td className="p-3">{formatCurrency(ap)}</td>
                    <td className="p-3">{formatCurrency(rem)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {unpaid && (
                          <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-semibold uppercase text-red-300">
                            {v.status === "overdue" ? "🔴 Overdue" : "🔴 Unpaid"}
                          </span>
                        )}
                        {v.month.includes("(Remaining)") && (
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                            🟡 Remaining
                          </span>
                        )}
                        {sl === "paid" && (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                            ✅ Paid full
                          </span>
                        )}
                        {sl === "partial" && (
                          <span className="rounded bg-amber-500/25 px-2 py-0.5 text-xs font-semibold text-amber-200">
                            🟡 Paid partial
                          </span>
                        )}
                        {v.is_defaulter && (
                          <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-300">Defaulter</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{v.due_date}</td>
                    <td className="space-y-1 whitespace-nowrap p-3">
                      <Link href={`/fees/${v.id}`} className="text-blue-400 hover:underline">
                        Open
                      </Link>
                      {unpaid && (
                        <>
                          {" · "}
                          <button type="button" className="text-emerald-400 hover:underline" onClick={() => openPaidModal(v)}>
                            Mark Payment
                          </button>
                        </>
                      )}
                      {unpaid && !v.is_defaulter && (
                        <>
                          {" · "}
                          <button
                            type="button"
                            className="font-medium text-rose-300 hover:underline"
                            onClick={() => setConfirmMarkDefaulter(v)}
                          >
                            Mark as Defaulter
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-slate-500">
                    No vouchers found for this tab/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-red-900/40">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-red-950/40 text-slate-300">
              <tr>
                <th className="p-3">Photo</th>
                <th className="p-3">Student ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Class</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Unpaid Since</th>
                <th className="p-3">Total Due</th>
                <th className="p-3">Auto MSG</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDefaulters.map((d) => (
                <tr key={d.student_id} className="border-t border-slate-700/80 bg-red-950/10">
                  <td className="p-3">
                    <ProfilePhoto src={d.profile_photo} alt={d.full_name} name={d.full_name} size={36} />
                  </td>
                  <td className="p-3 font-mono text-xs font-semibold text-blue-200">{d.student_uid ?? "—"}</td>
                  <td className="p-3 font-medium">{d.full_name}</td>
                  <td className="p-3">{d.className}</td>
                  <td className="p-3 font-mono text-xs">{d.phone ?? "—"}</td>
                  <td className="p-3">{d.unpaidSince}</td>
                  <td className="p-3">{formatCurrency(d.totalDue)}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      disabled={reminderSavingStudentId === d.student_id}
                      onClick={() => void toggleDefaulterReminder(d.student_id, !d.whatsapp_reminders)}
                      className={cn(
                        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase disabled:opacity-50",
                        d.whatsapp_reminders
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                          : "border-red-500/40 bg-red-500/15 text-red-300",
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", d.whatsapp_reminders ? "bg-emerald-500" : "bg-red-500")} />
                      {reminderSavingStudentId === d.student_id ? "…" : d.whatsapp_reminders ? "On" : "Off"}
                    </button>
                  </td>
                  <td className="space-y-1 whitespace-nowrap p-3">
                    <button
                      type="button"
                      disabled={removeSavingStudentId === d.student_id}
                      className="text-xs font-medium text-slate-300 underline hover:text-white disabled:opacity-50"
                      onClick={() => void removeFromDefaulters(d.student_id, d.full_name)}
                    >
                      {removeSavingStudentId === d.student_id ? "Removing…" : "Remove from Defaulters"}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDefaulters.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No defaulters yet. Mark unpaid students from the Unpaid tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(selectedVoucher)}
        title={
          selectedVoucher
            ? `Mark Payment — ${selectedVoucher.students?.full_name ?? "Student"}`
            : "Mark payment"
        }
        onClose={() => setSelectedVoucher(null)}
        onConfirm={() => void confirmPaid()}
        confirmLabel="Confirm Payment"
        loading={markingPaid}
        confirmVariant="primary"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-3 text-sm">
            <p>
              <span className="text-slate-400">Total Due:</span>{" "}
              <strong>{formatCurrency(totalDueModal)}</strong>
            </p>
          </div>
          <Input
            label="Amount Paid *"
            type="number"
            step="0.01"
            min={0}
            value={amountPaidInput}
            onChange={(e) => setAmountPaidInput(e.target.value)}
            placeholder="0.00"
          />
          <div className="text-sm">
            <span className="text-slate-400">Remaining After Payment:</span>{" "}
            <strong className={remainingPreview > 0 ? "text-red-400" : "text-emerald-400"}>
              {formatCurrency(remainingPreview)}
            </strong>
          </div>
          <Input label="Payment Date *" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
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

      <Modal
        open={Boolean(confirmMarkDefaulter)}
        title="Mark as fee defaulter"
        onClose={() => setConfirmMarkDefaulter(null)}
        onConfirm={() => void confirmMarkDefaulterAction()}
        confirmLabel="Confirm"
        loading={markDefaulterLoading}
        confirmVariant="primary"
      >
        <p className="text-sm leading-relaxed text-slate-300">
          Mark <strong>{confirmMarkDefaulter?.students?.full_name ?? "this student"}</strong> as fee defaulter?
          <br />
          <span className="text-slate-400">Automatic reminders can be adjusted per student after marking.</span>
        </p>
      </Modal>
    </div>
  );
}
