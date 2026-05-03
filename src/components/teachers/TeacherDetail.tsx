"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useReactToPrint } from "react-to-print";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { TeacherForm } from "@/components/teachers/TeacherForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatDurationYearsMonths } from "@/lib/utils/durationSince";
import { currentSalaryMonthYear } from "@/lib/utils/salaryPeriod";
import { scheduleEffectLoad } from "@/lib/utils/scheduleEffectLoad";
import { formatDbTimeTo12h, workDurationLabel } from "@/lib/utils/teacherAttendanceTime";
import type { TeacherFormValues } from "@/lib/validations/teacherSchema";
import { SalaryReceiptBody, salaryReceiptNumber, type SalaryRecordRow } from "@/components/finance/TeacherSalariesModule";
import { Input } from "@/components/ui/Input";
import { Loader2 } from "lucide-react";

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
};

const MONTH_ORDER = [
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

function monthYearSortKey(m: string, y: string) {
  const mi = MONTH_ORDER.indexOf(m.trim());
  const yi = parseInt(y, 10) || 0;
  return yi * 12 + (mi >= 0 ? mi : 0);
}

function monthYearLabel(m: string, y: string) {
  return `${m.trim()} ${y}`;
}

function formatShortDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatJoinedDisplay(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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
  const [detailTab, setDetailTab] = useState<"overview" | "salary" | "attendance">("overview");
  const [monthlyAtt, setMonthlyAtt] = useState<MonthlyAtt[]>([]);
  const [leaveRows, setLeaveRows] = useState<
    { id: string; leave_type: string; from_date: string; to_date: string; status: string }[]
  >([]);
  const [calMonth, setCalMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [calYear, setCalYear] = useState(String(new Date().getFullYear()));
  const [calDays, setCalDays] = useState<{ d: number; status: string | null }[]>([]);
  const [attMonthRows, setAttMonthRows] = useState<
    { date: string; status: string; check_in_time: string | null; check_out_time: string | null; remarks: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [salaryRows, setSalaryRows] = useState<SalaryRecordRow[]>([]);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payRow, setPayRow] = useState<SalaryRecordRow | null>(null);
  const [receiptRow, setReceiptRow] = useState<SalaryRecordRow | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payerName, setPayerName] = useState("Admin");
  const printRef = useRef<HTMLDivElement>(null);
  const [payForm, setPayForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "Cash" as "Cash" | "Bank Transfer" | "Cheque",
    remarks: "",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: receiptRow ? salaryReceiptNumber(receiptRow) : "salary-receipt",
  });

  const loadSalaries = useCallback(async () => {
    const { data: sr } = await supabase
      .from("salary_records")
      .select(
        "id,teacher_id,month,year,amount,status,payment_date,payment_method,paid_by,teachers(full_name,employee_code,subject,class_assigned,profile_photo)",
      )
      .eq("teacher_id", teacherId);
    const list = ((sr ?? []) as SalaryRecordRow[]).map((row) => ({
      ...row,
      teachers: Array.isArray(row.teachers) ? row.teachers[0] ?? null : row.teachers,
    }));
    list.sort((a, b) => monthYearSortKey(b.month, b.year) - monthYearSortKey(a.month, a.year));
    setSalaryRows(list);
  }, [supabase, teacherId]);

  const load = useCallback(async () => {
    const { data: t } = await supabase.from("teachers").select("*").eq("id", teacherId).maybeSingle();
    setTeacher((t as Teacher) ?? null);
    const { data: c } = await supabase.from("classes").select("id,name").order("sort_order");
    setClasses(c ?? []);
    await loadSalaries();
    setLoading(false);
  }, [supabase, teacherId, loadSalaries]);

  const loadAttendanceExtras = useCallback(async () => {
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
      .select("date,status,check_in_time,check_out_time,remarks")
      .eq("teacher_id", teacherId)
      .gte("date", start)
      .lte("date", end)
      .order("date");
    const map = new Map<string, string>();
    (att ?? []).forEach((r: { date: string; status: string }) => map.set(r.date.slice(0, 10), r.status));
    setAttMonthRows(
      ((att ?? []) as { date: string; status: string; check_in_time: string | null; check_out_time: string | null; remarks: string | null }[]).slice(),
    );
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
  }, [supabase, teacherId, calMonth, calYear]);

  useEffect(() => {
    return scheduleEffectLoad(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (detailTab !== "salary") return;
    return scheduleEffectLoad(() => {
      void loadSalaries();
    });
  }, [detailTab, loadSalaries]);

  useEffect(() => {
    const cancel: { v: boolean } = { v: false };
    const cleanup = scheduleEffectLoad(() => {
      void supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user || cancel.v) return;
        const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        if (cancel.v) return;
        if (data?.full_name) setPayerName(data.full_name);
      });
    });
    return () => {
      cancel.v = true;
      cleanup();
    };
  }, [supabase]);

  useEffect(() => {
    if (detailTab !== "attendance") return;
    return scheduleEffectLoad(() => {
      void loadAttendanceExtras();
    });
  }, [detailTab, loadAttendanceExtras]);

  const { month: curSalMonth, year: curSalYear } = currentSalaryMonthYear();

  const currentSalaryRecord = useMemo(() => {
    return salaryRows.find((r) => r.month.trim() === curSalMonth && r.year === curSalYear) ?? null;
  }, [salaryRows, curSalMonth, curSalYear]);

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

  const confirmSalaryPayment = async () => {
    if (!payRow) return;
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const t = payRow.teachers;
      const teacherName = (Array.isArray(t) ? t[0] : t)?.full_name ?? teacher?.full_name ?? "Teacher";
      const title = `Salary — ${teacherName} — ${monthYearLabel(payRow.month, payRow.year)}`;

      const { error: upErr } = await supabase
        .from("salary_records")
        .update({
          status: "paid",
          payment_date: payForm.paymentDate,
          paid_by: user.id,
          payment_method: payForm.paymentMethod,
        })
        .eq("id", payRow.id)
        .eq("status", "unpaid");
      if (upErr) throw upErr;

      const { error: exErr } = await supabase.from("expenses").insert({
        title,
        category: "Salaries",
        amount: Number(payRow.amount),
        expense_date: payForm.paymentDate,
        paid_to: teacherName,
        payment_method: payForm.paymentMethod,
        notes: payForm.remarks.trim() || "Auto-added from salary payment",
        added_by: user.id,
      });
      if (exErr) throw exErr;

      toast.success("Salary marked paid");
      setPayRow(null);
      await loadSalaries();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !teacher) {
    return <p className="text-slate-400">Loading…</p>;
  }

  const annualPct =
    monthlyAtt.length > 0
      ? (monthlyAtt.reduce((a, r) => a + Number(r.attendance_percentage), 0) / monthlyAtt.length).toFixed(1)
      : "—";

  const joiningIso = teacher.joining_date?.slice(0, 10) ?? "";

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
          className={`rounded-lg px-4 py-2 text-sm ${detailTab === "salary" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
          onClick={() => setDetailTab("salary")}
        >
          Salary
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
          <div className="surface-card overflow-x-auto p-0">
            <h2 className="border-b border-slate-700 px-4 py-3 text-lg font-medium">
              Daily attendance ({calYear}-{calMonth.padStart(2, "0")})
            </h2>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-800/60 text-left text-slate-400">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Entry time</th>
                  <th className="p-3">Exit time</th>
                  <th className="p-3">Hours worked</th>
                  <th className="p-3">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {attMonthRows.length === 0 ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={6}>
                      No marks for this month.
                    </td>
                  </tr>
                ) : (
                  attMonthRows.map((r) => (
                    <tr key={r.date} className="border-t border-slate-700">
                      <td className="p-3">{r.date}</td>
                      <td className="p-3 capitalize">{r.status}</td>
                      <td className="p-3">
                        {r.status === "present" || r.status === "late" ? formatDbTimeTo12h(r.check_in_time) : "—"}
                      </td>
                      <td className="p-3">
                        {r.status === "present" || r.status === "late" ? formatDbTimeTo12h(r.check_out_time) : "—"}
                      </td>
                      <td className="p-3">
                        {r.status === "present" || r.status === "late"
                          ? workDurationLabel(r.check_in_time, r.check_out_time)
                          : "—"}
                      </td>
                      <td className="p-3 text-slate-400">{r.remarks ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailTab === "salary" && (
        <div className="space-y-6">
          {salaryRows.length === 0 ? (
            <div className="surface-card border border-slate-600 p-8 text-center">
              <h2 className="text-lg font-semibold text-slate-100">💼 Salary history</h2>
              <p className="mt-4 text-slate-400">No salary records yet.</p>
              <p className="mt-2 text-slate-400">
                New teachers normally get an <strong className="text-slate-200">unpaid</strong> row for the current month when added. If this is
                an older profile, run the monthly salary job or add a row from the database.
              </p>
            </div>
          ) : (
            <>
              <div className="surface-card border border-slate-600 p-6">
                <h2 className="mb-4 text-lg font-semibold">Current month</h2>
                {currentSalaryRecord ? (
                  <div className="space-y-2 rounded-xl border border-slate-600 bg-slate-900/40 p-4 font-mono text-sm">
                    <p>
                      <span className="text-slate-400">Month:</span>{" "}
                      {monthYearLabel(currentSalaryRecord.month, currentSalaryRecord.year)}
                    </p>
                    <p>
                      <span className="text-slate-400">Amount:</span> {formatCurrency(Number(currentSalaryRecord.amount))}
                    </p>
                    <p>
                      <span className="text-slate-400">Status:</span>{" "}
                      {currentSalaryRecord.status === "paid" ? "🟢 PAID" : "🔴 UNPAID"}
                    </p>
                    <div className="pt-2">
                      {currentSalaryRecord.status === "unpaid" ? (
                        <Button type="button" onClick={() => setPayRow(currentSalaryRecord)}>
                          Mark as paid
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setReceiptRow(currentSalaryRecord);
                            setReceiptOpen(true);
                          }}
                        >
                          Print
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">
                    No payroll row for <strong>{monthYearLabel(curSalMonth, curSalYear)}</strong> yet. It should appear when the teacher is
                    added (unpaid) or when the monthly salary job runs.
                  </p>
                )}
              </div>

              <div className="surface-card overflow-hidden p-0">
                <h2 className="border-b border-slate-700 px-4 py-3 text-lg font-medium">Salary history</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/60 text-left text-slate-400">
                      <tr>
                        <th className="p-3">Month</th>
                        <th className="p-3">Year</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Payment date</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryRows.map((r) => (
                        <tr key={r.id} className="border-t border-slate-700">
                          <td className="p-3">{r.month.trim()}</td>
                          <td className="p-3">{r.year}</td>
                          <td className="p-3">{formatCurrency(Number(r.amount))}</td>
                          <td className="p-3">{r.status === "paid" ? "✅ Paid" : "🔴 Unpaid"}</td>
                          <td className="p-3">{r.payment_date ? formatShortDate(r.payment_date) : "—"}</td>
                          <td className="p-3">
                            {r.status === "unpaid" ? (
                              <button type="button" className="text-blue-400 hover:underline" onClick={() => setPayRow(r)}>
                                Mark paid
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="text-blue-400 hover:underline"
                                onClick={() => {
                                  setReceiptRow(r);
                                  setReceiptOpen(true);
                                }}
                              >
                                Print
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
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
            </div>
            <div className="flex flex-wrap gap-2">
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

          {joiningIso && (
            <div className="surface-card border border-slate-600 p-4 md:max-w-xl">
              <p className="text-sm font-medium text-slate-300">Tenure</p>
              <p className="mt-2 text-lg text-slate-100">📅 Joined: {formatJoinedDisplay(joiningIso)}</p>
              <p className="mt-1 text-slate-400">Duration: {formatDurationYearsMonths(joiningIso)}</p>
            </div>
          )}

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

      {payRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && !submitting && setPayRow(null)}
        >
          <div
            className="surface-card max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Record salary payment</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-slate-400">Month: {monthYearLabel(payRow.month, payRow.year)}</p>
              <p className="text-slate-400">Amount: {formatCurrency(Number(payRow.amount))}</p>
              <Input
                label="Payment date"
                type="date"
                value={payForm.paymentDate}
                onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))}
              />
              <div className="space-y-1">
                <label className="text-sm text-slate-400">Payment method</label>
                <select
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
                  value={payForm.paymentMethod}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, paymentMethod: e.target.value as typeof payForm.paymentMethod }))
                  }
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <Input label="Remarks (optional)" value={payForm.remarks} onChange={(e) => setPayForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" type="button" disabled={submitting} onClick={() => setPayRow(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void confirmSalaryPayment()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {receiptOpen && receiptRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setReceiptOpen(false)}
        >
          <div className="surface-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex justify-between gap-2">
              <h2 className="text-lg font-semibold">Salary receipt</h2>
              <div className="flex gap-2">
                <Button variant="secondary" type="button" onClick={() => setReceiptOpen(false)}>
                  Close
                </Button>
                <Button type="button" onClick={() => void handlePrint()}>
                  Print
                </Button>
              </div>
            </div>
            <div ref={printRef} className="rounded-lg border border-slate-600 bg-white p-6 text-black">
              <SalaryReceiptBody row={receiptRow} payerName={payerName} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
