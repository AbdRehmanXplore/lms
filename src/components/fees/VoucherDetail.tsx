"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import Link from "next/link";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Button } from "@/components/ui/Button";
import { SchoolLogo } from "@/components/shared/SchoolLogo";
import { useSchoolBranding } from "@/components/providers/SchoolBrandingProvider";
import { normalizeFeeLineItems } from "@/lib/utils/feeLineItems";

type Row = {
  id: string;
  voucher_number: string;
  fee_type: string | null;
  amount: number;
  amount_paid: number | null;
  remaining_amount: number | null;
  is_partial: boolean | null;
  month: string;
  status: string;
  due_date: string;
  issue_date: string;
  payment_date: string | null;
  payment_method: string | null;
  received_by: string | null;
  remarks: string | null;
  line_items: unknown;
  students: {
    full_name: string;
    roll_number: string;
    father_name: string;
    student_uid: string | null;
    gr_number: string | null;
    section: string | null;
    classes: { name: string } | { name: string }[] | null;
  } | null;
};

type OutstandingVoucher = {
  id: string;
  month: string;
  fee_type: string | null;
  remaining_amount: number | null;
  amount: number;
  line_items: unknown;
};

const SELECT =
  "id,voucher_number,fee_type,amount,amount_paid,remaining_amount,is_partial,month,status,due_date,issue_date,payment_date,payment_method,received_by,remarks,line_items,students(full_name,roll_number,father_name,student_uid,gr_number,section,classes(name))";

export function VoucherDetail({ id }: { id: string }) {
  const supabase = useSupabaseClient();
  const [row, setRow] = useState<Row | null>(null);
  const [outstandingVouchers, setOutstandingVouchers] = useState<OutstandingVoucher[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const { schoolName, logoUrl } = useSchoolBranding();

  useEffect(() => {
    void supabase
      .from("fee_vouchers")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setRow((data as Row | null) ?? null));
  }, [id, supabase]);

  // Fetch outstanding (unpaid/overdue) vouchers for the same student
  useEffect(() => {
    if (!row?.students) return;

    void supabase
      .from("fee_vouchers")
      .select("id,month,fee_type,remaining_amount,amount,line_items")
      .eq("student_id", id) // will fix below
      .then(() => {}); // placeholder — see the real fetch below
  }, [row, supabase, id]);

  useEffect(() => {
    if (!row) return;

    // Fetch the student_id for this voucher first, then get their outstanding vouchers
    void supabase
      .from("fee_vouchers")
      .select("student_id")
      .eq("id", id)
      .maybeSingle()
      .then(({ data: vData }) => {
        if (!vData?.student_id) return;
        void supabase
          .from("fee_vouchers")
          .select("id,month,fee_type,remaining_amount,amount,line_items")
          .eq("student_id", vData.student_id)
          .in("status", ["unpaid", "overdue", "partial"])
          .neq("id", id) // exclude current voucher
          .then(({ data }) => {
            setOutstandingVouchers((data as OutstandingVoucher[]) ?? []);
          });
      });
  }, [row, supabase, id]);

  if (!row) return <p className="text-slate-400">Loading…</p>;

  const student = row.students;
  const className = Array.isArray(student?.classes)
    ? student?.classes[0]?.name
    : student?.classes?.name;
  const lineItems = normalizeFeeLineItems(row);
  const grandTotal = lineItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const paidFull = row.status.toLowerCase() === "paid";
  const receiptDate = new Date();

  // Build outstanding rows from other unpaid vouchers
  const outstandingRows: { month: string; feeType: string; amount: number }[] = [];
  for (const ov of outstandingVouchers) {
    const items = normalizeFeeLineItems(ov);
    if (items.length > 0) {
      for (const item of items) {
        outstandingRows.push({
          month: (item.month ?? ov.month).toUpperCase(),
          feeType: item.feeType,
          amount: Number(item.amount),
        });
      }
    } else {
      outstandingRows.push({
        month: ov.month.toUpperCase(),
        feeType: ov.fee_type ?? "Fee",
        amount: Number(ov.remaining_amount ?? ov.amount),
      });
    }
  }
  const outstandingTotal = outstandingRows.reduce((s, r) => s + r.amount, 0);

  const markPaid = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const amount = row ? Number(row.amount) : 0;
    const { error } = await supabase
      .from("fee_vouchers")
      .update({
        status: "paid",
        payment_date: today,
        payment_method: "Cash",
        amount_paid: amount,
        remaining_amount: 0,
        is_partial: false,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked paid in full");
    const { data } = await supabase
      .from("fee_vouchers")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();
    setRow((data as Row | null) ?? null);
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void handlePrint()}>
          Print
        </Button>
        {row.status !== "paid" && row.status !== "partial" && (
          <Button type="button" onClick={() => void markPaid()}>
            Mark as paid (full)
          </Button>
        )}
        <Link href="/fees">
          <Button variant="ghost" type="button">
            Back to fees
          </Button>
        </Link>
      </div>

      {/* PRINTABLE VOUCHER */}
      <div ref={printRef} className="voucher-print mx-auto bg-white text-black" style={{ maxWidth: "900px" }}>
        {/* Two-column layout: left = receipt, right = outstanding */}
        <div className="flex border border-black">

          {/* ── LEFT: Main Receipt ── */}
          <div className="flex-1 border-r border-black">
            {/* School Header */}
            <div className="border-b border-black px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-3">
                <SchoolLogo size={42} className="rounded-md" logoUrl={logoUrl} />
                <div>
                  <p className="text-base font-bold">{schoolName}</p>
                  <p className="text-xs">B-160, Sector 11-A, North Karachi</p>
                  <p className="text-xs">03409756551, Campus III</p>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="border-b border-black px-4 py-2 text-center text-base font-semibold">
              Student Fee Receipt
            </div>

            {/* Student Info */}
            <div className="border-b border-black px-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-1">
                <p><strong>Student Name:</strong> {student?.full_name ?? "—"}</p>
                <p><strong>Father Name:</strong> {student?.father_name ?? "—"}</p>
                <p><strong>Voucher #:</strong> {row.voucher_number}</p>
                <p><strong>GR#:</strong> {student?.gr_number ?? "—"} &nbsp; <strong>Class:</strong> {className ?? "—"} &nbsp; <strong>Section:</strong> {student?.section ?? "A"}</p>
                <p><strong>Receipt Date:</strong> {receiptDate.toLocaleDateString("en-GB")}</p>
                <p><strong>Receipt Time:</strong> {receiptDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>

            {/* Fee Table */}
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-b border-r border-black px-2 py-1 text-left">Fee Month</th>
                  <th className="border-b border-r border-black px-2 py-1 text-left">Fee Type</th>
                  <th className="border-b border-r border-black px-2 py-1 text-center">Amount Type</th>
                  <th className="border-b border-r border-black px-2 py-1 text-center">Fee Amount</th>
                  <th className="border-b border-black px-2 py-1 text-center">Net Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={`${item.feeType}-${index}`}>
                    <td className="border-b border-r border-black px-2 py-1">{(item.month ?? row.month).toUpperCase()}</td>
                    <td className="border-b border-r border-black px-2 py-1">{item.feeType}</td>
                    <td className="border-b border-r border-black px-2 py-1 text-center">
                      {row.status === "overdue" ? "Overdue" : row.status === "paid" ? "Paid" : "Due"}
                    </td>
                    <td className="border-b border-r border-black px-2 py-1 text-center">{formatCurrency(Number(item.amount))}</td>
                    <td className="border-b border-black px-2 py-1 text-center">{formatCurrency(Number(item.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Grand Total */}
            <div className="border-b border-black px-4 py-2 text-xs font-bold">
              Grand Total: PKR {grandTotal.toLocaleString()}/-
            </div>

            {/* Footer */}
            <div className="px-4 py-3 text-xs">
              <p>Received by School</p>
              <p className="mt-1 text-gray-500">
                Note: This is computer generated voucher and does not require a signature.
              </p>
              {paidFull && (
                <p className="mt-1 font-bold text-green-700">Status: PAID</p>
              )}
            </div>
          </div>

          {/* ── RIGHT: Outstanding Fees (Parent's Copy) ── */}
          <div className="w-56 flex flex-col">
            {/* Parent's Copy Label */}
            <div className="border-b border-black px-3 py-2 text-center text-xs font-bold bg-gray-100">
              Parent&apos;s Copy
            </div>

            {/* Outstanding heading */}
            <div className="border-b border-black px-3 py-2 text-center text-xs font-semibold">
              Outstanding Fee(s)
            </div>

            {/* Outstanding Table */}
            <table className="w-full border-collapse text-xs flex-1">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border-b border-r border-black px-2 py-1 text-left">Fee Month</th>
                  <th className="border-b border-r border-black px-2 py-1 text-left">Type</th>
                  <th className="border-b border-black px-2 py-1 text-center">Amount</th>
                </tr>
              </thead>
              <tbody>
                {outstandingRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center text-gray-400 text-xs">
                      No outstanding fees
                    </td>
                  </tr>
                ) : (
                  outstandingRows.map((r, i) => (
                    <tr key={i}>
                      <td className="border-b border-r border-black px-2 py-1">{r.month}</td>
                      <td className="border-b border-r border-black px-2 py-1">{r.feeType}</td>
                      <td className="border-b border-black px-2 py-1 text-center">
                        PKR {r.amount.toLocaleString()}/-
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {outstandingRows.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={2} className="border-t border-black px-2 py-1 font-bold text-right">
                      Total:
                    </td>
                    <td className="border-t border-black px-2 py-1 text-center font-bold">
                      PKR {outstandingTotal.toLocaleString()}/-
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}