"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import {
  dbTimeToInputValue,
  formatDbTimeTo12h,
  inputTimeToDb,
  nowDbTime,
  workDurationLabel,
} from "@/lib/utils/teacherAttendanceTime";
import { scheduleEffectLoad } from "@/lib/utils/scheduleEffectLoad";

type TeacherRow = {
  id: string;
  full_name: string | null;
  employee_code: string;
  subject: string;
  profile_photo: string | null;
};

type Status = "present" | "absent" | "late" | "leave";
type MarkStatus = Status | null;

type AttRow = {
  teacher_id: string;
  date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  remarks: string | null;
};

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

type DayDetailRow = {
  date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  remarks: string | null;
};

const LEAVE_TYPES = ["Sick Leave", "Casual Leave", "Emergency Leave", "Other"] as const;

function pctColor(p: number) {
  if (p >= 90) return "text-emerald-400";
  if (p >= 75) return "text-amber-400";
  return "text-red-400";
}

function dayNameShort(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}

function dayOfMonth(iso: string) {
  return String(new Date(`${iso}T12:00:00`).getDate()).padStart(2, "0");
}

export function TeacherAttendanceModule() {
  const supabase = useSupabaseClient();
  const printHistRef = useRef<HTMLDivElement>(null);
  const printHist = useReactToPrint({ contentRef: printHistRef });

  const [tab, setTab] = useState<"mark" | "history" | "leaves">("mark");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, MarkStatus>>({});
  const [checkIn, setCheckIn] = useState<Record<string, string>>({});
  const [checkOut, setCheckOut] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [histMonth, setHistMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [histYear, setHistYear] = useState(String(new Date().getFullYear()));
  const [histTeacher, setHistTeacher] = useState<string>("");
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [dailyLogRows, setDailyLogRows] = useState<DayDetailRow[]>([]);
  const [detailOpen, setDetailOpen] = useState<{ teacherId: string; name: string } | null>(null);
  const [detailRows, setDetailRows] = useState<DayDetailRow[]>([]);

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
    const sm: Record<string, MarkStatus> = {};
    const ci: Record<string, string> = {};
    const co: Record<string, string> = {};
    const rm: Record<string, string> = {};
    (t ?? []).forEach((row: TeacherRow) => {
      const rowA = (att ?? []).find((a: AttRow) => a.teacher_id === row.id);
      sm[row.id] = rowA ? (rowA.status as Status) : null;
      ci[row.id] = rowA?.check_in_time ? dbTimeToInputValue(rowA.check_in_time) : "";
      co[row.id] = rowA?.check_out_time ? dbTimeToInputValue(rowA.check_out_time) : "";
      rm[row.id] = rowA?.remarks ?? "";
    });
    setStatusMap(sm);
    setCheckIn(ci);
    setCheckOut(co);
    setRemarks(rm);
  }, [date, supabase]);

  useEffect(() => {
    return scheduleEffectLoad(() => {
      void loadTeachersMark();
    });
  }, [loadTeachersMark]);

  useEffect(() => {
    const cancel: { v: boolean } = { v: false };
    const cleanup = scheduleEffectLoad(() => {
      void supabase.auth.getUser().then(({ data }) => {
        const id = data.user?.id;
        if (!id || cancel.v) return;
        void supabase
          .from("profiles")
          .select("role")
          .eq("id", id)
          .maybeSingle()
          .then(({ data: p }) => {
            if (!cancel.v) setProfileRole((p?.role as string) ?? null);
          });
      });
    });
    return () => {
      cancel.v = true;
      cleanup();
    };
  }, [supabase]);

  const getMarkedBy = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    return userData.user?.id ?? null;
  }, [supabase]);

  const upsertAttendance = useCallback(
    async (
      teacherId: string,
      payload: {
        status: Status;
        check_in_time: string | null;
        check_out_time: string | null;
        remarks?: string | null;
      },
    ) => {
      setSavingId(teacherId);
      try {
        const markedBy = await getMarkedBy();
        const remarksVal = payload.remarks !== undefined ? payload.remarks : remarks[teacherId]?.trim() || null;
        const row = {
          teacher_id: teacherId,
          date,
          status: payload.status,
          check_in_time: payload.check_in_time,
          check_out_time: payload.check_out_time,
          remarks: remarksVal,
          marked_by: markedBy,
          check_in_date: date,
        };
        const { error } = await supabase.from("teacher_attendance").upsert(row, { onConflict: "teacher_id,date" });
        if (error) throw error;
        toast.success("Saved");
        await loadTeachersMark();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSavingId(null);
      }
    },
    [date, remarks, supabase, loadTeachersMark, getMarkedBy],
  );

  const onStatusClick = async (teacherId: string, status: Status) => {
    if (status === "present" || status === "late") {
      if (statusMap[teacherId] === status && checkIn[teacherId]) {
        return;
      }
      const tIn = nowDbTime();
      setStatusMap((prev) => ({ ...prev, [teacherId]: status }));
      setCheckIn((prev) => ({ ...prev, [teacherId]: dbTimeToInputValue(tIn) }));
      await upsertAttendance(teacherId, {
        status,
        check_in_time: tIn,
        check_out_time: inputTimeToDb(checkOut[teacherId] ?? "") ?? null,
      });
      return;
    }
    setStatusMap((prev) => ({ ...prev, [teacherId]: status }));
    setCheckIn((prev) => ({ ...prev, [teacherId]: "" }));
    setCheckOut((prev) => ({ ...prev, [teacherId]: "" }));
    await upsertAttendance(teacherId, {
      status,
      check_in_time: null,
      check_out_time: null,
    });
  };

  const onMarkExit = async (teacherId: string) => {
    const st = statusMap[teacherId];
    if (st !== "present" && st !== "late") return;
    const tOut = nowDbTime();
    setCheckOut((prev) => ({ ...prev, [teacherId]: dbTimeToInputValue(tOut) }));
    setSavingId(teacherId);
    try {
      const markedBy = await getMarkedBy();
      const ciDb = inputTimeToDb(checkIn[teacherId] ?? "");
      const { error } = await supabase
        .from("teacher_attendance")
        .upsert(
          {
            teacher_id: teacherId,
            date,
            status: st,
            check_in_time: ciDb,
            check_out_time: tOut,
            remarks: remarks[teacherId]?.trim() || null,
            marked_by: markedBy,
            check_in_date: date,
          },
          { onConflict: "teacher_id,date" },
        );
      if (error) throw error;
      toast.success("Exit time saved");
      await loadTeachersMark();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const saveTimesFor = async (teacherId: string) => {
    const st = statusMap[teacherId];
    if (st !== "present" && st !== "late") return;
    setSavingId(teacherId);
    try {
      const markedBy = await getMarkedBy();
      const ci = inputTimeToDb(checkIn[teacherId] ?? "");
      const co = inputTimeToDb(checkOut[teacherId] ?? "");
      const { error } = await supabase
        .from("teacher_attendance")
        .upsert(
          {
            teacher_id: teacherId,
            date,
            status: st,
            check_in_time: ci,
            check_out_time: co,
            remarks: remarks[teacherId]?.trim() || null,
            marked_by: markedBy,
            check_in_date: date,
          },
          { onConflict: "teacher_id,date" },
        );
      if (error) throw error;
      toast.success("Times updated");
      await loadTeachersMark();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const saveRemarksFor = async (teacherId: string, text: string) => {
    const st = statusMap[teacherId];
    if (!st) return;
    try {
      const markedBy = await getMarkedBy();
      const { error } = await supabase
        .from("teacher_attendance")
        .upsert(
          {
            teacher_id: teacherId,
            date,
            status: st,
            check_in_time: inputTimeToDb(checkIn[teacherId] ?? ""),
            check_out_time: inputTimeToDb(checkOut[teacherId] ?? ""),
            remarks: text.trim() || null,
            marked_by: markedBy,
            check_in_date: date,
          },
          { onConflict: "teacher_id,date" },
        );
      if (error) throw error;
      await loadTeachersMark();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const counts = useMemo(() => {
    let present = 0,
      absent = 0,
      late = 0,
      leave = 0,
      unset = 0;
    teachers.forEach((t) => {
      const s = statusMap[t.id];
      if (!s) unset += 1;
      else if (s === "present") present += 1;
      else if (s === "absent") absent += 1;
      else if (s === "late") late += 1;
      else if (s === "leave") leave += 1;
    });
    return { present, absent, late, leave, unset };
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

  const loadDailyLog = useCallback(async () => {
    if (!histTeacher) {
      setDailyLogRows([]);
      return;
    }
    const my = `${histYear}-${histMonth.padStart(2, "0")}`;
    const start = `${my}-01`;
    const end = new Date(Number(histYear), Number(histMonth), 0).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("teacher_attendance")
      .select("date,status,check_in_time,check_out_time,remarks")
      .eq("teacher_id", histTeacher)
      .gte("date", start)
      .lte("date", end)
      .order("date");
    if (error) {
      toast.error(error.message);
      return;
    }
    setDailyLogRows((data ?? []) as DayDetailRow[]);
  }, [histMonth, histYear, histTeacher, supabase]);

  useEffect(() => {
    if (tab !== "history") return;
    return scheduleEffectLoad(() => {
      void loadMonthly();
    });
  }, [tab, loadMonthly]);

  useEffect(() => {
    if (tab !== "history") return;
    return scheduleEffectLoad(() => {
      void loadDailyLog();
    });
  }, [tab, loadDailyLog]);

  const openDetail = async (teacherId: string, name: string) => {
    const my = `${histYear}-${histMonth.padStart(2, "0")}`;
    const start = `${my}-01`;
    const end = new Date(Number(histYear), Number(histMonth), 0).toISOString().slice(0, 10);
    const { data } = await supabase
      .from("teacher_attendance")
      .select("date,status,check_in_time,check_out_time,remarks")
      .eq("teacher_id", teacherId)
      .gte("date", start)
      .lte("date", end)
      .order("date");
    setDetailRows((data ?? []) as DayDetailRow[]);
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
            Today: {counts.present} Present | {counts.absent} Absent | {counts.late} Late | {counts.leave} On leave
            {counts.unset > 0 ? ` · ${counts.unset} not marked` : ""}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-800/80">
                <tr>
                  <th className="p-2">Photo</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Subject</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Entry time</th>
                  <th className="p-2 text-left">Exit time</th>
                  <th className="p-2 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => {
                  const st = statusMap[t.id];
                  const showTimes = st === "present" || st === "late";
                  const busy = savingId === t.id;
                  return (
                    <tr key={t.id} className="border-t border-slate-700">
                      <td className="p-2">
                        <ProfilePhoto src={t.profile_photo} alt="" size={36} />
                      </td>
                      <td className="p-2">{t.full_name ?? t.employee_code}</td>
                      <td className="p-2">{t.subject}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            className={`rounded px-2 py-1 text-xs ${st === "present" ? "bg-emerald-700 text-white" : "bg-slate-800 text-slate-300"}`}
                            onClick={() => void onStatusClick(t.id, "present")}
                          >
                            ✓ Present
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className={`rounded px-2 py-1 text-xs ${st === "absent" ? "bg-red-700 text-white" : "bg-slate-800 text-slate-300"}`}
                            onClick={() => void onStatusClick(t.id, "absent")}
                          >
                            ✗ Absent
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className={`rounded px-2 py-1 text-xs ${st === "late" ? "bg-amber-700 text-white" : "bg-slate-800 text-slate-300"}`}
                            onClick={() => void onStatusClick(t.id, "late")}
                          >
                            ⏰ Late
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className={`rounded px-2 py-1 text-xs ${st === "leave" ? "bg-violet-700 text-white" : "bg-slate-800 text-slate-300"}`}
                            onClick={() => void onStatusClick(t.id, "leave")}
                          >
                            🏖️ Leave
                          </button>
                        </div>
                      </td>
                      <td className="p-2">
                        {showTimes ? (
                          <div className="space-y-1">
                            <p className="text-xs text-slate-500">{formatDbTimeTo12h(inputTimeToDb(checkIn[t.id] ?? "") ?? null)}</p>
                            <input
                              type="time"
                              step={1}
                              className="w-full min-w-[110px] rounded border border-slate-600 bg-slate-900 px-1 py-1"
                              value={checkIn[t.id] ?? ""}
                              onChange={(e) => setCheckIn((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              onBlur={() => void saveTimesFor(t.id)}
                            />
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        {showTimes ? (
                          <div className="flex flex-col gap-1">
                            {checkOut[t.id] ? (
                              <p className="text-xs text-slate-500">{formatDbTimeTo12h(inputTimeToDb(checkOut[t.id] ?? "") ?? null)}</p>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                            <input
                              type="time"
                              step={1}
                              className="w-full min-w-[110px] rounded border border-slate-600 bg-slate-900 px-1 py-1"
                              value={checkOut[t.id] ?? ""}
                              onChange={(e) => setCheckOut((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              onBlur={() => void saveTimesFor(t.id)}
                            />
                            <Button type="button" className="mt-1 w-full px-2 py-1 text-xs" disabled={busy} onClick={() => void onMarkExit(t.id)}>
                              Mark exit
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full min-w-[120px] rounded border border-slate-600 bg-slate-900 px-2 py-1"
                          value={remarks[t.id] ?? ""}
                          onChange={(e) => setRemarks((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          onBlur={(e) => {
                            if (statusMap[t.id]) void saveRemarksFor(t.id, e.target.value);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

            {histTeacher && dailyLogRows.length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="text-md font-semibold print:text-black">Daily log (selected teacher)</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-600 print:border-black">
                  <table className="w-full min-w-[720px] text-sm print:text-black">
                    <thead className="bg-slate-800/80 print:bg-white">
                      <tr>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-left">Day</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Entry</th>
                        <th className="p-2 text-left">Exit</th>
                        <th className="p-2 text-left">Hours</th>
                        <th className="p-2 text-left">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyLogRows.map((r) => (
                        <tr key={r.date} className="border-t border-slate-700 print:border-black">
                          <td className="p-2">{dayOfMonth(r.date)}</td>
                          <td className="p-2">{dayNameShort(r.date)}</td>
                          <td className="p-2 capitalize">{r.status}</td>
                          <td className="p-2">{formatDbTimeTo12h(r.check_in_time)}</td>
                          <td className="p-2">{formatDbTimeTo12h(r.check_out_time)}</td>
                          <td className="p-2">{workDurationLabel(r.check_in_time, r.check_out_time)}</td>
                          <td className="p-2 text-slate-400">{r.remarks ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600 text-left text-slate-400">
                <th className="p-2">Date</th>
                <th className="p-2">Day</th>
                <th className="p-2">Status</th>
                <th className="p-2">Entry</th>
                <th className="p-2">Exit</th>
                <th className="p-2">Hours</th>
                <th className="p-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((r) => (
                <tr key={r.date} className="border-b border-slate-800">
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">{dayNameShort(r.date)}</td>
                  <td className="p-2 capitalize">{r.status}</td>
                  <td className="p-2">{formatDbTimeTo12h(r.check_in_time)}</td>
                  <td className="p-2">{formatDbTimeTo12h(r.check_out_time)}</td>
                  <td className="p-2">{workDurationLabel(r.check_in_time, r.check_out_time)}</td>
                  <td className="p-2 text-slate-400">{r.remarks ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
