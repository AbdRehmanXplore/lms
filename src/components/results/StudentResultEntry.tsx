"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { calculateGrade } from "@/lib/utils/calculateGrade";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EXAM_TYPES, EXAM_TYPE_DB_VALUE, FIXED_SUBJECTS } from "@/lib/constants/academics";
import { SchoolLogo } from "@/components/shared/SchoolLogo";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { useSchoolBranding } from "@/components/providers/SchoolBrandingProvider";
import { getRankSuffix } from "@/lib/utils/studentIdentifiers";

type Subject = { id: string; name: string; max_marks: number; passing_marks: number };

type StudentRow = {
  full_name: string;
  father_name: string;
  roll_number: string;
  student_uid: string | null;
  gr_number: string | null;
  section: string | null;
  profile_photo: string | null;
  classes: { name: string } | { name: string }[] | null;
};

type ResultRow = {
  subject_id: string;
  student_id: string;
  marks_obtained: number;
  remarks: string | null;
  total_attendance: number | null;
  present_attendance: number | null;
  rank_in_class: number | null;
  created_at: string | null;
  updated_at: string | null;
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
  const [remarks, setRemarks] = useState("");
  const [totalAttendance, setTotalAttendance] = useState("");
  const [presentAttendance, setPresentAttendance] = useState("");
  const [classRank, setClassRank] = useState(0);
  const [isEdited, setIsEdited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const examType = EXAM_TYPE_DB_VALUE[examTypeLabel];
  const { schoolName, logoUrl } = useSchoolBranding();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [
      { data: studentData, error: studentError },
      { data: subjectRows, error: subjectError },
      { data: studentResultRows, error: studentResultError },
      { data: classResultRows, error: classResultError },
      { data: attendanceRows, error: attendanceError },
    ] = await Promise.all([
      supabase
        .from("students")
        .select("full_name,father_name,roll_number,student_uid,gr_number,section,profile_photo,classes(name)")
        .eq("id", studentId)
        .maybeSingle(),
      supabase.from("subjects").select("id,name,max_marks,passing_marks").eq("class_id", classId),
      supabase
        .from("results")
        .select("subject_id,student_id,marks_obtained,remarks,total_attendance,present_attendance,rank_in_class,created_at,updated_at")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .eq("exam_type", examType)
        .eq("exam_year", examYear),
      supabase
        .from("results")
        .select("student_id,subject_id,marks_obtained")
        .eq("class_id", classId)
        .eq("exam_type", examType)
        .eq("exam_year", examYear),
      supabase.from("attendance").select("status").eq("student_id", studentId),
    ]);

    if (studentError || subjectError || studentResultError || classResultError || attendanceError) {
      setError(
        studentError?.message ??
          subjectError?.message ??
          studentResultError?.message ??
          classResultError?.message ??
          attendanceError?.message ??
          "Failed to load result data",
      );
      setLoading(false);
      return;
    }

    setStudent(studentData as StudentRow);

    const orderedSubjects = FIXED_SUBJECTS.map((name) => (subjectRows ?? []).find((sub) => sub.name === name)).filter(Boolean) as Subject[];
    setSubjects(orderedSubjects);

    const marksMap: Record<string, string> = {};
    orderedSubjects.forEach((sub) => {
      const row = (studentResultRows as ResultRow[] | null)?.find((result) => result.subject_id === sub.id);
      marksMap[sub.id] = row?.marks_obtained != null ? String(row.marks_obtained) : "";
    });
    setMarks(marksMap);

    const firstResult = (studentResultRows as ResultRow[] | null)?.[0];
    const presentCount = (attendanceRows ?? []).filter((row) => row.status === "present" || row.status === "late").length;
    setRemarks(firstResult?.remarks ?? "");
    setTotalAttendance(String(firstResult?.total_attendance ?? (attendanceRows?.length ?? 0)));
    setPresentAttendance(String(firstResult?.present_attendance ?? presentCount));
    setIsEdited(Boolean((studentResultRows ?? []).some((row) => row.updated_at && row.updated_at !== row.created_at)));

    const totalsMap = new Map<string, number>();
    for (const row of classResultRows ?? []) {
      const key = String(row.student_id);
      totalsMap.set(key, (totalsMap.get(key) ?? 0) + Number(row.marks_obtained ?? 0));
    }
    const ranked = [...totalsMap.entries()].sort((a, b) => b[1] - a[1]);
    setClassRank(Math.max(ranked.findIndex(([id]) => id === studentId) + 1, 0));

    setLoading(false);
  }, [supabase, classId, studentId, examType, examYear]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoPrint || loading) return;
    void handlePrint();
  }, [autoPrint, handlePrint, loading]);

  const totals = useMemo(() => {
    let obtained = 0;
    let hasAllMarks = true;
    let allPass = true;
    subjects.forEach((sub) => {
      const value = parseFloat(marks[sub.id] ?? "");
      if (Number.isNaN(value)) {
        hasAllMarks = false;
        allPass = false;
      } else {
        obtained += value;
        if (value < sub.passing_marks) {
          allPass = false;
        }
      }
    });
    const max = subjects.reduce((sum, sub) => sum + sub.max_marks, 0);
    const pct = max > 0 ? (obtained / max) * 100 : 0;
    return { obtained, max, pct, grade: calculateGrade(pct), status: hasAllMarks && allPass ? "Passed" : "Failed" };
  }, [marks, subjects]);

  const save = async (printAfterSave = false) => {
    setSaving(true);
    const rows: Record<string, unknown>[] = [];
    const parsedTotalAttendance = Number(totalAttendance || 0);
    const parsedPresentAttendance = Number(presentAttendance || 0);

    subjects.forEach((sub) => {
      const raw = marks[sub.id]?.trim();
      if (raw === "" || raw === undefined) return;
      const obtained = parseFloat(raw);
      if (Number.isNaN(obtained)) return;
      rows.push({
        student_id: studentId,
        class_id: classId,
        subject_id: sub.id,
        exam_type: examType,
        exam_year: examYear,
        marks_obtained: obtained,
        max_marks: sub.max_marks,
        remarks: remarks.trim() || null,
        total_attendance: parsedTotalAttendance,
        present_attendance: parsedPresentAttendance,
        rank_in_class: classRank || null,
      });
    });

    if (rows.length === 0) {
      setSaving(false);
      toast.error("Please enter marks before saving.");
      return;
    }

    const { error: upsertError } = await supabase.from("results").upsert(rows, {
      onConflict: "student_id,subject_id,exam_type,exam_year",
    });

    setSaving(false);
    if (upsertError) {
      toast.error(upsertError.message);
      return;
    }

    toast.success(isEdited ? "Result updated successfully" : "Result saved successfully");
    await load();
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
  const examHeading = examTypeLabel === "Final Exam" ? `Annual Examination ${examYear}-${Number(examYear) + 1}` : `${examTypeLabel} ${examYear}`;

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

      <div className="surface-card no-print space-y-4 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p><span className="text-slate-400">Student Name:</span> {student.full_name}</p>
            <p><span className="text-slate-400">Father Name:</span> {student.father_name}</p>
            <p><span className="text-slate-400">G.R. No.:</span> <span className="font-mono text-amber-200">{student.gr_number ?? "—"}</span></p>
            <p><span className="text-slate-400">Roll #:</span> {student.roll_number}</p>
            <p><span className="text-slate-400">Class:</span> {className ?? "—"} · <span className="text-slate-400">Section:</span> {student.section ?? "A"}</p>
          </div>
          <div className="grid gap-3">
            <Input label="Attendance (Total Days)" value={totalAttendance} onChange={(e) => setTotalAttendance(e.target.value)} />
            <Input label="Attendance (Present Days)" value={presentAttendance} onChange={(e) => setPresentAttendance(e.target.value)} />
            <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        {isEdited && <span className="inline-block rounded bg-amber-600/30 px-2 py-1 text-xs text-amber-200">Edited</span>}
      </div>

      <div className="no-print overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className="p-2 text-left">Subject</th>
              <th className="p-2">Max</th>
              <th className="p-2">Obtained</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub) => (
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
              </tr>
            ))}
            <tr className="border-t border-slate-700 bg-slate-800/40">
              <td className="p-2 font-semibold">Grand Total</td>
              <td className="p-2 text-center font-semibold">{totals.max}</td>
              <td className="p-2 text-center font-semibold">{totals.obtained}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div ref={printRef} className="print-only print-card bg-white text-black">
        <div className="border border-black">
          <div className="border-b border-black px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold leading-tight">New</p>
                <p className="text-2xl font-bold leading-tight">{schoolName}</p>
              </div>
              <div className="flex items-center gap-3">
                <SchoolLogo size={52} className="rounded-md" logoUrl={logoUrl} />
                <ProfilePhoto src={student.profile_photo} alt={student.full_name} name={student.full_name} size={72} className="border border-black" />
              </div>
            </div>
            <p className="mt-3 text-center text-lg font-semibold">{examHeading}</p>
          </div>

          <div className="border-b border-black px-4 py-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <p><strong>Student Name:</strong> {student.full_name}</p>
              <p><strong>Class:</strong> {className ?? "—"}</p>
              <p><strong>Father Name:</strong> {student.father_name}</p>
              <p><strong>G.R. No.:</strong> {student.gr_number ?? "—"}</p>
              <p><strong>Roll#:</strong> {student.roll_number}</p>
              <p><strong>Section:</strong> {student.section ?? "A"}</p>
            </div>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-r border-black px-3 py-2 text-left">SUBJECT(S)</th>
                <th className="border-b border-r border-black px-3 py-2">MAX MARKS</th>
                <th className="border-b border-black px-3 py-2">OBTAINED</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub) => {
                const value = parseFloat(marks[sub.id] ?? "");
                return (
                  <tr key={sub.id}>
                    <td className="border-b border-r border-black px-3 py-2">{sub.name}</td>
                    <td className="border-b border-r border-black px-3 py-2 text-center">{sub.max_marks}</td>
                    <td className="border-b border-black px-3 py-2 text-center">{Number.isNaN(value) ? "—" : value}</td>
                  </tr>
                );
              })}
              <tr>
                <td className="border-r border-black px-3 py-2 font-semibold">Grand Total</td>
                <td className="border-r border-black px-3 py-2 text-center font-semibold">{totals.max}</td>
                <td className="px-3 py-2 text-center font-semibold">{totals.obtained}</td>
              </tr>
            </tbody>
          </table>

          <div className="border-t border-black px-4 py-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <p><strong>Percentage:</strong> {totals.max ? totals.pct.toFixed(2) : "0.00"}</p>
              <p><strong>Grade:</strong> {totals.grade}</p>
              <p><strong>Rank:</strong> {classRank ? getRankSuffix(classRank) : "—"}</p>
              <p><strong>Result:</strong> {totals.status}</p>
              <p className="col-span-2"><strong>Attendance:</strong> {totalAttendance || "0"}/{presentAttendance || "0"}</p>
            </div>
          </div>

          <div className="border-t border-black px-4 py-3 text-sm">
            <strong>REMARKS:</strong> {remarks || "—"}
          </div>

          <div className="grid grid-cols-3 gap-4 px-4 py-6 text-center text-sm">
            <p>Parent&apos;s Sign</p>
            <p>Teacher Sign</p>
            <p>Principal</p>
          </div>
        </div>
      </div>
    </div>
  );
}
