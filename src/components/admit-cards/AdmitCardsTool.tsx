"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { useRef } from "react";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Button } from "@/components/ui/Button";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { SchoolLogo } from "@/components/shared/SchoolLogo";

const EXAM_TYPES = ["Monthly", "Mid-Term", "Final"] as const;

type StudentRow = {
  id: string;
  full_name: string;
  father_name: string;
  roll_number: string;
  student_uid: string | null;
  profile_photo: string | null;
  class_id: string | null;
  classes: { name: string } | null;
};

type ScheduleRow = {
  id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  class_id: string | null;
  subjects: { name: string } | null;
};

function fmtTime(t: string) {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

function AdmitCardBody({
  schoolName,
  examType,
  examYear,
  student,
  rows,
  fmtTime: ft,
}: {
  schoolName: string;
  examType: string;
  examYear: string;
  student: StudentRow;
  rows: ScheduleRow[];
  fmtTime: (t: string) => string;
}) {
  return (
    <>
      <div className="mb-3 flex items-start justify-between border-b border-black pb-2">
        <div>
          <div className="flex items-center gap-2">
            <SchoolLogo size={28} className="rounded-md" />
            <h1 className="text-lg font-bold">{schoolName}</h1>
          </div>
          <p className="text-xs">
            Admit Card — {examType} {examYear}
          </p>
        </div>
        <ProfilePhoto src={student.profile_photo} alt="" size={64} variant="card" className="border border-black" />
      </div>
      <div className="grid gap-0.5 text-xs">
        <p>
          <strong>Student ID:</strong> {student.student_uid ?? "—"}
        </p>
        <p>
          <strong>Name:</strong> {student.full_name}
        </p>
        <p>
          <strong>Father:</strong> {student.father_name}
        </p>
        <p>
          <strong>Class:</strong> {student.classes?.name ?? "—"} &nbsp; <strong>Roll:</strong> {student.roll_number}
        </p>
      </div>
      <table className="mt-2 w-full border-collapse border border-black text-[10px]">
        <thead>
          <tr>
            <th className="border border-black p-0.5">Date</th>
            <th className="border border-black p-0.5">Subject</th>
            <th className="border border-black p-0.5">Time</th>
            <th className="border border-black p-0.5">Venue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="border border-black p-0.5">{r.exam_date}</td>
              <td className="border border-black p-0.5">{r.subjects?.name ?? "—"}</td>
              <td className="border border-black p-0.5">
                {ft(r.start_time)} – {ft(r.end_time)}
              </td>
              <td className="border border-black p-0.5">{r.venue ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-[10px]">
        <p className="font-semibold">Instructions</p>
        <ul className="list-inside list-disc">
          <li>Arrive 15 minutes before the paper begins.</li>
          <li>Bring this admit card and your school ID.</li>
          <li>Mobile phones and unfair means are strictly prohibited.</li>
        </ul>
      </div>
      <div className="mt-4 flex justify-end text-xs">
        <p>_________________________</p>
      </div>
      <p className="text-right text-[10px]">Principal / Controller of Examinations</p>
    </>
  );
}

export function AdmitCardsTool() {
  const supabase = useSupabaseClient();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "NEW OXFORD GRAMMER SCHOOL";

  const [examType, setExamType] = useState<string>("Final");
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [classId, setClassId] = useState<string>("");
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [newVenue, setNewVenue] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newClassScope, setNewClassScope] = useState<string>("");
  const [subjectsPick, setSubjectsPick] = useState<{ id: string; name: string }[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void supabase
      .from("classes")
      .select("id,name")
      .order("name")
      .then(({ data }) => setClasses(data ?? []));
  }, [supabase]);

  useEffect(() => {
    if (!newClassScope) {
      setSubjectsPick([]);
      return;
    }
    void supabase
      .from("subjects")
      .select("id,name")
      .eq("class_id", newClassScope)
      .order("name")
      .then(({ data }) => setSubjectsPick(data ?? []));
  }, [newClassScope, supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("exam_schedules")
      .select("id,exam_date,start_time,end_time,venue,class_id,subjects(name)")
      .eq("exam_type", examType)
      .eq("exam_year", examYear)
      .order("exam_date")
      .order("start_time");
    const { data: sch } = await q;
    let list = (sch ?? []) as unknown as ScheduleRow[];
    if (classId) {
      list = list.filter((r) => !r.class_id || r.class_id === classId);
    }
    setSchedules(list);

    let stQ = supabase
      .from("students")
      .select("id,full_name,father_name,roll_number,student_uid,profile_photo,class_id,classes(name)")
      .eq("status", "active")
      .order("roll_number");
    if (classId) stQ = stQ.eq("class_id", classId);
    const { data: studs } = await stQ;
    const norm = (studs ?? []).map((row: Record<string, unknown>) => {
      const cls = row.classes as { name: string } | { name: string }[] | null;
      const cn = Array.isArray(cls) ? cls[0] ?? null : cls;
      return {
        ...row,
        classes: cn,
      } as StudentRow;
    });
    setStudents(norm);
    setLoading(false);
  }, [classId, examType, examYear, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const addScheduleRow = async () => {
    if (!newSubjectId) {
      toast.error("Select a subject");
      return;
    }
    if (!newClassScope) {
      toast.error("Select a class for this exam row");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("exam_schedules").insert({
      exam_type: examType,
      exam_year: examYear,
      class_id: newClassScope,
      subject_id: newSubjectId,
      exam_date: newDate,
      start_time: `${newStart}:00`,
      end_time: `${newEnd}:00`,
      venue: newVenue.trim() || null,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Exam slot added");
    void loadData();
  };

  const cards = useMemo(() => {
    return students.map((s) => {
      const rows = schedules.filter((r) => !r.class_id || r.class_id === s.class_id);
      return { student: s, rows };
    });
  }, [students, schedules]);

  const onGenerate = () => {
    if (schedules.length === 0) {
      toast.error("No exam schedule for these filters. Add rows below or adjust filters.");
      return;
    }
    if (students.length === 0) {
      toast.error("No students for this class filter.");
      return;
    }
    setShowPreview(true);
    toast.success("Preview ready — use Print all");
  };

  return (
    <div className="space-y-8">
      <div className="no-print surface-card grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-xs text-slate-400">Exam type</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
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
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={examYear}
            onChange={(e) => setExamYear(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Class</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="button" onClick={() => void loadData()} disabled={loading}>
            {loading ? "Loading…" : "Load data"}
          </Button>
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-3">
        <Button type="button" onClick={onGenerate}>
          Generate admit cards
        </Button>
        <Button type="button" variant="secondary" disabled={!showPreview} onClick={() => void handlePrint()}>
          Print all
        </Button>
      </div>

      <div className="no-print surface-card p-4">
        <h3 className="mb-3 font-semibold">Add exam schedule row</h3>
        <p className="mb-3 text-sm text-slate-400">
          Rows are stored per class and exam. Students see slots that match their class or school-wide rows (no class).
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-slate-400">Class</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={newClassScope}
              onChange={(e) => {
                setNewClassScope(e.target.value);
                setNewSubjectId("");
              }}
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
            <label className="text-xs text-slate-400">Subject</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
            >
              <option value="">Select</option>
              {subjectsPick.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400">Start</label>
              <input
                type="time"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">End</label>
              <input
                type="time"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-slate-400">Venue</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={newVenue}
              onChange={(e) => setNewVenue(e.target.value)}
              placeholder="Hall / Room"
            />
          </div>
        </div>
        <Button className="mt-3" type="button" disabled={adding} onClick={() => void addScheduleRow()}>
          {adding ? "Adding…" : "Add slot"}
        </Button>
      </div>

      {showPreview && (
        <div ref={printRef}>
          <div className="space-y-6">
            {chunkPairs(cards).map((pair, sheetIdx) => (
              <div
                key={sheetIdx}
                className="flex flex-col gap-4 rounded-xl border border-slate-600 bg-slate-900/40 p-4 print:border-slate-900 print:bg-white print:p-0"
              >
                <div className="admit-a4-sheet hidden print:flex">
                  {pair.map(({ student, rows }) => (
                    <div key={student.id} className="admit-half">
                      <AdmitCardBody
                        schoolName={schoolName}
                        examType={examType}
                        examYear={examYear}
                        student={student}
                        rows={rows}
                        fmtTime={fmtTime}
                      />
                    </div>
                  ))}
                  {pair.length === 1 && <div className="admit-half hidden print:block" aria-hidden />}
                </div>
                <div className="print:hidden">
                  {pair.map(({ student, rows }) => (
                    <div key={student.id} className="mb-4 rounded-xl border border-slate-600 bg-white p-4 text-black">
                      <AdmitCardBody
                        schoolName={schoolName}
                        examType={examType}
                        examYear={examYear}
                        student={student}
                        rows={rows}
                        fmtTime={fmtTime}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
