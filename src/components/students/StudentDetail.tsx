"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { StudentForm } from "@/components/students/StudentForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils/formatCurrency";
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

export function StudentDetail({ studentId }: { studentId: string }) {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [vouchers, setVouchers] = useState<
    { id: string; month: string; amount: number; status: string; due_date: string }[]
  >([]);
  const [attendanceSummary, setAttendanceSummary] = useState<{ present: number; absent: number; late: number }>({
    present: 0,
    absent: 0,
    late: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const { data: s } = await supabase.from("students").select("*").eq("id", studentId).maybeSingle();
    setStudent((s as Student) ?? null);
    const { data: c } = await supabase.from("classes").select("id,name").order("name");
    setClasses(c ?? []);
    const { data: v } = await supabase
      .from("fee_vouchers")
      .select("id,month,amount,status,due_date")
      .eq("student_id", studentId)
      .order("issue_date", { ascending: false });
    setVouchers(v ?? []);
    const { data: att } = await supabase.from("attendance").select("status").eq("student_id", studentId);
    const counts = { present: 0, absent: 0, late: 0 };
    (att ?? []).forEach((row: { status: string }) => {
      if (row.status === "present") counts.present += 1;
      if (row.status === "absent") counts.absent += 1;
      if (row.status === "late") counts.late += 1;
    });
    setAttendanceSummary(counts);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detail fetch
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- studentId only
  }, [studentId]);

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
        admissionDate: student.admission_date?.slice(0, 10) ?? "",
        profilePhoto: student.profile_photo ?? "",
        status: student.status as StudentFormValues["status"],
      }
    : undefined;

  const outstanding = vouchers.filter((x) => x.status === "unpaid" || x.status === "overdue").reduce((a, b) => a + Number(b.amount), 0);

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

  return (
    <div className="space-y-8">
      {student.student_uid && (
        <div className="surface-card border border-blue-500/40 bg-blue-950/30 px-4 py-3 text-center">
          <p className="text-lg font-semibold tracking-wide text-blue-100 md:text-xl">
            🪪 {student.student_uid} — Permanent ID
          </p>
        </div>
      )}
      <div className="surface-card flex flex-col gap-4 p-6 md:flex-row">
        <ProfilePhoto src={student.profile_photo} alt="" size={96} variant="card" />
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

      <div className="surface-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Fee history</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="p-2">Month</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Status</th>
                <th className="p-2">Due</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.length === 0 ? (
                <tr>
                  <td className="p-2 text-slate-500" colSpan={4}>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
