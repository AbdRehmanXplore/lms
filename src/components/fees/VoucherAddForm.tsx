"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { allocateFeeVoucherNumber } from "@/lib/utils/generateVoucherNumber";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { FEE_TYPES } from "@/lib/constants/fees";

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
  gr_number: string | null;
  full_name: string;
  roll_number: string;
  father_name: string;
  student_uid: string | null;
  profile_photo: string | null;
  section: string | null;
  shift: string | null;
  class_id: string | null;
  classes: { name: string } | { name: string }[] | null;
};

type FeeRow = {
  feeType: string;
  amount: string;
};

export function VoucherAddForm() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const issueDate = new Date().toISOString().slice(0, 10);

  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [grSearch, setGrSearch] = useState("");
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [dueDate, setDueDate] = useState(issueDate);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [unpaid, setUnpaid] = useState<{ id: string; month: string; amount: number; due_date: string }[]>([]);
  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkAmount, setBulkAmount] = useState("2500");
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [createAsPaid, setCreateAsPaid] = useState(false);
  const [paymentDate, setPaymentDate] = useState(issueDate);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [receivedBy, setReceivedBy] = useState("");
  const [feeRows, setFeeRows] = useState<FeeRow[]>([{ feeType: "Tuition", amount: "2500" }]);

  useEffect(() => {
    void supabase
      .from("students")
      .select("id,gr_number,full_name,roll_number,father_name,student_uid,profile_photo,section,shift,class_id,classes(name)")
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

  useEffect(() => {
    const selectedStudent = students.find((student) => student.id === studentId);
    if (selectedStudent?.gr_number) {
      setGrSearch(selectedStudent.gr_number);
    }
  }, [studentId, students]);

  useEffect(() => {
    const input = grSearch.trim().toUpperCase();
    if (!input) return;
    const matched = students.find((student) => (student.gr_number ?? "").toUpperCase() === input);
    if (matched && matched.id !== studentId) {
      setStudentId(matched.id);
    }
  }, [grSearch, studentId, students]);

  const monthLabel = useMemo(() => `${MONTHS[monthIdx]} ${year}`, [monthIdx, year]);
  const selected = students.find((s) => s.id === studentId);
  const validFeeRows = useMemo(() => feeRows.filter((row) => row.feeType.trim() && Number(row.amount) > 0), [feeRows]);
  const totalAmount = useMemo(() => validFeeRows.reduce((sum, row) => sum + Number(row.amount), 0), [validFeeRows]);

  const submit = async () => {
    if (!studentId || validFeeRows.length === 0) {
      toast.error("Select student and add at least one fee row");
      return;
    }

    setLoading(true);
    const voucherNumber = await allocateFeeVoucherNumber(supabase, year);
    const lineItems = validFeeRows.map((row) => ({
      feeType: row.feeType,
      amount: Number(row.amount),
      month: monthLabel,
    }));

    const { error } = await supabase.from("fee_vouchers").insert({
      student_id: studentId,
      voucher_number: voucherNumber,
      fee_type: lineItems[0]?.feeType ?? "Tuition",
      amount: totalAmount,
      amount_paid: createAsPaid ? totalAmount : 0,
      remaining_amount: createAsPaid ? 0 : totalAmount,
      is_partial: false,
      due_date: dueDate,
      issue_date: issueDate,
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
    const amt = parseFloat(bulkAmount);
    let ok = 0;

    for (const s of studs ?? []) {
      const voucherNumber = await allocateFeeVoucherNumber(supabase, year);
      const { error } = await supabase.from("fee_vouchers").insert({
        student_id: s.id,
        voucher_number: voucherNumber,
        fee_type: "Tuition",
        amount: amt,
        amount_paid: 0,
        remaining_amount: amt,
        is_partial: false,
        due_date: dueDate,
        issue_date: issueDate,
        month: monthLabel,
        status: "unpaid",
        line_items: [{ feeType: "Tuition", amount: amt, month: monthLabel }],
      });
      if (error) {
        setLoading(false);
        toast.error(error.message);
        return;
      }
      ok += 1;
    }

    setLoading(false);
    toast.success(`Generated ${ok} voucher${ok === 1 ? "" : "s"}`);
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
          </div>
        )}

        <div>
          <Input
            label="Find by GR Number"
            placeholder="e.g. KG-001"
            value={grSearch}
            onChange={(e) => setGrSearch(e.target.value.toUpperCase())}
          />
        </div>

        <div>
          <label className="text-sm text-slate-300">Student</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={studentId}
            onChange={(e) => {
              const nextId = e.target.value;
              setStudentId(nextId);
              const selectedStudent = students.find((student) => student.id === nextId);
              if (selectedStudent?.gr_number) {
                setGrSearch(selectedStudent.gr_number);
              }
            }}
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.gr_number ?? "—"} — {s.full_name}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
            <ProfilePhoto src={selected.profile_photo} alt={selected.full_name} name={selected.full_name} size={56} />
            <p className="text-sm leading-6 text-slate-300">
              <span className="font-mono text-xs text-amber-200">GR#: {selected.gr_number ?? "—"}</span>
              <br />
              <span className="font-mono text-xs text-blue-200">SMS ID: {selected.student_uid ?? "—"}</span>
              <br />
              Father: {selected.father_name} · Class:{" "}
              {Array.isArray(selected.classes) ? selected.classes[0]?.name : selected.classes?.name ?? "—"} · Section:{" "}
              {selected.section ?? "A"} · Shift: {selected.shift ?? "Morning"}
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

        <div className="space-y-3 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-200">Fee Type | Amount</p>
            <Button type="button" variant="secondary" onClick={() => setFeeRows((prev) => [...prev, { feeType: "Tuition", amount: "" }])}>
              Add Row (+)
            </Button>
          </div>
          {feeRows.map((row, index) => (
            <div key={`${index}-${row.feeType}`} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <div className="space-y-1">
                <label className="text-sm text-slate-300">Fee Type</label>
                <select
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                  value={row.feeType}
                  onChange={(e) =>
                    setFeeRows((prev) => prev.map((item, i) => (i === index ? { ...item, feeType: e.target.value } : item)))
                  }
                >
                  {FEE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Amount"
                value={row.amount}
                onChange={(e) =>
                  setFeeRows((prev) => prev.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)))
                }
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="danger"
                  disabled={feeRows.length === 1}
                  onClick={() => setFeeRows((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <div className="rounded-lg bg-slate-900/60 px-3 py-2 text-sm font-semibold text-emerald-300">
            Total: {formatCurrency(totalAmount)}
          </div>
        </div>

        <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <Input label="Voucher date" type="date" value={issueDate} readOnly />
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
          </div>
        )}

        <Button type="button" disabled={loading} onClick={() => void submit()}>
          {loading ? "Saving…" : createAsPaid ? "Save paid voucher" : "Generate voucher"}
        </Button>
      </div>

      <div className="surface-card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Bulk (class)</h2>
        <p className="text-sm text-slate-400">Creates one tuition voucher per active student in the class for the selected month.</p>
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
        <Input label="Voucher date" type="date" value={issueDate} readOnly />
        <Button variant="secondary" type="button" disabled={loading} onClick={() => void bulkGenerate()}>
          Bulk generate
        </Button>
      </div>
    </div>
  );
}
