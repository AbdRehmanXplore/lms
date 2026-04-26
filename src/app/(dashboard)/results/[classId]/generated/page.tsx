"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { calculateGrade } from "@/lib/utils/calculateGrade";
import { FIXED_SUBJECTS } from "@/lib/constants/academics";

type Student = { id: string; roll_number: string; full_name: string; father_name: string };
type ResultRow = { student_id: string; subject_id: string; marks_obtained: number; created_at: string; updated_at: string | null };
type Subject = { id: string; name: string; passing_marks: number; max_marks: number };

function GeneratedResultsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = typeof params.classId === "string" ? params.classId : "";
  const examType = searchParams.get("examType") ?? "Final";
  const examYear = searchParams.get("examYear") ?? String(new Date().getFullYear());
  const supabase = useSupabaseClient();

  const [className, setClassName] = useState("");
  const [rows, setRows] = useState<
    {
      student: Student;
      marksBySubject: Record<string, number>;
      total: number;
      percentage: number;
      grade: string;
      status: "PASS" | "FAIL";
      edited: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderedSubjectNames = useMemo(() => FIXED_SUBJECTS, []);

  useEffect(() => {
    if (!classId) return;
    const load = async () => {
      setLoading(true);
      setError(null);

      const [{ data: cls, error: classError }, { data: students, error: studentError }, { data: subjects, error: subjectError }, { data: results, error: resultError }] =
        await Promise.all([
          supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
          supabase.from("students").select("id,roll_number,full_name,father_name").eq("class_id", classId).order("roll_number"),
          supabase.from("subjects").select("id,name,passing_marks,max_marks").eq("class_id", classId),
          supabase
            .from("results")
            .select("student_id,subject_id,marks_obtained,created_at,updated_at")
            .eq("class_id", classId)
            .eq("exam_type", examType)
            .eq("exam_year", examYear),
        ]);

      if (classError || studentError || subjectError || resultError) {
        setError(classError?.message ?? studentError?.message ?? subjectError?.message ?? resultError?.message ?? "Failed to load generated results");
        setLoading(false);
        return;
      }

      const subjectsByName = new Map<string, Subject>();
      (subjects ?? []).forEach((s) => subjectsByName.set(s.name, s as Subject));
      const orderedSubjects = orderedSubjectNames.map((name) => subjectsByName.get(name)).filter(Boolean) as Subject[];

      const resultsByStudent = new Map<string, ResultRow[]>();
      (results ?? []).forEach((r) => {
        if (!resultsByStudent.has(r.student_id as string)) resultsByStudent.set(r.student_id as string, []);
        resultsByStudent.get(r.student_id as string)?.push(r as ResultRow);
      });

      const normalized = (students ?? [])
        .map((student) => {
          const resultRows = resultsByStudent.get(student.id) ?? [];
          if (resultRows.length < orderedSubjects.length) return null;
          const marksBySubject: Record<string, number> = {};
          let total = 0;
          let status: "PASS" | "FAIL" = "PASS";
          let edited = false;

          for (const subject of orderedSubjects) {
            const entry = resultRows.find((r) => r.subject_id === subject.id);
            if (!entry) return null;
            marksBySubject[subject.name] = Number(entry.marks_obtained);
            total += Number(entry.marks_obtained);
            if (Number(entry.marks_obtained) < subject.passing_marks) status = "FAIL";
            if (entry.updated_at && entry.updated_at !== entry.created_at) edited = true;
          }

          const max = orderedSubjects.reduce((sum, s) => sum + s.max_marks, 0);
          const percentage = max > 0 ? (total / max) * 100 : 0;
          return { student: student as Student, marksBySubject, total, percentage, grade: calculateGrade(percentage), status, edited };
        })
        .filter(Boolean) as {
        student: Student;
        marksBySubject: Record<string, number>;
        total: number;
        percentage: number;
        grade: string;
        status: "PASS" | "FAIL";
        edited: boolean;
      }[];

      setClassName(cls?.name ?? "Class");
      setRows(normalized);
      setLoading(false);
    };
    void load();
  }, [classId, examType, examYear, orderedSubjectNames, supabase]);

  if (!classId) return <p className="text-slate-400">Invalid class.</p>;
  if (loading) return <p className="text-slate-400">Loading generated results…</p>;
  if (error) return <p className="text-red-400">Failed to load generated results: {error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{className} — Generated Results</h1>
          <p className="text-slate-400">
            {examType} {examYear}
          </p>
        </div>
        <Link href={`/results/${classId}`} className="text-sm text-blue-400 hover:underline">
          Back to class results
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[1350px] text-left text-sm">
          <thead className="bg-slate-800/90 text-slate-300">
            <tr>
              <th className="p-3">Roll No</th>
              <th className="p-3">Student Name</th>
              {orderedSubjectNames.map((name) => (
                <th key={name} className="p-3">
                  {name}
                </th>
              ))}
              <th className="p-3">Total</th>
              <th className="p-3">%</th>
              <th className="p-3">Grade</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.student.id} className="border-t border-slate-700">
                <td className="p-3">{row.student.roll_number}</td>
                <td className="p-3">
                  {row.student.full_name}
                  <div className="text-xs text-slate-400">{row.student.father_name}</div>
                </td>
                {orderedSubjectNames.map((name) => (
                  <td key={`${row.student.id}-${name}`} className="p-3">
                    {row.marksBySubject[name]}
                  </td>
                ))}
                <td className="p-3">{row.total}</td>
                <td className="p-3">{row.percentage.toFixed(1)}</td>
                <td className="p-3">{row.grade}</td>
                <td className={`p-3 font-semibold ${row.status === "PASS" ? "text-emerald-400" : "text-red-400"}`}>{row.status}</td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <Link
                      href={`/results/${classId}/${row.student.id}?examType=${encodeURIComponent(examType)}&examYear=${encodeURIComponent(examYear)}`}
                      className="text-blue-400 hover:underline"
                    >
                      Edit Result
                    </Link>
                    <Link
                      href={`/results/${classId}/${row.student.id}?examType=${encodeURIComponent(examType)}&examYear=${encodeURIComponent(examYear)}&print=1`}
                      className="text-emerald-400 hover:underline"
                    >
                      Print
                    </Link>
                    {row.edited && <span className="rounded bg-amber-600/30 px-2 py-0.5 text-xs text-amber-200">Edited</span>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={14}>
                  No fully generated results found for this class and exam.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GeneratedResultsPage() {
  return (
    <Suspense fallback={<p className="text-[var(--text-muted)]">Loading generated results…</p>}>
      <GeneratedResultsContent />
    </Suspense>
  );
}
