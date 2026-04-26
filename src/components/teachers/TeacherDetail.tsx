"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { TeacherForm } from "@/components/teachers/TeacherForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import type { TeacherFormValues } from "@/lib/validations/teacherSchema";

type Teacher = {
  id: string;
  full_name: string | null;
  employee_code: string;
  subject: string;
  class_assigned: string | null;
  salary: number;
  status: string;
  profile_photo: string | null;
  email: string | null;
  phone: string | null;
  cnic: string | null;
  address: string | null;
  qualification: string | null;
  joining_date: string | null;
  salary_paid_month: string | null;
};

type SalaryRow = { id: string; month: string; amount: number; paid_at: string };

type MonthlyAtt = {
  month_year: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
  total_days: number;
  attendance_percentage: number;
};

export function TeacherDetail({ teacherId }: { teacherId: string }) {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "attendance">("overview");
  const [monthlyAtt, setMonthlyAtt] = useState<MonthlyAtt[]>([]);
  const [leaveRows, setLeaveRows] = useState<
    { id: string; leave_type: string; from_date: string; to_date: string; status: string }[]
  >([]);
  const [calMonth, setCalMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [calYear, setCalYear] = useState(String(new Date().getFullYear()));
  const [calDays, setCalDays] = useState<{ d: number; status: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([]);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = async () => {
    const { data: t } = await supabase.from("teachers").select("*").eq("id", teacherId).maybeSingle();
    setTeacher((t as Teacher) ?? null);
    const { data: h } = await supabase
      .from("teacher_salary_history")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("paid_at", { ascending: false });
    setSalaryRows((h as SalaryRow[]) ?? []);
    const { data: c } = await supabase.from("classes").select("id,name").order("name");
    setClasses(c ?? []);
    setLoading(false);
  };

  const loadAttendanceExtras = async () => {
    const { data: m } = await supabase
      .from("teacher_monthly_attendance")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("month_year", { ascending: false })
      .limit(24);
    setMonthlyAtt((m ?? []) as MonthlyAtt[]);
    const { data: lv } = await supabase
      .from("teacher_leaves")
      .select("id,leave_type,from_date,to_date,status")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    setLeaveRows((lv ?? []) as { id: string; leave_type: string; from_date: string; to_date: string; status: string }[]);
    const ym = `${calYear}-${calMonth.padStart(2, "0")}`;
    const start = `${ym}-01`;
    const end = new Date(Number(calYear), Number(calMonth), 0).toISOString().slice(0, 10);
    const { data: att } = await supabase
      .from("teacher_attendance")
      .select("date,status")
      .eq("teacher_id", teacherId)
      .gte("date", start)
      .lte("date", end);
    const map = new Map<string, string>();
    (att ?? []).forEach((r: { date: string; status: string }) => map.set(r.date.slice(0, 10), r.status));
    const y = Number(calYear);
    const mo = Number(calMonth);
    const daysInMonth = new Date(y, mo, 0).getDate();
    const first = new Date(y, mo - 1, 1);
    const skip = (first.getDay() + 6) % 7;
    const cells: { d: number; status: string | null }[] = [];
    for (let i = 0; i < skip; i += 1) cells.push({ d: 0, status: null });
    for (let d = 1; d <= daysInMonth; d += 1) {
      const ds = `${ym}-${String(d).padStart(2, "0")}`;
      cells.push({ d, status: map.get(ds) ?? null });
    }
    setCalDays(cells);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detail fetch
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teacherId only
  }, [teacherId]);

  useEffect(() => {
    if (detailTab !== "attendance") return;
    void loadAttendanceExtras();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- calMonth/calYear/teacherId
  }, [detailTab, teacherId, calMonth, calYear]);

  const defaultFormValues: Partial<TeacherFormValues> | undefined = teacher
    ? {
        fullName: teacher.full_name ?? "",
        employeeCode: teacher.employee_code,
        email: teacher.email ?? "",
        phone: teacher.phone ?? "",
        cnic: teacher.cnic ?? "",
        address: teacher.address ?? "",
        qualification: teacher.qualification ?? "",
        subject: teacher.subject,
        classAssigned: teacher.class_assigned ?? "",
        salary: Number(teacher.salary),
        joiningDate: teacher.joining_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        status: teacher.status === "inactive" ? "inactive" : "active",
        profilePhoto: teacher.profile_photo ?? "",
      }
    : undefined;

  const onDelete = async () => {
    setDeleting(true);
    await supabase.from("classes").update({ teacher_id: null }).eq("teacher_id", teacherId);
    const { error } = await supabase.from("teachers").delete().eq("id", teacherId);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Teacher removed");
    router.push("/teachers");
  };

  const markSalaryPaid = async () => {
    if (!teacher) return;
    setMarking(true);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { error: e1 } = await supabase.from("teacher_salary_history").insert({
      teacher_id: teacherId,
      month,
      amount: teacher.salary,
    });
    const { error: e2 } = await supabase.from("teachers").update({ salary_paid_month: month }).eq("id", teacherId);
    setMarking(false);
    if (e1 || e2) {
      toast.error(e1?.message ?? e2?.message ?? "Failed");
      return;
    }
    toast.success("Salary marked paid for this month");
    void load();
  };

  if (loading || !teacher) {
    return <p className="text-slate-400">Loading…</p>;
  }

  const annualPct =
    monthlyAtt.length > 0
      ? (
          monthlyAtt.reduce((a, r) => a + Number(r.attendance_percentage), 0) / monthlyAtt.length
        ).toFixed(1)
      : "—";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm ${detailTab === "overview" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
          onClick={() => setDetailTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm ${detailTab === "attendance" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
          onClick={() => setDetailTab("attendance")}
        >
          Attendance
        </button>
      </div>

      {detailTab === "attendance" && (
        <div className="space-y-6">
          <div className="surface-card p-4">
            <h2 className="mb-2 text-lg font-semibold">Annual average (from monthly rollups)</h2>
            <p className="text-2xl font-semibold text-emerald-300">{annualPct}%</p>
          </div>
          <div className="surface-card overflow-x-auto p-0">
            <h2 className="border-b border-slate-700 px-4 py-3 text-lg font-medium">Monthly summary</h2>
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-left text-slate-400">
                <tr>
                  <th className="p-3">Month</th>
                  <th className="p-3">Present</th>
                  <th className="p-3">Absent</th>
                  <th className="p-3">Late</th>
                  <th className="p-3">Leave</th>
                  <th className="p-3">%</th>
                </tr>
              </thead>
              <tbody>
                {monthlyAtt.length === 0 ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={6}>
                      No attendance records yet.
                    </td>
                  </tr>
                ) : (
                  monthlyAtt.map((r) => (
                    <tr key={r.month_year} className="border-t border-slate-700">
                      <td className="p-3">{r.month_year}</td>
                      <td className="p-3">{r.present_count}</td>
                      <td className="p-3">{r.absent_count}</td>
                      <td className="p-3">{r.late_count}</td>
                      <td className="p-3">{r.leave_count}</td>
                      <td className="p-3">{r.attendance_percentage}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="surface-card p-4">
            <h2 className="mb-3 text-lg font-semibold">Leave history</h2>
            <ul className="space-y-2 text-sm">
              {leaveRows.length === 0 ? (
                <li className="text-slate-500">No leave records.</li>
              ) : (
                leaveRows.map((l) => (
                  <li key={l.id} className="flex flex-wrap justify-between border-b border-slate-700 py-2">
                    <span>
                      {l.leave_type} ({l.from_date} → {l.to_date})
                    </span>
                    <span className="capitalize text-slate-400">{l.status}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="surface-card p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <select
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                value={calMonth}
                onChange={(e) => setCalMonth(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                className="w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                value={calYear}
                onChange={(e) => setCalYear(e.target.value)}
              />
            </div>
            <h2 className="mb-2 text-lg font-semibold">Mini calendar</h2>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <div key={d} className="font-semibold text-slate-500">
                  {d}
                </div>
              ))}
              {calDays.map(({ d, status }, idx) => {
                if (d === 0) return <div key={`pad-${idx}`} className="p-2" />;
                const bg =
                  status === "present"
                    ? "bg-emerald-900/60"
                    : status === "absent"
                      ? "bg-red-900/50"
                      : status === "late"
                        ? "bg-amber-900/50"
                        : status === "leave"
                          ? "bg-violet-900/50"
                          : "bg-slate-800";
                return (
                  <div key={d} className={`rounded p-2 ${bg}`} title={status ?? "no data"}>
                    {d}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">Green present · Red absent · Amber late · Purple leave · Gray no mark</p>
          </div>
        </div>
      )}

      {detailTab === "overview" && (
        <>
      <div className="surface-card flex flex-col gap-4 p-6 md:flex-row md:items-start">
        <ProfilePhoto src={teacher.profile_photo} alt="" size={96} variant="card" />
        <div className="flex-1 space-y-2">
          <h1 className="text-2xl font-semibold">{teacher.full_name ?? "Teacher"}</h1>
          <p className="text-slate-400">
            {teacher.employee_code} · {teacher.subject} · {teacher.class_assigned ?? "No class"}
          </p>
          <p className="text-slate-300">{teacher.email}</p>
          <p className="text-sm text-slate-400">Salary: {formatCurrency(Number(teacher.salary))}</p>
          <p className="text-sm text-slate-400">Last paid month: {teacher.salary_paid_month ?? "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={markSalaryPaid} disabled={marking}>
            {marking ? "Saving…" : "Mark salary paid (this month)"}
          </Button>
          <Button variant="danger" type="button" onClick={() => setShowDelete(true)}>
            Delete
          </Button>
          <Link href="/teachers">
            <Button variant="secondary" type="button">
              Back
            </Button>
          </Link>
        </div>
      </div>

      <div className="surface-card overflow-hidden p-0">
        <h2 className="border-b border-slate-700 px-4 py-3 text-lg font-medium">Salary history</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-left text-slate-400">
            <tr>
              <th className="p-3">Month</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Paid at</th>
            </tr>
          </thead>
          <tbody>
            {salaryRows.length === 0 ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={3}>
                  No records yet.
                </td>
              </tr>
            ) : (
              salaryRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-700">
                  <td className="p-3">{r.month}</td>
                  <td className="p-3">{formatCurrency(Number(r.amount))}</td>
                  <td className="p-3">{new Date(r.paid_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Edit profile</h2>
        <TeacherForm
          classes={classes}
          teacherId={teacherId}
          suggestedEmployeeCode={teacher.employee_code}
          defaultValues={defaultFormValues}
        />
      </div>

      <Modal
        open={showDelete}
        title="Delete teacher?"
        onClose={() => setShowDelete(false)}
        onConfirm={onDelete}
        confirmLabel="Delete"
        loading={deleting}
      >
        <p className="text-slate-300">This cannot be undone.</p>
      </Modal>
        </>
      )}
    </div>
  );
}
