"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { EXAM_TYPES, EXAM_TYPE_DB_VALUE, FIXED_SUBJECTS } from "@/lib/constants/academics";
import { calculateGrade } from "@/lib/utils/calculateGrade";
import { StudentResultEntry } from "@/components/results/StudentResultEntry";
import { getRankSuffix } from "@/lib/utils/studentIdentifiers";

type GeneratedRow = {
  studentId: string;
  grNumber: string | null;
  rollNo: string;
  fullName: string;
  section: string | null;
  total: number;
  percentage: number;
  grade: string;
  rank: number;
};

export default function ClassResultsPage() {
  const params = useParams();
  const classId = typeof params.classId === "string" ? params.classId : "";
  const supabase = useSupabaseClient();
  const [className, setClassName] = useState("");
  const [examTypeLabel, setExamTypeLabel] = useState<(typeof EXAM_TYPES)[number]>("Final Exam");
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [students, setStudents] = useState<
    { id: string; gr_number: string | null; roll_number: string; full_name: string; father_name: string; section: string | null; resultStatus: "Generated" | "Pending" }[]
  >([]);
  const [generatedRows, setGeneratedRows] = useState<GeneratedRow[]>([]);
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
      ] = await Promise.all([
        supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
        supabase
          .from("students")
          .select("id,gr_number,roll_number,full_name,father_name,section")
          .eq("class_id", classId)
          .order("roll_number")
          .limit(100),
        supabase.from("subjects").select("id,name,max_marks").eq("class_id", classId),
        supabase
          .from("results")
          .select("student_id,subject_id,marks_obtained")
          .eq("class_id", classId)
          .eq("exam_type", examType)
          .eq("exam_year", examYear),
      ]);

      if (classError || studentError || subjectError || resultError) {
        setError(classError?.message ?? studentError?.message ?? subjectError?.message ?? resultError?.message ?? "Failed to load class results");
        setLoading(false);
        return;
      }

      setClassName(cls?.name ?? "Class");

      const selectedSubjects = FIXED_SUBJECTS.map((name) => (subjectRows ?? []).find((subject) => subject.name === name)).filter(
        (subject): subject is NonNullable<(typeof subjectRows)[number]> => Boolean(subject),
      );
      const resultCounts = new Map<string, number>();
      const totalByStudent = new Map<string, number>();

      for (const row of resultRows ?? []) {
        const studentIdKey = String(row.student_id);
        resultCounts.set(studentIdKey, (resultCounts.get(studentIdKey) ?? 0) + 1);
        totalByStudent.set(studentIdKey, (totalByStudent.get(studentIdKey) ?? 0) + Number(row.marks_obtained ?? 0));
      }

      setStudents(
        (studentRows ?? []).map((student) => ({
          ...student,
          resultStatus: (resultCounts.get(student.id) ?? 0) >= selectedSubjects.length ? "Generated" : "Pending",
        })),
      );

      const maxTotal = selectedSubjects.reduce((sum, subject) => sum + Number(subject.max_marks ?? 0), 0);
      const ranked = [...totalByStudent.entries()].sort((a, b) => b[1] - a[1]);

      setGeneratedRows(
        ranked
          .map(([studentIdKey, total], index) => {
            const student = (studentRows ?? []).find((row) => row.id === studentIdKey);
            if (!student) return null;
            const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
            return {
              studentId: student.id,
              grNumber: student.gr_number,
              rollNo: student.roll_number,
              fullName: student.full_name,
              section: student.section,
              total,
              percentage,
              grade: calculateGrade(percentage),
              rank: index + 1,
            } satisfies GeneratedRow;
          })
          .filter((row): row is GeneratedRow => Boolean(row)),
      );

      setLoading(false);
    };

    void load();
  }, [classId, examType, examYear, supabase]);

  if (!classId) return <p className="text-slate-400">Invalid class.</p>;
  if (loading) return <p className="text-slate-400">Loading class results…</p>;
  if (error) return <p className="text-red-400">Failed to load class results: {error}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{className || "Class"} Results</h1>

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
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-800/90 text-slate-300">
              <tr>
                <th className="p-3">GR#</th>
                <th className="p-3">Roll No</th>
                <th className="p-3">Student Name</th>
                <th className="p-3">Father Name</th>
                <th className="p-3">Section</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-slate-700">
                  <td className="p-3 font-mono text-amber-300">{student.gr_number ?? "—"}</td>
                  <td className="p-3">{student.roll_number}</td>
                  <td className="p-3">{student.full_name}</td>
                  <td className="p-3">{student.father_name}</td>
                  <td className="p-3">{student.section ?? "A"}</td>
                  <td className="p-3">
                    <button type="button" className="text-blue-400 hover:underline" onClick={() => setActiveStudentId(student.id)}>
                      {student.resultStatus === "Generated" ? "Edit Result" : "Generate Result"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {activeStudentId && (
        <div className="rounded-xl border border-slate-700 p-4">
          <StudentResultEntry classId={classId} studentId={activeStudentId} initialExamType={examType} initialExamYear={examYear} />
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Generated Results</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-800/90 text-slate-300">
              <tr>
                <th className="p-3">GR#</th>
                <th className="p-3">Name</th>
                <th className="p-3">Section</th>
                <th className="p-3">Total</th>
                <th className="p-3">%</th>
                <th className="p-3">Grade</th>
                <th className="p-3">Rank</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {generatedRows.map((row) => (
                <tr key={row.studentId} className="border-t border-slate-700">
                  <td className="p-3 font-mono text-amber-300">{row.grNumber ?? "—"}</td>
                  <td className="p-3">{row.fullName}</td>
                  <td className="p-3">{row.section ?? "A"}</td>
                  <td className="p-3">{row.total}</td>
                  <td className="p-3">{row.percentage.toFixed(2)}</td>
                  <td className="p-3">{row.grade}</td>
                  <td className="p-3">{getRankSuffix(row.rank)}</td>
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
                    </div>
                  </td>
                </tr>
              ))}
              {generatedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-3 text-slate-500">
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
