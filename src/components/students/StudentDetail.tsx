"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { StudentForm } from "@/components/students/StudentForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import type { StudentFormValues } from "@/lib/validations/studentSchema";
import { normalizeFeeLineItems } from "@/lib/utils/feeLineItems";

type Student = {
  id: string;
  student_uid: string | null;
  gr_number: string | null;
  roll_number: string;
  full_name: string;
  father_name: string;
  mother_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  class_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  admission_date: string | null;
  profile_photo: string | null;
  shift: string | null;
  section: string | null;
  status: string;
  classes: { name: string } | { name: string }[] | null;
};

type VoucherRow = {
  id: string;
  month: string;
  fee_type: string | null;
  amount: number;
  status: string;
  issue_date: string;
  payment_date: string | null;
  line_items: unknown;
};

type ResultSummary = {
  exam_type: string;
  exam_year: string;
  rank_in_class: number | null;
  remarks: string | null;
  present_attendance: number | null;
  total_attendance: number | null;
};

export function StudentDetail({ studentId }: { studentId: string }) {
  const supabase = useSupabaseClient();
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [results, setResults] = useState<ResultSummary[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, absent: 0, late: 0 });
  const [tab, setTab] = useState<"overview" | "results" | "attendance" | "fee-vouchers" | "edit">("overview");
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: studentData }, { data: classRows }, { data: voucherRows }, { data: resultRows }, { data: attendanceRows }] =
      await Promise.all([
        supabase.from("students").select("*,classes(name)").eq("id", studentId).maybeSingle(),
        supabase.from("classes").select("id,name").order("sort_order"),
        supabase
          .from("fee_vouchers")
          .select("id,month,fee_type,amount,status,issue_date,payment_date,line_items")
          .eq("student_id", studentId)
          .order("issue_date", { ascending: false }),
        supabase
          .from("results")
          .select("exam_type,exam_year,rank_in_class,remarks,present_attendance,total_attendance")
          .eq("student_id", studentId)
          .order("updated_at", { ascending: false }),
        supabase.from("attendance").select("status").eq("student_id", studentId),
      ]);

    setStudent((studentData as Student) ?? null);
    setClasses(classRows ?? []);
    setVouchers((voucherRows as VoucherRow[]) ?? []);
    setResults(((resultRows as ResultSummary[]) ?? []).filter((row, index, arr) => arr.findIndex((item) => item.exam_type === row.exam_type && item.exam_year === row.exam_year) === index));

    const counts = { present: 0, absent: 0, late: 0 };
    (attendanceRows ?? []).forEach((row: { status: string }) => {
      if (row.status === "present") counts.present += 1;
      if (row.status === "absent") counts.absent += 1;
      if (row.status === "late") counts.late += 1;
    });
    setAttendanceSummary(counts);
    setLoading(false);
  }, [studentId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const defaultForm: Partial<StudentFormValues> | undefined = student
    ? {
        rollNumber: student.roll_number,
        fullName: student.full_name,
        fatherName: student.father_name,
        motherName: student.mother_name ?? "",
        dateOfBirth: student.date_of_birth?.slice(0, 10) ?? "",
        gender: (student.gender as StudentFormValues["gender"]) ?? "Male",
        classId: student.class_id ?? "",
        address: student.address ?? "",
        phone: student.phone ?? "",
        email: student.email ?? "",
        admissionDate: student.admission_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        shift: (student.shift as StudentFormValues["shift"]) ?? "Morning",
        section: student.section ?? "A",
        profilePhoto: student.profile_photo ?? "",
        status: student.status as StudentFormValues["status"],
      }
    : undefined;

  const feeRows = useMemo(() => {
    return vouchers.flatMap((voucher) =>
      normalizeFeeLineItems(voucher).map((item, index) => ({
        key: `${voucher.id}-${index}`,
        month: item.month ?? voucher.month,
        feeType: item.feeType,
        amount: Number(item.amount),
        issueDate: voucher.issue_date,
        status: voucher.status,
        paymentDate: voucher.payment_date,
        voucherId: voucher.id,
      })),
    );
  }, [vouchers]);

  const filteredFeeRows = useMemo(
    () => feeRows.filter((row) => row.issueDate >= fromDate && row.issueDate <= toDate),
    [feeRows, fromDate, toDate],
  );

  const totalPaidFees = useMemo(() => filteredFeeRows.reduce((sum, row) => sum + row.amount, 0), [filteredFeeRows]);

  if (loading || !student) return <p className="text-slate-400">Loading…</p>;

  const className = Array.isArray(student.classes) ? student.classes[0]?.name : student.classes?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          ["overview", "Overview"],
          ["results", "Results"],
          ["attendance", "Attendance"],
          ["fee-vouchers", "Fee Vouchers"],
          ["edit", "Edit"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`rounded-lg px-4 py-2 text-sm ${tab === key ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
            onClick={() => setTab(key as typeof tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
            <div className="surface-card space-y-4 p-6">
              <ProfilePhoto src={student.profile_photo} alt={student.full_name} name={student.full_name} size={120} />
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold">{student.full_name.toUpperCase()}</h1>
                <p className="font-mono text-amber-300">GR#: {student.gr_number ?? "—"}</p>
                <p className="font-mono text-blue-200">SMS ID: {student.student_uid ?? "—"}</p>
                <p>Father: {student.father_name}</p>
                <p>Class: {className ?? "—"} &nbsp; Section: {student.section ?? "A"}</p>
                <p>Shift: {student.shift ?? "Morning"}</p>
                <p>Admission: {student.admission_date ?? "—"}</p>
                <p>Status: {student.status}</p>
                <p>Phone: {student.phone ?? "—"}</p>
              </div>
            </div>

            <div className="surface-card space-y-4 p-6">
              <div className="flex flex-wrap items-end gap-3">
                <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                <Button type="button" variant="secondary">Filter</Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/90 text-slate-300">
                    <tr>
                      <th className="p-3 text-left">Fee Month</th>
                      <th className="p-3 text-left">Fee Description</th>
                      <th className="p-3 text-left">Fee Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeeRows.map((row) => (
                      <tr key={row.key} className="border-t border-slate-700">
                        <td className="p-3">{row.month}</td>
                        <td className="p-3">{row.feeType}</td>
                        <td className="p-3">{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm font-semibold text-emerald-300">Sum Fee Amount: PKR {totalPaidFees.toLocaleString()}</p>
            </div>
          </div>
        </>
      )}

      {tab === "results" && (
        <div className="surface-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Results</h2>
            {student.class_id && (
              <Link href={`/results/${student.class_id}/${student.id}`}>
                <Button type="button">Open Result Card</Button>
              </Link>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/90 text-slate-300">
                <tr>
                  <th className="p-3 text-left">Exam</th>
                  <th className="p-3 text-left">Year</th>
                  <th className="p-3 text-left">Rank</th>
                  <th className="p-3 text-left">Attendance</th>
                  <th className="p-3 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => (
                  <tr key={`${row.exam_type}-${row.exam_year}-${index}`} className="border-t border-slate-700">
                    <td className="p-3">{row.exam_type}</td>
                    <td className="p-3">{row.exam_year}</td>
                    <td className="p-3">{row.rank_in_class ?? "—"}</td>
                    <td className="p-3">{row.total_attendance ?? 0}/{row.present_attendance ?? 0}</td>
                    <td className="p-3">{row.remarks ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "attendance" && (
        <div className="surface-card grid gap-4 p-6 md:grid-cols-3">
          <div className="rounded-xl border border-slate-700 p-4 text-center">
            <p className="text-slate-400">Present</p>
            <p className="text-2xl font-semibold text-emerald-400">{attendanceSummary.present}</p>
          </div>
          <div className="rounded-xl border border-slate-700 p-4 text-center">
            <p className="text-slate-400">Absent</p>
            <p className="text-2xl font-semibold text-red-400">{attendanceSummary.absent}</p>
          </div>
          <div className="rounded-xl border border-slate-700 p-4 text-center">
            <p className="text-slate-400">Late</p>
            <p className="text-2xl font-semibold text-amber-400">{attendanceSummary.late}</p>
          </div>
        </div>
      )}

      {tab === "fee-vouchers" && (
        <div className="surface-card p-6">
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/90 text-slate-300">
                <tr>
                  <th className="p-3 text-left">Voucher</th>
                  <th className="p-3 text-left">Month</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Open</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => (
                  <tr key={voucher.id} className="border-t border-slate-700">
                    <td className="p-3 font-mono">{student.gr_number ?? "—"}</td>
                    <td className="p-3">{voucher.month}</td>
                    <td className="p-3">{formatCurrency(Number(voucher.amount))}</td>
                    <td className="p-3">{voucher.status}</td>
                    <td className="p-3">
                      <Link href={`/fees/${voucher.id}`} className="text-blue-400 hover:underline">
                        Open voucher
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "edit" && (
        <StudentForm
          key={student.id}
          classes={classes}
          studentId={studentId}
          defaultValues={defaultForm}
          studentUid={student.student_uid}
          grNumber={student.gr_number}
        />
      )}
    </div>
  );
}
