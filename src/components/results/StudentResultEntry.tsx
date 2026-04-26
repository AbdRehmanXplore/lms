"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { calculateGrade } from "@/lib/utils/calculateGrade";
import { Button } from "@/components/ui/Button";
import { EXAM_TYPES, EXAM_TYPE_DB_VALUE, FIXED_SUBJECTS } from "@/lib/constants/academics";
import { SchoolLogo } from "@/components/shared/SchoolLogo";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";

type Subject = { id: string; name: string; max_marks: number; passing_marks: number };

type StudentRow = {
  full_name: string;
  father_name: string;
  roll_number: string;
  student_uid: string | null;
  profile_photo: string | null;
  classes: { name: string } | { name: string }[] | null;
};

type Props = {
  classId: string;
  studentId: string;
  initialExamType?: string;
  initialExamYear?: string;
  autoPrint?: boolean;
};

export function StudentResultEntry({ classId, studentId, initialExamType, initialExamYear, autoPrint = false }: Props) {
  const supabase = useSupabaseClient();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const [examTypeLabel, setExamTypeLabel] = useState<(typeof EXAM_TYPES)[number]>(() => {
    const match = EXAM_TYPES.find((label) => EXAM_TYPE_DB_VALUE[label] === initialExamType);
    return match ?? "Final Exam";
  });
  const [examYear, setExamYear] = useState(initialExamYear ?? String(new Date().getFullYear()));
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [isEdited, setIsEdited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const examType = EXAM_TYPE_DB_VALUE[examTypeLabel];

  const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "NEW OXFORD GRAMMER SCHOOL";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [{ data: s, error: studentError }, { data: subs, error: subjectError }, { data: res, error: resultError }] = await Promise.all([
      supabase
        .from("students")
        .select("full_name,father_name,roll_number,student_uid,profile_photo,classes(name)")
        .eq("id", studentId)
        .maybeSingle(),
      supabase.from("subjects").select("id,name,max_marks,passing_marks").eq("class_id", classId),
      supabase
        .from("results")
        .select("subject_id,marks_obtained,created_at,updated_at")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .eq("exam_type", examType)
        .eq("exam_year", examYear),
    ]);

    if (studentError || subjectError || resultError) {
      setError(studentError?.message ?? subjectError?.message ?? resultError?.message ?? "Failed to load result data");
      setLoading(false);
      return;
    }

    setStudent(s as StudentRow);
    const orderedSubjects = FIXED_SUBJECTS.map((name) => (subs ?? []).find((sub) => sub.name === name)).filter(Boolean) as Subject[];
    setSubjects(orderedSubjects);

    const m: Record<string, string> = {};
    orderedSubjects.forEach((sub) => {
      const row = (res ?? []).find((r) => r.subject_id === sub.id);
      m[sub.id] = row?.marks_obtained != null ? String(row.marks_obtained) : "";
    });
    setIsEdited((res ?? []).some((row) => row.updated_at && row.updated_at !== row.created_at));
    setMarks(m);
    setLoading(false);
  }, [supabase, classId, studentId, examType, examYear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load updates form state from Supabase
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoPrint || loading) return;
    void handlePrint();
  }, [autoPrint, handlePrint, loading]);

  const totals = () => {
    let obtained = 0;
    let hasAllMarks = true;
    let allPass = true;
    subjects.forEach((sub) => {
      const v = parseFloat(marks[sub.id] ?? "");
      if (Number.isNaN(v)) {
        hasAllMarks = false;
        allPass = false;
      } else {
        obtained += v;
        if (v < sub.passing_marks) {
          allPass = false;
        }
      }
    });
    const max = subjects.reduce((sum, s) => sum + s.max_marks, 0);
    const pct = max > 0 ? (obtained / max) * 100 : 0;
    return { obtained, max, pct, grade: calculateGrade(pct), status: hasAllMarks && allPass ? "PASS" : "FAIL" };
  };

  const save = async (printAfterSave = false) => {
    setSaving(true);
    const rows: Record<string, unknown>[] = [];
    subjects.forEach((sub) => {
      const raw = marks[sub.id]?.trim();
      if (raw === "" || raw === undefined) return;
      const m = parseFloat(raw);
      if (Number.isNaN(m)) return;
      rows.push({
        student_id: studentId,
        class_id: classId,
        subject_id: sub.id,
        exam_type: examType,
        exam_year: examYear,
        marks_obtained: m,
        max_marks: sub.max_marks,
      });
    });
    if (rows.length === 0) {
      setSaving(false);
      toast.error("Please enter marks before saving.");
      return;
    }
    const { error } = await supabase.from("results").upsert(rows, {
      onConflict: "student_id,subject_id,exam_type,exam_year",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEdited ? "Result updated successfully" : "Result saved successfully");
    void load();
    if (printAfterSave) {
      void handlePrint();
    }
  };

  if (loading || !student) {
    return <p className="text-slate-400">Loading…</p>;
  }
  if (error) {
    return <p className="text-red-400">Failed to load result sheet: {error}</p>;
  }

  const cls = student.classes;
  const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
  const t = totals();

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap gap-4">
        <div>
          <label className="text-xs text-slate-400">Exam</label>
          <select
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={examTypeLabel}
            onChange={(e) => setExamTypeLabel(e.target.value as (typeof EXAM_TYPES)[number])}
          >
            {EXAM_TYPES.map((e) => (
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
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save Result"}
        </Button>
        <Button variant="secondary" type="button" onClick={() => void save(true)} disabled={saving}>
          Save & Print
        </Button>
      </div>

      <div className="surface-card no-print space-y-1 p-4">
        <h2 className="text-xl font-semibold">Student Result Sheet</h2>
        <p><span className="text-slate-400">Student ID:</span> <span className="font-mono text-blue-200">{student.student_uid ?? "—"}</span></p>
        <p><span className="text-slate-400">Name:</span> {student.full_name}</p>
        <p><span className="text-slate-400">Father Name:</span> {student.father_name}</p>
        <p><span className="text-slate-400">Class:</span> {className ?? "—"}</p>
        <p><span className="text-slate-400">Roll No:</span> {student.roll_number}</p>
        <p><span className="text-slate-400">Exam Type:</span> {examTypeLabel}</p>
        <p><span className="text-slate-400">Year:</span> {examYear}</p>
        {isEdited && <span className="inline-block rounded bg-amber-600/30 px-2 py-1 text-xs text-amber-200">Edited</span>}
      </div>

      <div className="no-print overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className="p-2 text-left">Subject</th>
              <th className="p-2">Max</th>
              <th className="p-2">Obtained</th>
              <th className="p-2">Pass/Fail</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub) => {
              const v = parseFloat(marks[sub.id] ?? "");
              const ok = !Number.isNaN(v) && v >= sub.passing_marks;
              return (
                <tr key={sub.id} className="border-t border-slate-700">
                  <td className="p-2">{sub.name}</td>
                  <td className="p-2 text-center">{sub.max_marks}</td>
                  <td className="p-2">
                    <input
                      className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-center"
                      type="number"
                      min={0}
                      max={sub.max_marks}
                      value={marks[sub.id] ?? ""}
                      onChange={(e) => setMarks((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                    />
                  </td>
                  <td className={`p-2 text-center font-semibold ${Number.isNaN(v) ? "" : ok ? "text-emerald-400" : "text-red-400"}`}>
                    {Number.isNaN(v) ? "—" : ok ? "PASS" : "FAIL"}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-slate-700 bg-slate-800/40">
              <td className="p-2 font-semibold">TOTAL</td>
              <td className="p-2 text-center font-semibold">{t.max}</td>
              <td className="p-2 text-center font-semibold">{t.obtained}</td>
              <td className={`p-2 text-center font-semibold ${t.status === "PASS" ? "text-emerald-400" : "text-red-400"}`}>{t.status}</td>
            </tr>
            <tr className="border-t border-slate-700 bg-slate-800/40">
              <td className="p-2 font-semibold">PERCENTAGE</td>
              <td className="p-2 text-center">—</td>
              <td className="p-2 text-center font-semibold">{t.max ? `${t.pct.toFixed(1)}%` : "—"}</td>
              <td className="p-2 text-center"> </td>
            </tr>
            <tr className="border-t border-slate-700 bg-slate-800/40">
              <td className="p-2 font-semibold">GRADE</td>
              <td className="p-2 text-center">—</td>
              <td className="p-2 text-center font-semibold">{t.grade}</td>
              <td className="p-2 text-center"> </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div ref={printRef} className="print-only print-card">
        <div className="text-center">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SchoolLogo size={36} className="rounded-md" />
              <h2 className="text-xl font-bold">{schoolName}</h2>
            </div>
            <ProfilePhoto src={student.profile_photo} alt={student.full_name} name={student.full_name} size={64} className="border border-black" />
          </div>
          <p className="mt-1 font-semibold">STUDENT RESULT CARD</p>
          <p className="mt-1">{examTypeLabel} — {examYear}</p>
        </div>
        <div className="mt-4 space-y-1 text-sm">
          <p><strong>Student ID :</strong> {student.student_uid ?? "—"}</p>
          <p><strong>Name :</strong> {student.full_name}</p>
          <p><strong>Father Name :</strong> {student.father_name}</p>
          <p><strong>Class :</strong> {className ?? "—"}</p>
          <p><strong>Roll No :</strong> {student.roll_number}</p>
        </div>
        <table className="mt-4 w-full border-collapse border border-black text-sm">
          <thead>
            <tr>
              <th className="border border-black p-1">Subject</th>
              <th className="border border-black p-1">Max</th>
              <th className="border border-black p-1">Obtained</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub) => {
              const v = parseFloat(marks[sub.id] ?? "");
              return (
                <tr key={sub.id}>
                  <td className="border border-black p-1">{sub.name}</td>
                  <td className="border border-black p-1 text-center">{sub.max_marks}</td>
                  <td className="border border-black p-1 text-center">{Number.isNaN(v) ? "—" : v}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 grid gap-1 text-sm">
          <p><strong>Total:</strong> {t.max} / {t.obtained}</p>
          <p><strong>Percentage:</strong> {t.max ? t.pct.toFixed(1) : "—"}%</p>
          <p><strong>Grade:</strong> {t.grade}</p>
          <p><strong>Result:</strong> {t.status}</p>
          <div className="mt-4 grid grid-cols-2 gap-8">
            <p>Class Teacher: _________</p>
            <p>Principal: _____________</p>
          </div>
          <p>Date: ___________</p>
        </div>
      </div>
    </div>
  );
}
