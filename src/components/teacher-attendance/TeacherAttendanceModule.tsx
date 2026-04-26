"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { useRef } from "react";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";

type TeacherRow = {
  id: string;
  full_name: string | null;
  employee_code: string;
  subject: string;
  profile_photo: string | null;
};

type Status = "present" | "absent" | "late" | "leave";

type MonthlyRow = {
  teacher_id: string;
  employee_code: string;
  teacher_name: string;
  month_year: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
  total_days: number;
  attendance_percentage: number;
};

const LEAVE_TYPES = ["Sick Leave", "Casual Leave", "Emergency Leave", "Other"] as const;

function pctColor(p: number) {
  if (p >= 90) return "text-emerald-400";
  if (p >= 75) return "text-amber-400";
  return "text-red-400";
}

export function TeacherAttendanceModule() {
  const supabase = useSupabaseClient();
  const printHistRef = useRef<HTMLDivElement>(null);
  const printHist = useReactToPrint({ contentRef: printHistRef });

  const [tab, setTab] = useState<"mark" | "history" | "leaves">("mark");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({});
  const [checkIn, setCheckIn] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [histMonth, setHistMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [histYear, setHistYear] = useState(String(new Date().getFullYear()));
  const [histTeacher, setHistTeacher] = useState<string>("");
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [detailOpen, setDetailOpen] = useState<{ teacherId: string; name: string } | null>(null);
  const [detailRows, setDetailRows] = useState<{ date: string; status: string }[]>([]);

  const [leaveTeacher, setLeaveTeacher] = useState("");
  const [leaveType, setLeaveType] = useState<string>("Casual Leave");
  const [fromD, setFromD] = useState(new Date().toISOString().slice(0, 10));
  const [toD, setToD] = useState(new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState<
    { id: string; teacher_id: string; leave_type: string; from_date: string; to_date: string; reason: string | null }[]
  >([]);
  const [profileRole, setProfileRole] = useState<string | null>(null);

  const loadTeachersMark = useCallback(async () => {
    const { data: t } = await supabase
      .from("teachers")
      .select("id,full_name,employee_code,subject,profile_photo")
      .eq("status", "active")
      .order("full_name");
    setTeachers((t ?? []) as TeacherRow[]);
    const { data: att } = await supabase.from("teacher_attendance").select("*").eq("date", date);
    const sm: Record<string, Status> = {};
    const ci: Record<string, string> = {};
    const rm: Record<string, string> = {};
    (t ?? []).forEach((row: TeacherRow) => {
      const rowA = (att ?? []).find((a: { teacher_id: string }) => a.teacher_id === row.id);
      sm[row.id] = (rowA?.status as Status) ?? "present";
      ci[row.id] = rowA?.check_in_time ? String(rowA.check_in_time).slice(0, 5) : "";
      rm[row.id] = rowA?.remarks ?? "";
    });
    setStatusMap(sm);
    setCheckIn(ci);
    setRemarks(rm);
  }, [date, supabase]);

  useEffect(() => {
    void loadTeachersMark();
  }, [loadTeachersMark]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id;
      if (!id) return;
      void supabase
        .from("profiles")
        .select("role")
        .eq("id", id)
        .maybeSingle()
        .then(({ data: p }) => setProfileRole((p?.role as string) ?? null));
    });
  }, [supabase]);

  const submitAll = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const markedBy = userData.user?.id ?? null;
    const rows = teachers.map((t) => ({
      teacher_id: t.id,
      date,
      status: statusMap[t.id] ?? "present",
      check_in_time: checkIn[t.id]?.trim() ? `${checkIn[t.id].trim()}:00` : null,
      check_out_time: null,
      remarks: remarks[t.id]?.trim() || null,
      marked_by: markedBy,
    }));
    const { error } = await supabase.from("teacher_attendance").upsert(rows, {
      onConflict: "teacher_id,date",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Attendance saved");
    void loadTeachersMark();
  };

  const counts = useMemo(() => {
    let present = 0,
      absent = 0,
      late = 0,
      leave = 0;
    teachers.forEach((t) => {
      const s = statusMap[t.id] ?? "present";
      if (s === "present") present += 1;
      if (s === "absent") absent += 1;
      if (s === "late") late += 1;
      if (s === "leave") leave += 1;
    });
    return { present, absent, late, leave };
  }, [teachers, statusMap]);

  const loadMonthly = useCallback(async () => {
    const my = `${histYear}-${histMonth.padStart(2, "0")}`;
    let q = supabase.from("teacher_monthly_attendance").select("*").eq("month_year", my);
    if (histTeacher) q = q.eq("teacher_id", histTeacher);
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      return;
    }
    setMonthlyRows((data ?? []) as MonthlyRow[]);
  }, [histMonth, histYear, histTeacher, supabase]);

  useEffect(() => {
    if (tab === "history") void loadMonthly();
  }, [tab, loadMonthly]);

  const openDetail = async (teacherId: string, name: string) => {
    const my = `${histYear}-${histMonth.padStart(2, "0")}`;
    const start = `${my}-01`;
    const end = new Date(Number(histYear), Number(histMonth), 0).toISOString().slice(0, 10);
    const { data } = await supabase
      .from("teacher_attendance")
      .select("date,status")
      .eq("teacher_id", teacherId)
      .gte("date", start)
      .lte("date", end)
      .order("date");
    setDetailRows((data ?? []) as { date: string; status: string }[]);
    setDetailOpen({ teacherId, name });
  };

  const submitLeave = async () => {
    if (!leaveTeacher) {
      toast.error("Select teacher");
      return;
    }
    setLeaveSaving(true);
    const { error } = await supabase.from("teacher_leaves").insert({
      teacher_id: leaveTeacher,
      leave_type: leaveType,
      from_date: fromD,
      to_date: toD,
      reason: leaveReason.trim() || null,
      status: "pending",
    });
    setLeaveSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Leave application submitted");
    setLeaveReason("");
    void loadPending();
  };

  const loadPending = useCallback(async () => {
    const { data } = await supabase
      .from("teacher_leaves")
      .select("id,teacher_id,leave_type,from_date,to_date,reason,status")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingLeaves((data ?? []) as typeof pendingLeaves);
  }, [supabase]);

  useEffect(() => {
    if (tab === "leaves") void loadPending();
  }, [tab, loadPending]);

  const approveLeave = async (id: string, ok: boolean) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const { error } = await supabase
      .from("teacher_leaves")
      .update({ status: ok ? "approved" : "rejected", approved_by: uid })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(ok ? "Approved" : "Rejected");
    void loadPending();
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap gap-2">
        {(["mark", "history", "leaves"] as const).map((t) => (
          <Button key={t} type="button" variant={tab === t ? undefined : "secondary"} onClick={() => setTab(t)}>
            {t === "mark" ? "Mark attendance" : t === "history" ? "History" : "Leave management"}
          </Button>
        ))}
      </div>

      {tab === "mark" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-xs text-slate-400">Date</label>
              <input
                type="date"
                className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Present {counts.present} | Absent {counts.absent} | Late {counts.late} | On leave {counts.leave}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-800/80">
                <tr>
                  <th className="p-2">Photo</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Subject</th>
                  <th className="p-2">Present</th>
                  <th className="p-2">Absent</th>
                  <th className="p-2">Late</th>
                  <th className="p-2">Leave</th>
                  <th className="p-2">Check-in</th>
                  <th className="p-2 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => {
                  const st = statusMap[t.id] ?? "present";
                  return (
                    <tr key={t.id} className="border-t border-slate-700">
                      <td className="p-2">
                        <ProfilePhoto src={t.profile_photo} alt="" size={36} />
                      </td>
                      <td className="p-2">{t.full_name ?? t.employee_code}</td>
                      <td className="p-2">{t.subject}</td>
                      {(["present", "absent", "late", "leave"] as const).map((k) => (
                        <td key={k} className="p-2 text-center">
                          <button
                            type="button"
                            className={`rounded px-2 py-1 text-xs ${
                              st === k ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
                            }`}
                            onClick={() => setStatusMap((prev) => ({ ...prev, [t.id]: k }))}
                          >
                            {k === "present" ? "✓" : k === "absent" ? "✗" : k === "late" ? "⏰" : "🏖️"}
                          </button>
                        </td>
                      ))}
                      <td className="p-2">
                        <input
                          type="time"
                          className="w-full min-w-[100px] rounded border border-slate-600 bg-slate-900 px-1 py-1"
                          value={checkIn[t.id] ?? ""}
                          onChange={(e) => setCheckIn((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full min-w-[120px] rounded border border-slate-600 bg-slate-900 px-2 py-1"
                          value={remarks[t.id] ?? ""}
                          onChange={(e) => setRemarks((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button type="button" disabled={saving} onClick={() => void submitAll()}>
            {saving ? "Saving…" : "Submit all"}
          </Button>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <select
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={histMonth}
              onChange={(e) => setHistMonth(e.target.value)}
            >
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              className="w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={histYear}
              onChange={(e) => setHistYear(e.target.value)}
            />
            <select
              className="min-w-[200px] rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={histTeacher}
              onChange={(e) => setHistTeacher(e.target.value)}
            >
              <option value="">All teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name ?? t.employee_code}
                </option>
              ))}
            </select>
            <Button type="button" variant="secondary" onClick={() => void loadMonthly()}>
              Refresh
            </Button>
            <Button type="button" variant="secondary" onClick={() => void printHist()}>
              Print monthly report
            </Button>
          </div>

          <div ref={printHistRef} className="space-y-4">
            <h2 className="text-lg font-semibold print:text-black">
              Teacher attendance — {histYear}-{histMonth}
            </h2>
            <table className="w-full text-sm print:text-black">
              <thead>
                <tr className="border-b border-slate-600 text-left print:border-black">
                  <th className="p-2">Teacher</th>
                  <th className="p-2">Days</th>
                  <th className="p-2">Present</th>
                  <th className="p-2">Absent</th>
                  <th className="p-2">Late</th>
                  <th className="p-2">Leave</th>
                  <th className="p-2">%</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((r) => (
                  <tr
                    key={`${r.teacher_id}-${r.month_year}`}
                    className="cursor-pointer border-t border-slate-700 hover:bg-slate-800/50 print:border-black"
                    onClick={() => void openDetail(r.teacher_id, r.teacher_name)}
                  >
                    <td className="p-2">{r.teacher_name}</td>
                    <td className="p-2">{r.total_days}</td>
                    <td className="p-2">{r.present_count}</td>
                    <td className="p-2">{r.absent_count}</td>
                    <td className="p-2">{r.late_count}</td>
                    <td className="p-2">{r.leave_count}</td>
                    <td className={`p-2 font-semibold ${pctColor(Number(r.attendance_percentage))}`}>
                      {r.attendance_percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "leaves" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="surface-card p-4">
            <h3 className="mb-3 font-semibold">Apply for leave</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Teacher</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                  value={leaveTeacher}
                  onChange={(e) => setLeaveTeacher(e.target.value)}
                >
                  <option value="">Select</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name ?? t.employee_code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Leave type</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  {LEAVE_TYPES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">From</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                    value={fromD}
                    onChange={(e) => setFromD(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">To</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                    value={toD}
                    onChange={(e) => setToD(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400">Reason</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                  rows={3}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                />
              </div>
              <Button type="button" disabled={leaveSaving} onClick={() => void submitLeave()}>
                {leaveSaving ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </div>
          <div className="surface-card p-4">
            <h3 className="mb-3 font-semibold">Pending approvals</h3>
            {profileRole !== "admin" && (
              <p className="mb-2 text-sm text-amber-400">Only admins can approve or reject from this list.</p>
            )}
            <ul className="space-y-3">
              {pendingLeaves.map((l) => (
                <li key={l.id} className="rounded-lg border border-slate-600 p-3 text-sm">
                  <p className="font-medium">{l.leave_type}</p>
                  <p className="text-slate-400">
                    {l.from_date} → {l.to_date}
                  </p>
                  <p className="text-slate-300">{l.reason}</p>
                  {profileRole === "admin" && (
                    <div className="mt-2 flex gap-2">
                      <Button type="button" onClick={() => void approveLeave(l.id, true)}>
                        Approve
                      </Button>
                      <Button type="button" variant="danger" onClick={() => void approveLeave(l.id, false)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="surface-card p-4 lg:col-span-2">
            <h3 className="mb-3 font-semibold">Leave balance (policy)</h3>
            <p className="text-sm text-slate-400">
              Sick leave: 10 days / year · Casual leave: 12 days / year. Balances are enforced when approving requests
              (manual check).
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {teachers.map((t) => (
                <div key={t.id} className="rounded border border-slate-700 px-3 py-2 text-sm">
                  {t.full_name ?? t.employee_code}: sick 10 / yr · casual 12 / yr (check when approving)
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal open={!!detailOpen} title={detailOpen ? `${detailOpen.name} — days` : ""} onClose={() => setDetailOpen(null)}>
        <ul className="max-h-72 space-y-1 overflow-auto text-sm">
          {detailRows.map((r) => (
            <li key={r.date} className="flex justify-between border-b border-slate-700 py-1">
              <span>{r.date}</span>
              <span className="capitalize text-slate-300">{r.status}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
