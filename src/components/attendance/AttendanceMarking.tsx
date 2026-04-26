"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Button } from "@/components/ui/Button";

type Student = { id: string; roll_number: string; full_name: string; student_uid: string | null };
type Status = "present" | "absent" | "late";

export function AttendanceMarking() {
  const supabase = useSupabaseClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase
      .from("classes")
      .select("id,name")
      .order("name")
      .then(({ data }) => setClasses(data ?? []));
  }, [supabase]);

  useEffect(() => {
    if (!classId) {
      queueMicrotask(() => {
        setStudents([]);
        setStatusMap({});
      });
      return;
    }
    const load = async () => {
      const { data: studs } = await supabase
        .from("students")
        .select("id,roll_number,full_name,student_uid")
        .eq("class_id", classId)
        .eq("status", "active")
        .order("roll_number");
      setStudents(studs ?? []);
      const { data: att } = await supabase.from("attendance").select("student_id,status").eq("class_id", classId).eq("date", date);
      const m: Record<string, Status> = {};
      (studs ?? []).forEach((s) => {
        const row = (att ?? []).find((a) => a.student_id === s.id);
        m[s.id] = (row?.status as Status) ?? "present";
      });
      setStatusMap(m);
    };
    void load();
  }, [classId, date, supabase]);

  const counts = () => {
    let p = 0,
      a = 0,
      l = 0;
    students.forEach((s) => {
      const st = statusMap[s.id] ?? "present";
      if (st === "present") p += 1;
      if (st === "absent") a += 1;
      if (st === "late") l += 1;
    });
    return { p, a, l };
  };

  const c = counts();

  const submit = async () => {
    if (!classId) {
      toast.error("Select a class");
      return;
    }
    setLoading(true);
    const rows = students.map((s) => ({
      student_id: s.id,
      class_id: classId,
      date,
      status: statusMap[s.id] ?? "present",
    }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Attendance saved");
  };

  return (
    <div className="space-y-6">
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
        <div>
          <label className="text-xs text-slate-400">Class</label>
          <select
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Select</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="surface-card grid grid-cols-3 gap-4 p-4 text-center text-sm">
        <div>
          <p className="text-slate-400">Present</p>
          <p className="text-xl font-semibold text-emerald-400">{c.p}</p>
        </div>
        <div>
          <p className="text-slate-400">Absent</p>
          <p className="text-xl font-semibold text-red-400">{c.a}</p>
        </div>
        <div>
          <p className="text-slate-400">Late</p>
          <p className="text-xl font-semibold text-amber-400">{c.l}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-800/80">
            <tr>
              <th className="p-3 text-left">Student ID</th>
              <th className="p-3 text-left">Roll</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3">Present</th>
              <th className="p-3">Absent</th>
              <th className="p-3">Late</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const st = statusMap[s.id] ?? "present";
              return (
                <tr key={s.id} className="border-t border-slate-700">
                  <td className="p-3 font-mono text-xs font-semibold text-blue-300">{s.student_uid ?? "—"}</td>
                  <td className="p-3">{s.roll_number}</td>
                  <td className="p-3">{s.full_name}</td>
                  {(["present", "absent", "late"] as const).map((k) => (
                    <td key={k} className="p-3 text-center">
                      <button
                        type="button"
                        className={`rounded-lg px-3 py-1 text-xs ${
                          st === k ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                        onClick={() => setStatusMap((prev) => ({ ...prev, [s.id]: k }))}
                      >
                        {k === "present" ? "✓" : k === "absent" ? "✗" : "⏰"}
                      </button>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button type="button" disabled={loading || !classId} onClick={() => void submit()}>
        {loading ? "Saving…" : "Submit attendance"}
      </Button>
    </div>
  );
}
