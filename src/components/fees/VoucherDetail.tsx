"use client";

import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import Link from "next/link";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Button } from "@/components/ui/Button";
import { SchoolLogo } from "@/components/shared/SchoolLogo";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { useSchoolBranding } from "@/components/providers/SchoolBrandingProvider";

type Row = {
  id: string;
  voucher_number: string;
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
  line_items: { month: string; amount: number }[] | null;
  students: {
    full_name: string;
    roll_number: string;
    father_name: string;
    student_uid: string | null;
    phone: string | null;
    profile_photo: string | null;
    classes: { name: string } | { name: string }[] | null;
  } | null;
};

const SELECT =
  "id,voucher_number,amount,amount_paid,remaining_amount,is_partial,month,status,due_date,issue_date,payment_date,payment_method,received_by,remarks,line_items,students(full_name,roll_number,father_name,student_uid,phone,profile_photo,classes(name))";

export function VoucherDetail({ id }: { id: string }) {
  const supabase = useSupabaseClient();
  const [row, setRow] = useState<Row | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const { schoolName, logoUrl } = useSchoolBranding();

  const normalizeRow = (data: Record<string, unknown>): Row => {
    const st = data.students as Record<string, unknown> | Record<string, unknown>[] | null;
    const studentObj = Array.isArray(st) ? st[0] : st;
    const cls = studentObj?.classes as { name: string } | { name: string }[] | null;
    const classesNorm = Array.isArray(cls) ? cls[0] ?? null : cls;
    return {
      ...(data as Omit<Row, "students">),
      students: studentObj
        ? {
            full_name: studentObj.full_name as string,
            roll_number: studentObj.roll_number as string,
            father_name: studentObj.father_name as string,
            student_uid: (studentObj.student_uid as string | null) ?? null,
            phone: (studentObj.phone as string | null) ?? null,
            profile_photo: (studentObj.profile_photo as string | null) ?? null,
            classes: classesNorm,
          }
        : null,
    };
  };

  useEffect(() => {
    void supabase
      .from("fee_vouchers")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setRow(null);
          return;
        }
        setRow(normalizeRow(data as Record<string, unknown>));
      });
  }, [id, supabase]);

  const markPaid = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const amt = row ? Number(row.amount) : 0;
    const { error } = await supabase
      .from("fee_vouchers")
      .update({
        status: "paid",
        payment_date: today,
        payment_method: "Cash",
        amount_paid: amt,
        remaining_amount: 0,
        is_partial: false,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked paid in full");
    const { data } = await supabase.from("fee_vouchers").select(SELECT).eq("id", id).maybeSingle();
    if (data) setRow(normalizeRow(data as Record<string, unknown>));
  };

  if (!row) {
    return <p className="text-slate-400">Loading…</p>;
  }

  const st = row.students;
  const cls = st?.classes;
  const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
  const paidFull = row.status.toLowerCase() === "paid";
  const partialReceipt = row.status.toLowerCase() === "partial";
  const phoneMask = st?.phone
    ? st.phone.length > 8
      ? `${st.phone.slice(0, 4)}-XXXX-${st.phone.slice(-4)}`
      : st.phone
    : "—";

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

      <div ref={printRef} className="voucher-print surface-card max-w-xl p-8 text-black">
        <div className="flex items-start justify-between border-b border-black pb-3">
          <div>
            <div className="flex items-center gap-2">
              <SchoolLogo size={32} className="rounded-md" logoUrl={logoUrl} />
              <h1 className="text-lg font-bold">{schoolName}</h1>
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide">
              {paidFull ? "Payment Receipt" : partialReceipt ? "Payment Receipt" : "Fee Payment Voucher"}
            </p>
          </div>
          <ProfilePhoto
            src={st?.profile_photo}
            alt={st?.full_name ?? "student"}
            name={st?.full_name ?? null}
            size={72}
            className="border border-black"
          />
        </div>
        <div className="mt-6 space-y-2 text-sm">
          <p>
            <strong>Student:</strong> {st?.full_name}
          </p>
          <p>
            <strong>Class:</strong> {className ?? "—"}
          </p>
          <p>
            <strong>Phone:</strong> {phoneMask}
          </p>
          <p>
            <strong>Voucher No:</strong> {row.voucher_number}
          </p>
          <p>
            <strong>Issue:</strong> {row.issue_date} &nbsp; <strong>Due:</strong> {row.due_date}
          </p>
          <p>
            <strong>Student ID:</strong> {st?.student_uid ?? "—"}
          </p>
          <p>
            <strong>Father:</strong> {st?.father_name}
          </p>
          <p>
            <strong>Roll:</strong> {st?.roll_number}
          </p>
          <p>
            <strong>Month:</strong> {row.month}
          </p>
          {row.line_items && row.line_items.length > 0 && (
            <ul className="list-inside list-disc">
              {row.line_items.map((line, i) => (
                <li key={i}>
                  {line.month}: {formatCurrency(line.amount)}
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-black pt-3">
            <p>
              <strong>Total Due:</strong> {formatCurrency(Number(row.amount))}
            </p>
            {(paidFull || partialReceipt) && (
              <>
                <p>
                  <strong>Amount Paid:</strong> {formatCurrency(Number(row.amount_paid ?? row.amount))}
                </p>
                <p>
                  <strong>Remaining:</strong> {formatCurrency(Number(row.remaining_amount ?? 0))}
                </p>
              </>
            )}
            {!paidFull && !partialReceipt && (
              <p className="text-lg font-semibold">Balance Due: {formatCurrency(Number(row.amount))}</p>
            )}
            <p className="mt-2 font-bold">
              STATUS:{" "}
              {paidFull ? (
                <span className="text-emerald-700">PAID IN FULL ✅</span>
              ) : partialReceipt ? (
                <span className="text-amber-700">PARTIAL PAYMENT</span>
              ) : (
                <span>{row.status.toUpperCase()}</span>
              )}
            </p>
          </div>
          {(paidFull || partialReceipt) && (
            <>
              <p>
                <strong>Payment Date:</strong>{" "}
                {row.payment_date ? new Date(row.payment_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
              </p>
              <p>
                <strong>Payment Method:</strong> {row.payment_method ?? "—"}
              </p>
              <p>
                <strong>Received By:</strong> {row.received_by ?? "—"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
