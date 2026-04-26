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

type Row = {
  id: string;
  voucher_number: string;
  amount: number;
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
    profile_photo: string | null;
    classes: { name: string } | { name: string }[] | null;
  } | null;
};

export function VoucherDetail({ id }: { id: string }) {
  const supabase = useSupabaseClient();
  const [row, setRow] = useState<Row | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "NEW OXFORD GRAMMER SCHOOL";

  useEffect(() => {
    void supabase
      .from("fee_vouchers")
      .select("id,voucher_number,amount,month,status,due_date,issue_date,payment_date,payment_method,received_by,remarks,line_items,students(full_name,roll_number,father_name,student_uid,profile_photo,classes(name))")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setRow(null);
          return;
        }
        const raw = data as Record<string, unknown>;
        const st = raw.students as Record<string, unknown> | Record<string, unknown>[] | null;
        const studentObj = Array.isArray(st) ? st[0] : st;
        const cls = studentObj?.classes as { name: string } | { name: string }[] | null;
        const classesNorm = Array.isArray(cls) ? cls[0] ?? null : cls;
        setRow({
          ...(raw as Omit<Row, "students">),
          students: studentObj
            ? {
                full_name: studentObj.full_name as string,
                roll_number: studentObj.roll_number as string,
                father_name: studentObj.father_name as string,
                student_uid: (studentObj.student_uid as string | null) ?? null,
                profile_photo: (studentObj.profile_photo as string | null) ?? null,
                classes: classesNorm,
              }
            : null,
        });
      });
  }, [id, supabase]);

  const markPaid = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("fee_vouchers")
      .update({ status: "paid", payment_date: today, payment_method: "Cash" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked paid");
    const { data } = await supabase
      .from("fee_vouchers")
      .select("id,voucher_number,amount,month,status,due_date,issue_date,payment_date,payment_method,received_by,remarks,line_items,students(full_name,roll_number,father_name,student_uid,profile_photo,classes(name))")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const raw = data as Record<string, unknown>;
      const st = raw.students as Record<string, unknown> | Record<string, unknown>[] | null;
      const studentObj = Array.isArray(st) ? st[0] : st;
      const cls = studentObj?.classes as { name: string } | { name: string }[] | null;
      const classesNorm = Array.isArray(cls) ? cls[0] ?? null : cls;
      setRow({
        ...(raw as Omit<Row, "students">),
        students: studentObj
          ? {
              full_name: studentObj.full_name as string,
              roll_number: studentObj.roll_number as string,
              father_name: studentObj.father_name as string,
              student_uid: (studentObj.student_uid as string | null) ?? null,
              profile_photo: (studentObj.profile_photo as string | null) ?? null,
              classes: classesNorm,
            }
          : null,
      });
    }
  };

  if (!row) {
    return <p className="text-slate-400">Loading…</p>;
  }

  const st = row.students;
  const cls = st?.classes;
  const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void handlePrint()}>
          Print
        </Button>
        {row.status !== "paid" && (
          <Button type="button" onClick={() => void markPaid()}>
            Mark as paid
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
              <SchoolLogo size={32} className="rounded-md" />
              <h1 className="text-lg font-bold">{schoolName}</h1>
            </div>
            <p className="text-sm">{row.status === "paid" ? "Fee Receipt" : "Fee Payment Voucher"}</p>
          </div>
          <ProfilePhoto src={st?.profile_photo} alt={st?.full_name ?? "student"} size={72} variant="card" className="border border-black" />
        </div>
        <div className="mt-6 space-y-2 text-sm">
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
            <strong>Student:</strong> {st?.full_name}
          </p>
          <p>
            <strong>Father:</strong> {st?.father_name}
          </p>
          <p>
            <strong>Roll:</strong> {st?.roll_number} &nbsp; <strong>Class:</strong> {className}
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
          <p className="text-lg font-semibold">Amount: {formatCurrency(Number(row.amount))}</p>
          <p><strong>Status:</strong> {row.status.toUpperCase()}</p>
          {row.status === "paid" && (
            <>
              <p><strong>Payment Date:</strong> {row.payment_date ?? "—"}</p>
              <p><strong>Payment Method:</strong> {row.payment_method ?? "—"}</p>
              <p><strong>Received By:</strong> {row.received_by ?? "—"}</p>
              <p className="font-semibold text-emerald-700">STATUS: PAID</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
