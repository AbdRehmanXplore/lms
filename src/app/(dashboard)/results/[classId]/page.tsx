"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { EXAM_TYPES, EXAM_TYPE_DB_VALUE, FIXED_SUBJECTS } from "@/lib/constants/academics";
import { calculateGrade } from "@/lib/utils/calculateGrade";
import { StudentResultEntry } from "@/components/results/StudentResultEntry";

export default function ClassResultsPage() {
  const params = useParams();
  const classId = typeof params.classId === "string" ? params.classId : "";
  const supabase = useSupabaseClient();
  const [className, setClassName] = useState("");
  const [examTypeLabel, setExamTypeLabel] = useState<(typeof EXAM_TYPES)[number]>("Final Exam");
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [students, setStudents] = useState<
    { id: string; roll_number: string; full_name: string; father_name: string; resultStatus: "Generated" | "Pending" }[]
  >([]);
  const [generatedRows, setGeneratedRows] = useState<
    {
      studentId: string;
      rollNo: string;
      fullName: string;
      fatherName: string;
      marksBySubject: Record<string, number>;
      total: number;
      percentage: number;
      grade: string;
      status: "PASS" | "FAIL";
      edited: boolean;
    }[]
  >([]);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const examType = useMemo(() => EXAM_TYPE_DB_VALUE[examTypeLabel], [examTypeLabel]);

  useEffect(() => {
    if (!classId) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [
        { data: cls, error: classError },
        { data: studentRows, error: studentError },
        { data: subjectRows, error: subjectError },
        { data: resultRows, error: resultError },
      ] =
        await Promise.all([
          supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
          supabase
            .from("students")
            .select("id,roll_number,full_name,father_name")
            .eq("class_id", classId)
            .order("roll_number")
            .limit(100),
          supabase.from("subjects").select("id,name,passing_marks,max_marks").eq("class_id", classId),
          supabase
            .from("results")
            .select("student_id,subject_id,marks_obtained,created_at,updated_at")
            .eq("class_id", classId)
            .eq("exam_type", examType)
            .eq("exam_year", examYear),
        ]);

      if (classError || studentError || resultError || subjectError) {
        setError(classError?.message ?? studentError?.message ?? resultError?.message ?? subjectError?.message ?? "Failed to load class results");
        setLoading(false);
        return;
      }

      const subjectMap = new Map<string, Set<string>>();
      (resultRows ?? []).forEach((row) => {
        if (!subjectMap.has(row.student_id as string)) {
          subjectMap.set(row.student_id as string, new Set());
        }
        subjectMap.get(row.student_id as string)?.add(row.subject_id as string);
      });

      setClassName(cls?.name ?? "Class");
      setStudents(
        (studentRows ?? []).map((s) => ({
          ...s,
          resultStatus: (subjectMap.get(s.id)?.size ?? 0) >= FIXED_SUBJECTS.length ? "Generated" : "Pending",
        })),
      );
      const subjectsByName: Record<string, { id: string; max_marks: number; passing_marks: number }> = {};
      (subjectRows ?? []).forEach((sub) => {
        subjectsByName[sub.name] = sub;
      });
      const selectedSubjects = FIXED_SUBJECTS.map((name) => subjectsByName[name]).filter(Boolean);
      const byStudent = new Map<string, (typeof resultRows)[number][]>();
      (resultRows ?? []).forEach((r) => {
        const k = String(r.student_id);
        if (!byStudent.has(k)) byStudent.set(k, []);
        byStudent.get(k)?.push(r);
      });
      const resultByStudentSubject = new Map<string, (typeof resultRows)[number]>();
      (resultRows ?? []).forEach((r) => {
        resultByStudentSubject.set(`${r.student_id}|${r.subject_id}`, r);
      });
      const generated = (studentRows ?? [])
        .map((s) => {
          const studentResultRows = byStudent.get(s.id) ?? [];
          if (studentResultRows.length < selectedSubjects.length) return null;
          const marksBySubject: Record<string, number> = {};
          let total = 0;
          let status: "PASS" | "FAIL" = "PASS";
          let edited = false;
          for (const subName of FIXED_SUBJECTS) {
            const subject = subjectsByName[subName];
            if (!subject) return null;
            const row = resultByStudentSubject.get(`${s.id}|${subject.id}`);
            if (!row) return null;
            const marks = Number(row.marks_obtained);
            marksBySubject[subName] = marks;
            total += marks;
            if (marks < subject.passing_marks) status = "FAIL";
            if (row.updated_at && row.updated_at !== row.created_at) edited = true;
          }
          const max = selectedSubjects.reduce((sum, sub) => sum + sub.max_marks, 0);
          const percentage = max > 0 ? (total / max) * 100 : 0;
          return {
            studentId: s.id,
            rollNo: s.roll_number,
            fullName: s.full_name,
            fatherName: s.father_name,
            marksBySubject,
            total,
            percentage,
            grade: calculateGrade(percentage),
            status,
            edited,
          };
        })
        .filter(Boolean) as {
        studentId: string;
        rollNo: string;
        fullName: string;
        fatherName: string;
        marksBySubject: Record<string, number>;
        total: number;
        percentage: number;
        grade: string;
        status: "PASS" | "FAIL";
        edited: boolean;
      }[];
      setGeneratedRows(generated);
      setLoading(false);
    };

    void load();
  }, [classId, examType, examYear, supabase]);

  if (!classId) {
    return <p className="text-slate-400">Invalid class.</p>;
  }

  if (loading) {
    return <p className="text-slate-400">Loading class results…</p>;
  }

  if (error) {
    return <p className="text-red-400">Failed to load class results: {error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">{className || "Class"} Results</h1>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-xs text-slate-400">Exam Type</label>
          <select
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={examTypeLabel}
            onChange={(e) => setExamTypeLabel(e.target.value as (typeof EXAM_TYPES)[number])}
          >
            {EXAM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
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
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Generate Result</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-800/90 text-slate-300">
            <tr>
              <th className="p-3">Roll No</th>
              <th className="p-3">Student Name</th>
              <th className="p-3">Father Name</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-slate-700">
                <td className="p-3">{s.roll_number}</td>
                <td className="p-3">{s.full_name}</td>
                <td className="p-3">{s.father_name}</td>
                <td className="p-3">
                  <button type="button" className="text-blue-400 hover:underline" onClick={() => setActiveStudentId(s.id)}>
                    {s.resultStatus === "Generated" ? "Edit Result" : "Generate Result"}
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={4} className="p-3 text-slate-500">
                  No students found in this class.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>

      {activeStudentId && (
        <div className="rounded-xl border border-slate-700 p-4">
          <StudentResultEntry classId={classId} studentId={activeStudentId} initialExamType={examType} initialExamYear={examYear} />
        </div>
      )}

      <hr className="border-slate-700" />
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">All Generated Results — {className}</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full min-w-[1400px] text-left text-sm">
            <thead className="bg-slate-800/90 text-slate-300">
              <tr>
                <th className="p-3">Roll No</th>
                <th className="p-3">Name</th>
                {FIXED_SUBJECTS.map((subject) => (
                  <th key={subject} className="p-3">{subject}</th>
                ))}
                <th className="p-3">Total</th>
                <th className="p-3">%</th>
                <th className="p-3">Grade</th>
                <th className="p-3">Pass/Fail</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {generatedRows.map((row) => (
                <tr key={row.studentId} className="border-t border-slate-700">
                  <td className="p-3">{row.rollNo}</td>
                  <td className="p-3">
                    {row.fullName}
                    <div className="text-xs text-slate-400">{row.fatherName}</div>
                  </td>
                  {FIXED_SUBJECTS.map((subject) => (
                    <td key={`${row.studentId}-${subject}`} className="p-3">{row.marksBySubject[subject]}</td>
                  ))}
                  <td className="p-3">{row.total}</td>
                  <td className="p-3">{row.percentage.toFixed(1)}</td>
                  <td className="p-3">{row.grade}</td>
                  <td className={`p-3 ${row.status === "PASS" ? "text-emerald-400" : "text-red-400"}`}>{row.status}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <button type="button" className="text-blue-400 hover:underline" onClick={() => setActiveStudentId(row.studentId)}>
                        Edit
                      </button>
                      <Link
                        href={`/results/${classId}/${row.studentId}?examType=${encodeURIComponent(examType)}&examYear=${encodeURIComponent(examYear)}&print=1`}
                        className="text-emerald-400 hover:underline"
                      >
                        Print
                      </Link>
                      {row.edited && <span className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-300">Edited</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {generatedRows.length === 0 && (
                <tr>
                  <td colSpan={14} className="p-3 text-slate-500">
                    No generated results for selected exam and year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
