"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { generateVoucherNumber } from "@/lib/utils/generateVoucherNumber";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Student = {
  id: string;
  full_name: string;
  roll_number: string;
  father_name: string;
  student_uid: string | null;
  profile_photo: string | null;
  class_id: string | null;
  classes: { name: string } | { name: string }[] | null;
};

export function VoucherAddForm() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState("2500");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [unpaid, setUnpaid] = useState<{ id: string; month: string; amount: number; due_date: string }[]>([]);
  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkAmount, setBulkAmount] = useState("2500");
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [combined, setCombined] = useState(false);
  const [createAsPaid, setCreateAsPaid] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [receivedBy, setReceivedBy] = useState("");

  useEffect(() => {
    void supabase
      .from("students")
      .select("id,full_name,roll_number,father_name,student_uid,profile_photo,class_id,classes(name)")
      .eq("status", "active")
      .order("roll_number")
      .then(({ data }) => setStudents((data ?? []) as Student[]));
    void supabase
      .from("classes")
      .select("id,name")
      .order("sort_order")
      .then(({ data }) => setClasses(data ?? []));
  }, [supabase]);

  useEffect(() => {
    if (!studentId) {
      queueMicrotask(() => setUnpaid([]));
      return;
    }
    void supabase
      .from("fee_vouchers")
      .select("id,month,amount,due_date,status")
      .eq("student_id", studentId)
      .in("status", ["unpaid", "overdue"])
      .then(({ data }) => setUnpaid(data ?? []));
  }, [studentId, supabase]);

  const monthLabel = useMemo(() => `${MONTHS[monthIdx]} ${year}`, [monthIdx, year]);

  const selected = students.find((s) => s.id === studentId);

  const submit = async () => {
    if (!studentId || !amount) {
      toast.error("Select student and amount");
      return;
    }
    setLoading(true);
    const y = year;
    const { count } = await supabase.from("fee_vouchers").select("*", { count: "exact", head: true });
    const voucherNumber = generateVoucherNumber((count ?? 0) + 1, y);

    let total = parseFloat(amount);
    let lineItems: { month: string; amount: number }[] | null = null;

    if (combined && unpaid.length > 0) {
      const parts = unpaid.map((u) => ({ month: u.month, amount: Number(u.amount) }));
      const add = parseFloat(amount);
      parts.push({ month: monthLabel + " (current)", amount: add });
      total = parts.reduce((a, p) => a + p.amount, 0);
      lineItems = parts;
    }

    const { error } = await supabase.from("fee_vouchers").insert({
      student_id: studentId,
      voucher_number: voucherNumber,
      amount: total,
      due_date: dueDate,
      month: monthLabel,
      status: createAsPaid ? "paid" : "unpaid",
      payment_date: createAsPaid ? paymentDate : null,
      payment_method: createAsPaid ? paymentMethod : null,
      received_by: createAsPaid ? (receivedBy || null) : null,
      remarks: remarks || null,
      line_items: lineItems,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (combined && createAsPaid && unpaid.length > 0) {
      await supabase
        .from("fee_vouchers")
        .update({
          status: "paid",
          payment_date: paymentDate,
          payment_method: paymentMethod,
          received_by: receivedBy || null,
        })
        .in(
          "id",
          unpaid.map((u) => u.id),
        );
    }
    toast.success(createAsPaid ? "Paid voucher created" : "Voucher created");
    router.push("/fees");
  };

  const bulkGenerate = async () => {
    if (!bulkClassId || !bulkAmount) {
      toast.error("Select class and amount");
      return;
    }
    setLoading(true);
    const { data: studs } = await supabase.from("students").select("id").eq("class_id", bulkClassId).eq("status", "active");
    const y = year;
    const { count } = await supabase.from("fee_vouchers").select("*", { count: "exact", head: true });
    let seq = (count ?? 0) + 1;
    const amt = parseFloat(bulkAmount);
    for (const s of studs ?? []) {
      const voucherNumber = generateVoucherNumber(seq, y);
      seq += 1;
      await supabase.from("fee_vouchers").insert({
        student_id: s.id,
        voucher_number: voucherNumber,
        amount: amt,
        due_date: dueDate,
        month: monthLabel,
        status: "unpaid",
      });
    }
    setLoading(false);
    toast.success(`Generated ${studs?.length ?? 0} vouchers`);
    router.push("/fees");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="surface-card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Single voucher</h2>
        {unpaid.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-sm">
            <p className="font-medium text-amber-200">This student has {unpaid.length} unpaid voucher(s).</p>
            <ul className="mt-2 list-inside list-disc text-amber-100/90">
              {unpaid.map((u) => (
                <li key={u.id}>
                  {u.month} — {formatCurrency(Number(u.amount))} (due {u.due_date})
                </li>
              ))}
            </ul>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={combined} onChange={(e) => setCombined(e.target.checked)} />
              Combine unpaid + current month in one voucher
            </label>
          </div>
        )}

        <div>
          <label className="text-sm text-slate-300">Student</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.roll_number} — {s.full_name}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
            <ProfilePhoto src={selected.profile_photo} alt={selected.full_name} name={selected.full_name} size={56} />
            <p className="text-sm text-slate-300">
              <span className="font-mono text-xs text-blue-200">{selected.student_uid ?? "—"}</span>
              <br />
              Father: {selected.father_name} · Class:{" "}
              {Array.isArray(selected.classes) ? selected.classes[0]?.name : selected.classes?.name ?? "—"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-300">Month</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={monthIdx}
              onChange={(e) => setMonthIdx(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-300">Year</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
        </div>

        <Input label="Amount (PKR)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={createAsPaid} onChange={(e) => setCreateAsPaid(e.target.checked)} />
          Create as paid voucher (receipt entry)
        </label>
        {createAsPaid && (
          <div className="grid gap-3 rounded-lg border border-emerald-600/30 bg-emerald-950/20 p-3">
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
            <Input label="Received By" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
            {combined && unpaid.length > 0 && (
              <p className="text-xs text-emerald-300">
                Previous unpaid vouchers will be marked paid and moved to Paid list.
              </p>
            )}
          </div>
        )}

        <Button type="button" disabled={loading} onClick={() => void submit()}>
          {loading ? "Saving…" : createAsPaid ? "Save paid voucher" : "Generate voucher"}
        </Button>
      </div>

      <div className="surface-card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Bulk (class)</h2>
        <p className="text-sm text-slate-400">Creates one voucher per active student in the class for the selected month.</p>
        <div>
          <label className="text-sm text-slate-300">Class</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={bulkClassId}
            onChange={(e) => setBulkClassId(e.target.value)}
          >
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Input label="Amount per student" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} />
        <Button variant="secondary" type="button" disabled={loading} onClick={() => void bulkGenerate()}>
          Bulk generate
        </Button>
      </div>
    </div>
  );
}
