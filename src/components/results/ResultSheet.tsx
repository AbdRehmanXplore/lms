"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { useRef } from "react";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { calculateGrade, calculateStatus } from "@/lib/utils/calculateGrade";
import { Button } from "@/components/ui/Button";

type Subject = { id: string; name: string; max_marks: number };
type Student = {
  id: string;
  roll_number: string;
  full_name: string;
  father_name: string;
  student_uid: string | null;
};

type Props = {
  classId: string;
  className: string;
};

const EXAMS = ["Monthly", "Mid-Term", "Final", "Unit Test"] as const;

export function ResultSheet({ classId, className }: Props) {
  const supabase = useSupabaseClient();
  const [examType, setExamType] = useState<string>("Final");
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: subs } = await supabase.from("subjects").select("id,name,max_marks").eq("class_id", classId);
    const { data: studs } = await supabase
      .from("students")
      .select("id,roll_number,full_name,father_name,student_uid")
      .eq("class_id", classId)
      .order("roll_number");
    const { data: res } = await supabase
      .from("results")
      .select("student_id,subject_id,marks_obtained,max_marks")
      .eq("class_id", classId)
      .eq("exam_type", examType)
      .eq("exam_year", examYear);

    const next: Record<string, Record<string, string>> = {};
    (studs ?? []).forEach((s) => {
      next[s.id] = {};
      (subs ?? []).forEach((sub) => {
        const row = (res ?? []).find((r) => r.student_id === s.id && r.subject_id === sub.id);
        next[s.id][sub.id] = row?.marks_obtained != null ? String(row.marks_obtained) : "";
      });
    });

    setSubjects((subs ?? []) as Subject[]);
    setStudents(studs ?? []);
    setMarks(next);
    setLoading(false);
  }, [supabase, classId, examType, examYear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load updates list state from Supabase
    void load();
  }, [load]);

  const updateCell = (studentId: string, subjectId: string, value: string) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [subjectId]: value },
    }));
  };

  const rowTotals = (studentId: string) => {
    let obtained = 0;
    let max = 0;
    subjects.forEach((sub) => {
      const v = parseFloat(marks[studentId]?.[sub.id] ?? "");
      if (!Number.isNaN(v)) {
        obtained += v;
        max += sub.max_marks;
      }
    });
    const pct = max > 0 ? (obtained / max) * 100 : 0;
    return { obtained, max, pct, grade: calculateGrade(pct), status: calculateStatus(pct) };
  };

  const saveAll = async () => {
    setSaving(true);
    const rows: Record<string, unknown>[] = [];
    students.forEach((s) => {
      subjects.forEach((sub) => {
        const raw = marks[s.id]?.[sub.id]?.trim();
        if (raw === "" || raw === undefined) return;
        const m = parseFloat(raw);
        if (Number.isNaN(m)) return;
        rows.push({
          student_id: s.id,
          class_id: classId,
          subject_id: sub.id,
          exam_type: examType,
          exam_year: examYear,
          marks_obtained: m,
          max_marks: sub.max_marks,
        });
      });
    });

    const { error } = await supabase.from("results").upsert(rows, {
      onConflict: "student_id,subject_id,exam_type,exam_year",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Results saved");
    void load();
  };

  const rankOf = (studentId: string) => {
    const sorted = [...students].sort((a, b) => rowTotals(b.id).pct - rowTotals(a.id).pct);
    const idx = sorted.findIndex((s) => s.id === studentId);
    return idx >= 0 ? idx + 1 : 0;
  };

  if (loading) {
    return <p className="text-slate-400">Loading result sheet…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-slate-400">Exam</label>
          <select
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
          >
            {EXAMS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400">Year</label>
          <input
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={examYear}
            onChange={(e) => setExamYear(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => void saveAll()} disabled={saving}>
          {saving ? "Saving…" : "Save all results"}
        </Button>
        <Button variant="secondary" type="button" onClick={() => void handlePrint()}>
          Print sheet
        </Button>
      </div>

      <div ref={printRef} className="overflow-x-auto rounded-xl border border-slate-700">
        <h2 className="no-print mb-4 text-xl font-semibold">
          {className} — {examType} {examYear}
        </h2>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-800/90 text-slate-300">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-800 p-2">Roll</th>
              <th className="p-2 font-mono text-xs">Student ID</th>
              <th className="p-2">Name</th>
              <th className="p-2">Father</th>
              {subjects.map((s) => (
                <th key={s.id} className="p-2 whitespace-nowrap">
                  {s.name}
                </th>
              ))}
              <th className="p-2">Total</th>
              <th className="p-2">%</th>
              <th className="p-2">Grade</th>
              <th className="p-2">Rank</th>
              <th className="p-2">Status</th>
              <th className="no-print p-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const t = rowTotals(s.id);
              const pass = t.status === "Pass";
              return (
                <tr
                  key={s.id}
                  className={pass ? "bg-emerald-950/20" : "bg-red-950/20"}
                >
                  <td className="sticky left-0 z-10 border-t border-slate-700 bg-slate-900 p-2">{s.roll_number}</td>
                  <td className="border-t border-slate-700 p-2 font-mono text-xs font-semibold text-blue-200">
                    {s.student_uid ?? "—"}
                  </td>
                  <td className="border-t border-slate-700 p-2">{s.full_name}</td>
                  <td className="border-t border-slate-700 p-2">{s.father_name}</td>
                  {subjects.map((sub) => (
                    <td key={sub.id} className="border-t border-slate-700 p-1">
                      <input
                        className="w-16 rounded border border-slate-600 bg-slate-900 px-1 py-1 text-center text-sm"
                        value={marks[s.id]?.[sub.id] ?? ""}
                        onChange={(e) => updateCell(s.id, sub.id, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="border-t border-slate-700 p-2">
                    {t.obtained}/{t.max}
                  </td>
                  <td className="border-t border-slate-700 p-2">{t.max ? t.pct.toFixed(1) : "—"}</td>
                  <td className="border-t border-slate-700 p-2">{t.grade}</td>
                  <td className="border-t border-slate-700 p-2">{rankOf(s.id)}</td>
                  <td className="border-t border-slate-700 p-2">{t.status}</td>
                  <td className="no-print border-t border-slate-700 p-2">
                    <Link href={`/results/${classId}/${s.id}`} className="text-blue-400 hover:underline">
                      Card
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
