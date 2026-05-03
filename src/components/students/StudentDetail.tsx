"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { StudentForm } from "@/components/students/StudentForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatDurationYearsMonths } from "@/lib/utils/durationSince";
import { currentFeeMonthLabel } from "@/lib/utils/salaryPeriod";
import { allocateFeeVoucherNumber } from "@/lib/utils/generateVoucherNumber";
import { scheduleEffectLoad } from "@/lib/utils/scheduleEffectLoad";
import type { StudentFormValues } from "@/lib/validations/studentSchema";

type Student = {
  id: string;
  student_uid: string | null;
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
  status: string;
};

type VoucherRow = {
  id: string;
  month: string;
  amount: number;
  amount_paid: number | null;
  remaining_amount: number | null;
  status: string;
  due_date: string;
  payment_date: string | null;
};

function formatAdmittedDisplay(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function StudentDetail({ studentId }: { studentId: string }) {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<{ present: number; absent: number; late: number }>({
    present: 0,
    absent: 0,
    late: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailTab, setDetailTab] = useState<"profile" | "fees" | "edit">("profile");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const { data: s } = await supabase.from("students").select("*").eq("id", studentId).maybeSingle();
    setStudent((s as Student) ?? null);
    const { data: c } = await supabase.from("classes").select("id,name").order("sort_order");
    setClasses(c ?? []);
    const { data: v } = await supabase
      .from("fee_vouchers")
      .select("id,month,amount,amount_paid,remaining_amount,status,due_date,payment_date")
      .eq("student_id", studentId)
      .order("issue_date", { ascending: false });
    setVouchers((v ?? []) as VoucherRow[]);
    const { data: att } = await supabase.from("attendance").select("status").eq("student_id", studentId);
    const counts = { present: 0, absent: 0, late: 0 };
    (att ?? []).forEach((row: { status: string }) => {
      if (row.status === "present") counts.present += 1;
      if (row.status === "absent") counts.absent += 1;
      if (row.status === "late") counts.late += 1;
    });
    setAttendanceSummary(counts);
    setLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    return scheduleEffectLoad(() => {
      void load();
    });
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
        profilePhoto: student.profile_photo ?? "",
        status: student.status as StudentFormValues["status"],
      }
    : undefined;

  const outstanding = useMemo(
    () =>
      vouchers
        .filter((x) => x.status === "unpaid" || x.status === "overdue" || x.status === "partial")
        .reduce((a, b) => {
          if (b.status === "partial") return a + Number(b.remaining_amount ?? 0);
          return a + Number(b.remaining_amount ?? b.amount ?? 0);
        }, 0),
    [vouchers],
  );

  const currentMonthLabel = currentFeeMonthLabel();
  const currentMonthVoucher = useMemo(
    () => vouchers.find((v) => v.month.trim() === currentMonthLabel.trim()),
    [vouchers, currentMonthLabel],
  );

  const generateCurrentMonthVoucher = async () => {
    if (!student) return;
    if (currentMonthVoucher) {
      toast.error("A voucher for this month already exists");
      return;
    }
    setGenerating(true);
    try {
      const y = new Date().getFullYear();
      const voucherNumber = await allocateFeeVoucherNumber(supabase, y);
      const amt = 2500;
      const due = new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().slice(0, 10);
      const { error } = await supabase.from("fee_vouchers").insert({
        student_id: studentId,
        voucher_number: voucherNumber,
        amount: amt,
        amount_paid: 0,
        remaining_amount: amt,
        is_partial: false,
        due_date: due,
        issue_date: new Date().toISOString().slice(0, 10),
        month: currentMonthLabel,
        status: "unpaid",
        student_phone: student.phone ?? null,
      });
      if (error) throw error;
      toast.success("Voucher generated for current month");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not generate voucher");
    } finally {
      setGenerating(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("students").delete().eq("id", studentId);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Student removed");
    router.push("/students");
  };

  if (loading || !student) {
    return <p className="text-slate-400">Loading…</p>;
  }

  const admissionIso = student.admission_date?.slice(0, 10) ?? "";

  return (
    <div className="space-y-8">
      {student.student_uid && (
        <div className="surface-card border border-blue-500/40 bg-blue-950/30 px-4 py-3 text-center">
          <p className="text-lg font-semibold tracking-wide text-blue-100 md:text-xl">
            🪪 {student.student_uid} — Permanent ID
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm ${detailTab === "profile" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
          onClick={() => setDetailTab("profile")}
        >
          Profile
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm ${detailTab === "fees" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
          onClick={() => setDetailTab("fees")}
        >
          Fees
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm ${detailTab === "edit" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
          onClick={() => setDetailTab("edit")}
        >
          Edit
        </button>
      </div>

      {detailTab === "profile" && (
        <>
          <div className="surface-card flex flex-col gap-4 p-6 md:flex-row">
            <ProfilePhoto src={student.profile_photo} alt={student.full_name} name={student.full_name} size={80} />
            <div className="flex-1 space-y-2">
              <h1 className="text-2xl font-semibold">{student.full_name}</h1>
              <p className="text-slate-400">
                Roll {student.roll_number} · {student.father_name}
              </p>
              {outstanding > 0 && (
                <p className="rounded-lg border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  Outstanding fees: {formatCurrency(outstanding)}
                </p>
              )}
              <p className="text-sm text-slate-400">
                Attendance (all time): Present {attendanceSummary.present}, Absent {attendanceSummary.absent}, Late{" "}
                {attendanceSummary.late}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" type="button" onClick={() => setShowDelete(true)}>
                Delete
              </Button>
              <Link href="/students">
                <Button variant="secondary" type="button">
                  Back
                </Button>
              </Link>
            </div>
          </div>

          {admissionIso && (
            <div className="surface-card border border-slate-600 p-4 md:max-w-xl">
              <p className="text-sm font-medium text-slate-300">Enrollment</p>
              <p className="mt-2 text-lg text-slate-100">📅 Admitted: {formatAdmittedDisplay(admissionIso)}</p>
              <p className="mt-1 text-slate-400">Duration: {formatDurationYearsMonths(admissionIso)}</p>
            </div>
          )}
        </>
      )}

      {detailTab === "fees" && (
        <div className="space-y-6">
          <div className="surface-card border border-slate-600 p-6">
            <h2 className="mb-3 text-lg font-semibold">Current month</h2>
            {currentMonthVoucher ? (
              <div className="rounded-xl border border-slate-600 bg-slate-900/50 p-4">
                <p className="text-slate-300">
                  <span className="font-medium text-white">{currentMonthVoucher.month}</span>
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Amount: {formatCurrency(Number(currentMonthVoucher.amount))} · Due: {currentMonthVoucher.due_date}
                </p>
                <p className="mt-2 text-lg capitalize">
                  Status:{" "}
                  <span
                    className={
                      currentMonthVoucher.status === "paid"
                        ? "text-emerald-400"
                        : currentMonthVoucher.status === "partial"
                          ? "text-amber-400"
                          : "text-red-400"
                    }
                  >
                    {currentMonthVoucher.status}
                  </span>
                </p>
                <div className="mt-3">
                  <Link href={`/fees/${currentMonthVoucher.id}`} className="text-blue-400 hover:underline">
                    Open voucher →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-400">No fee voucher for {currentMonthLabel}.</p>
                <Button type="button" disabled={generating} onClick={() => void generateCurrentMonthVoucher()}>
                  {generating ? "Generating…" : "Generate voucher"}
                </Button>
              </div>
            )}
          </div>

          <div className="surface-card p-6">
            <h2 className="mb-3 text-lg font-semibold">All months</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="p-2">Month</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Due date</th>
                    <th className="p-2">Paid on</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.length === 0 ? (
                    <tr>
                      <td className="p-2 text-slate-500" colSpan={6}>
                        No vouchers.
                      </td>
                    </tr>
                  ) : (
                    vouchers.map((v) => (
                      <tr key={v.id} className="border-t border-slate-700">
                        <td className="p-2">{v.month}</td>
                        <td className="p-2">{formatCurrency(Number(v.amount))}</td>
                        <td className="p-2 capitalize">{v.status}</td>
                        <td className="p-2">{v.due_date}</td>
                        <td className="p-2">{v.payment_date ?? "—"}</td>
                        <td className="p-2">
                          <Link href={`/fees/${v.id}`} className="text-blue-400 hover:underline">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm font-semibold text-amber-200">Outstanding balance: {formatCurrency(outstanding)}</p>
          </div>
        </div>
      )}

      {detailTab === "edit" && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Edit student</h2>
          <StudentForm
            key={student.id}
            classes={classes}
            studentId={studentId}
            defaultValues={defaultForm}
            studentUid={student.student_uid}
          />
        </div>
      )}

      <Modal
        open={showDelete}
        title="Delete student?"
        onClose={() => setShowDelete(false)}
        onConfirm={onDelete}
        confirmLabel="Delete"
        loading={deleting}
      >
        <p className="text-slate-300">This will remove the student and related records per database rules.</p>
      </Modal>
    </div>
  );
}
