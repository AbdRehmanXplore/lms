"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";

/** Class attendance register for a month — read-only grid */
export default function AttendanceHistoryPage() {
  const supabase = useSupabaseClient();
  const [classId, setClassId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [matrix, setMatrix] = useState<{ student: string; roll: string; days: Record<string, string> }[]>([]);

  useEffect(() => {
    void supabase
      .from("classes")
      .select("id,name")
      .order("name")
      .then(({ data }) => setClasses(data ?? []));
  }, [supabase]);

  useEffect(() => {
    if (!classId || !month) return;
    const load = async () => {
      const start = `${month}-01`;
      const endDate = new Date(month + "-01");
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      const end = endDate.toISOString().slice(0, 10);
      const { data: studs } = await supabase
        .from("students")
        .select("id,roll_number,full_name")
        .eq("class_id", classId)
        .order("roll_number");
      const { data: att } = await supabase
        .from("attendance")
        .select("student_id,date,status")
        .eq("class_id", classId)
        .gte("date", start)
        .lte("date", end);
      const rows = (studs ?? []).map((s) => {
        const days: Record<string, string> = {};
        (att ?? [])
          .filter((a) => a.student_id === s.id)
          .forEach((a) => {
            const d = (a.date as string).slice(8, 10);
            const ch = a.status === "present" ? "P" : a.status === "absent" ? "A" : "L";
            days[d] = ch;
          });
        return { student: s.full_name, roll: s.roll_number, days };
      });
      setMatrix(rows);
    };
    void load();
  }, [classId, month, supabase]);

  const dayNums = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Attendance history</h1>
      <div className="flex flex-wrap gap-4">
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
        <div>
          <label className="text-xs text-slate-400">Month</label>
          <input
            type="month"
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="bg-slate-800/80">
              <th className="sticky left-0 z-10 bg-slate-800 p-2 text-left">Roll</th>
              <th className="sticky left-12 z-10 bg-slate-800 p-2 text-left">Name</th>
              {dayNums.map((d) => (
                <th key={d} className="p-1">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.roll} className="border-t border-slate-700">
                <td className="sticky left-0 bg-slate-900 p-2">{row.roll}</td>
                <td className="sticky left-12 bg-slate-900 p-2 whitespace-nowrap">{row.student}</td>
                {dayNums.map((d) => (
                  <td key={d} className="p-1 text-center">
                    {row.days[d] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
