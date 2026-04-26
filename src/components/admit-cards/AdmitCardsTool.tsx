"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Button } from "@/components/ui/Button";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { SchoolLogo } from "@/components/shared/SchoolLogo";
import { ORDERED_CLASSES, FIXED_SUBJECTS, EXAM_TYPES, EXAM_TYPE_DB_VALUE } from "@/lib/constants/academics";

const SCHOOL_NAME = "NEW OXFORD GRAMMER SCHOOL";

/** Suggestions for venue field (same for all, or type a custom name). */
const VENUE_PRESETS = ["Hall 1", "Hall 2", "Main Hall", "Assembly Hall", "Block A", "Block B", "Science Lab", "Computer Lab"] as const;
const VENUE_DATALIST_ID = "admit-venue-presets";

/** Map fixed display names to possible DB `subjects.name` values */
const SUBJECT_NAME_ALIASES: Record<string, string[]> = {
  Math: ["Math", "Mathematics"],
};

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

type DbScheduleRow = {
  id: string;
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
};

type ScheduleDraftRow = {
  subjectId: string | null;
  displayName: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue: string;
};

function findSubjectIdForFixedName(
  subs: { id: string; name: string }[],
  fixedName: (typeof FIXED_SUBJECTS)[number],
): string | null {
  const aliases = [fixedName, ...(SUBJECT_NAME_ALIASES[fixedName] ?? [])];
  const lower = (s: string) => s.trim().toLowerCase();
  for (const sub of subs) {
    if (aliases.some((a) => lower(a) === lower(sub.name))) return sub.id;
  }
  for (const sub of subs) {
    if (aliases.some((a) => lower(sub.name).includes(lower(a)) || lower(a).includes(lower(sub.name)))) return sub.id;
  }
  return null;
}

function emptyDraftRows(subjectIds: (string | null)[]): ScheduleDraftRow[] {
  return FIXED_SUBJECTS.map((displayName, i) => ({
    subjectId: subjectIds[i] ?? null,
    displayName,
    exam_date: "",
    start_time: "",
    end_time: "",
    venue: "",
  }));
}

function isScheduleRowComplete(r: ScheduleDraftRow): boolean {
  return Boolean(
    r.subjectId &&
      r.exam_date.trim() &&
      r.start_time.trim() &&
      r.end_time.trim() &&
      r.venue.trim(),
  );
}

function incompleteSubjectLabels(rows: ScheduleDraftRow[]): string[] {
  return rows.filter((r) => !isScheduleRowComplete(r)).map((r) => r.displayName);
}

function mergeDraftWithDb(
  base: ScheduleDraftRow[],
  dbRows: DbScheduleRow[],
  subjectIdToDisplay: Map<string, string>,
): ScheduleDraftRow[] {
  const bySubject = new Map<string, DbScheduleRow>();
  dbRows.forEach((r) => bySubject.set(r.subject_id, r));
  return base.map((row) => {
    if (!row.subjectId) return row;
    const d = bySubject.get(row.subjectId);
    if (!d) return row;
    const fmtTime = (t: string) => {
      const s = String(t ?? "").trim();
      if (!s) return "";
      return s.length >= 5 ? s.slice(0, 5) : s;
    };
    return {
      ...row,
      exam_date: d.exam_date?.slice(0, 10) ?? "",
      start_time: fmtTime(String(d.start_time)),
      end_time: fmtTime(String(d.end_time)),
      venue: (d.venue ?? "").trim(),
    };
  });
}

function formatDateDdMmYyyy(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function formatTime12(hhmm: string) {
  if (!hhmm) return "—";
  const parts = hhmm.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Postgres `time` — HH:MM:SS (caller must pass a non-empty valid time) */
function toPgTime(t: string) {
  const s = t.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  throw new Error(`Invalid time: ${t}`);
}

function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

function AdmitCardPrint({
  examTypeLabel,
  examYear,
  student,
  scheduleOrdered,
}: {
  examTypeLabel: string;
  examYear: string;
  student: StudentRow;
  scheduleOrdered: ScheduleDraftRow[];
}) {
  const clsName = student.classes?.name ?? "—";
  return (
    <div className="admit-card-inner flex h-full flex-col border border-black bg-white p-3 text-black">
      <div className="flex items-start justify-between border-b border-black pb-2">
        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-2">
            <SchoolLogo size={36} className="shrink-0 rounded-md" />
            <div>
              <p className="text-[11px] font-bold leading-tight">{SCHOOL_NAME}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide">Examination Admit Card</p>
              <p className="text-[9px] text-neutral-700">
                {examTypeLabel} — {examYear}
              </p>
            </div>
          </div>
        </div>
        <ProfilePhoto src={student.profile_photo} alt="" size={56} variant="card" className="shrink-0 border border-black" />
      </div>

      <div className="mt-2 space-y-0.5 text-[9px] leading-snug">
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
          <strong>Class:</strong> {clsName}
        </p>
        <p>
          <strong>Roll No:</strong> {student.roll_number}
        </p>
      </div>

      <p className="mt-2 text-[9px] font-bold">Examination schedule</p>
      <table className="mt-0.5 w-full border-collapse border border-black text-[8px]">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-black px-0.5 py-0.5 text-left">Date</th>
            <th className="border border-black px-0.5 py-0.5 text-left">Subject</th>
            <th className="border border-black px-0.5 py-0.5">Time</th>
            <th className="border border-black px-0.5 py-0.5">Venue</th>
          </tr>
        </thead>
        <tbody>
          {scheduleOrdered.map((row) => (
            <tr key={row.displayName}>
              <td className="border border-black px-0.5 py-0.5">{row.exam_date ? formatDateDdMmYyyy(row.exam_date) : "—"}</td>
              <td className="border border-black px-0.5 py-0.5">{row.displayName}</td>
              <td className="border border-black px-0.5 py-0.5 text-center">
                {row.exam_date ? `${formatTime12(row.start_time)} – ${formatTime12(row.end_time)}` : "—"}
              </td>
              <td className="border border-black px-0.5 py-0.5">{row.venue || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex-1 text-[8px]">
        <p className="font-bold">Instructions</p>
        <ul className="mt-0.5 list-inside list-disc space-y-0.5">
          <li>Bring this card to every exam</li>
          <li>No card = No entry allowed</li>
          <li>Arrive 15 minutes before exam time</li>
        </ul>
      </div>

      <div className="mt-auto flex justify-between border-t border-black pt-2 text-[8px]">
        <span>Principal: ____________</span>
        <span>Date: ____________</span>
      </div>
    </div>
  );
}

export function AdmitCardsTool() {
  const supabase = useSupabaseClient();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const [examTypeLabel, setExamTypeLabel] = useState<(typeof EXAM_TYPES)[number]>("Final Exam");
  const examTypeDb = EXAM_TYPE_DB_VALUE[examTypeLabel];
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");

  const [dbSubjects, setDbSubjects] = useState<{ id: string; name: string }[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleDraftRow[]>(() => emptyDraftRows(FIXED_SUBJECTS.map(() => null)));

  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  /** Session defaults for times & venue only (dates are per subject) */
  const [quickStart, setQuickStart] = useState("");
  const [quickEnd, setQuickEnd] = useState("");
  const [quickVenue, setQuickVenue] = useState("");

  const className = useMemo(() => classes.find((c) => c.id === classId)?.name ?? "", [classes, classId]);

  useEffect(() => {
    void supabase
      .from("classes")
      .select("id,name")
      .then(({ data }) => {
        const list = data ?? [];
        const order = new Map(ORDERED_CLASSES.map((n, i) => [n, i]));
        setClasses(
          [...list].sort((a, b) => (order.get(a.name) ?? 99) - (order.get(b.name) ?? 99)),
        );
      });
  }, [supabase]);

  const loadScheduleAndDraft = useCallback(async () => {
    if (!classId) {
      setDbSubjects([]);
      setScheduleRows(emptyDraftRows(FIXED_SUBJECTS.map(() => null)));
      setScheduleSaved(false);
      setStudents([]);
      setShowCardPreview(false);
      return;
    }

    setLoadingSchedule(true);
    const { data: subs } = await supabase.from("subjects").select("id,name").eq("class_id", classId).order("name");
    const subjectList = subs ?? [];
    setDbSubjects(subjectList);

    const ids = FIXED_SUBJECTS.map((name) => findSubjectIdForFixedName(subjectList, name));
    let draft = emptyDraftRows(ids);

    const { data: existing } = await supabase
      .from("exam_schedules")
      .select("id,subject_id,exam_date,start_time,end_time,venue")
      .eq("class_id", classId)
      .eq("exam_type", examTypeDb)
      .eq("exam_year", examYear);

    const idToDisplay = new Map<string, string>();
    FIXED_SUBJECTS.forEach((fn, i) => {
      if (ids[i]) idToDisplay.set(ids[i]!, fn);
    });

    if (existing?.length) {
      draft = mergeDraftWithDb(draft, existing as DbScheduleRow[], idToDisplay);
      setScheduleSaved(draft.every(isScheduleRowComplete));
    } else {
      setScheduleSaved(false);
    }

    setScheduleRows(draft);
    setLoadingSchedule(false);

    const { data: studs } = await supabase
      .from("students")
      .select("id,full_name,father_name,roll_number,student_uid,profile_photo,class_id,classes(name)")
      .eq("class_id", classId)
      .eq("status", "active")
      .order("roll_number");

    const norm = (studs ?? []).map((row: Record<string, unknown>) => {
      const cls = row.classes as { name: string } | { name: string }[] | null;
      const cn = Array.isArray(cls) ? cls[0] ?? null : cls;
      return { ...row, classes: cn } as StudentRow;
    });
    setStudents(norm);
  }, [classId, examTypeDb, examYear, supabase]);

  useEffect(() => {
    void loadScheduleAndDraft();
  }, [loadScheduleAndDraft]);

  const updateScheduleRow = (index: number, patch: Partial<ScheduleDraftRow>) => {
    setScheduleRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setShowCardPreview(false);
  };

  const applyTimesAndVenueToAll = () => {
    if (!quickStart.trim() || !quickEnd.trim() || !quickVenue.trim()) {
      toast.error("Set start time, end time, and venue here first, then “Apply to all”");
      return;
    }
    setScheduleRows((prev) =>
      prev.map((r) => ({
        ...r,
        start_time: quickStart,
        end_time: quickEnd,
        venue: quickVenue.trim(),
      })),
    );
    setShowCardPreview(false);
    toast.success("Times and venue applied to all 7 subjects — edit a row if one paper is different");
  };

  const saveSchedule = async () => {
    if (!classId) {
      toast.error("Select a class first");
      return;
    }
    const missingSubjects = scheduleRows.filter((r) => !r.subjectId);
    if (missingSubjects.length > 0) {
      toast.error(
        `Some subjects are not set up for this class in the database: ${missingSubjects.map((r) => r.displayName).join(", ")}. Add them under class subjects.`,
      );
      return;
    }

    const incomplete = incompleteSubjectLabels(scheduleRows);
    if (incomplete.length > 0) {
      toast.error(
        `Every subject needs exam date, start time, end time, and venue (no blanks). Missing or incomplete: ${incomplete.join(", ")}`,
      );
      return;
    }

    setSavingSchedule(true);
    const { error: delErr } = await supabase
      .from("exam_schedules")
      .delete()
      .eq("class_id", classId)
      .eq("exam_type", examTypeDb)
      .eq("exam_year", examYear);

    if (delErr) {
      setSavingSchedule(false);
      toast.error(delErr.message);
      return;
    }

    let inserts: { exam_type: string; exam_year: string; class_id: string; subject_id: string; exam_date: string; start_time: string; end_time: string; venue: string }[];
    try {
      inserts = scheduleRows.map((r) => ({
        exam_type: examTypeDb,
        exam_year: examYear,
        class_id: classId,
        subject_id: r.subjectId!,
        exam_date: r.exam_date.trim(),
        start_time: toPgTime(r.start_time.trim()),
        end_time: toPgTime(r.end_time.trim()),
        venue: r.venue.trim(),
      }));
    } catch {
      setSavingSchedule(false);
      toast.error("Invalid start or end time on one or more rows.");
      return;
    }

    const { error: insErr } = await supabase.from("exam_schedules").insert(inserts);

    setSavingSchedule(false);
    if (insErr) {
      toast.error(insErr.message);
      return;
    }

    toast.success("Schedule saved");
    setScheduleSaved(true);
    setShowCardPreview(false);
    void loadScheduleAndDraft();
  };

  const onGeneratePreview = () => {
    if (!classId) {
      toast.error("Select a class");
      return;
    }
    if (!scheduleSaved) {
      toast.error("Save the exam schedule first");
      return;
    }
    const incomplete = incompleteSubjectLabels(scheduleRows);
    if (incomplete.length > 0) {
      toast.error(`Complete every row (date, start, end, venue) before generating. Incomplete: ${incomplete.join(", ")}`);
      return;
    }
    if (students.length === 0) {
      toast.error("No active students in this class");
      return;
    }
    setShowCardPreview(true);
    toast.success("Admit cards ready — use Print all");
  };

  const orderedScheduleForCards = useMemo(() => {
    return FIXED_SUBJECTS.map((name) => scheduleRows.find((r) => r.displayName === name)).filter(
      (r): r is ScheduleDraftRow => r != null,
    );
  }, [scheduleRows]);

  const cardsData = useMemo(() => {
    return students.map((student) => ({
      student,
      schedule: orderedScheduleForCards,
    }));
  }, [students, orderedScheduleForCards]);

  const missingDbSubjects = scheduleRows.filter((r) => !r.subjectId);

  const scheduleFullyFilled = useMemo(() => scheduleRows.every(isScheduleRowComplete), [scheduleRows]);

  return (
    <div className="admit-cards-page space-y-8">
      {/* Section 1 */}
      <section className="no-print surface-card space-y-4 p-6">
        <h2 className="text-lg font-semibold">1. Class & exam</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Class *</label>
            <select
              required
              className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-3 py-2 text-[var(--text-primary)]"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setShowCardPreview(false);
              }}
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Exam type</label>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-3 py-2"
              value={examTypeLabel}
              onChange={(e) => {
                setExamTypeLabel(e.target.value as (typeof EXAM_TYPES)[number]);
                setShowCardPreview(false);
              }}
            >
              {EXAM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Exam year</label>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-3 py-2"
              value={examYear}
              onChange={(e) => setExamYear(e.target.value)}
            />
          </div>
        </div>
        {loadingSchedule && classId && <p className="text-sm text-[var(--text-muted)]">Loading schedule…</p>}
      </section>

      {/* Section 2 */}
      {classId && (
        <section className="no-print surface-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">2. Exam schedule (per subject)</h2>
          <p className="text-sm text-[var(--text-muted)]">
            All seven subjects must have an <strong>exam date</strong> (per paper), <strong>start time</strong>,{" "}
            <strong>end time</strong>, and <strong>venue</strong>. If times and venue are the same for every paper, use quick fill
            below, then set each date in the table. Save is enabled when every field is filled.
          </p>

          <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] p-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">Quick fill — time &amp; venue only (optional)</p>
            <p className="text-xs text-[var(--text-muted)]">
              Exam days are usually different per subject — enter each date in the table. Use this when start/end time and hall are the
              same for all papers, then adjust any row that differs.
            </p>
            <datalist id={VENUE_DATALIST_ID}>
              {VENUE_PRESETS.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="text-xs text-[var(--text-muted)]">Start (all papers)</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                  value={quickStart}
                  onChange={(e) => setQuickStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">End (all papers)</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                  value={quickEnd}
                  onChange={(e) => setQuickEnd(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="text-xs text-[var(--text-muted)]">Venue (choose or type)</label>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                  list={VENUE_DATALIST_ID}
                  placeholder="e.g. Hall 1 or pick from list"
                  value={quickVenue}
                  onChange={(e) => setQuickVenue(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" className="w-full" variant="secondary" onClick={applyTimesAndVenueToAll}>
                  Apply time &amp; venue to all
                </Button>
              </div>
            </div>
          </div>

          {missingDbSubjects.length > 0 && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Missing subject rows in database for: {missingDbSubjects.map((m) => m.displayName).join(", ")} — add matching subjects
              for this class (e.g. Mathematics maps to Math).
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Exam date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Venue / hall</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row, index) => (
                  <tr key={row.displayName}>
                    <td className="font-medium">{row.displayName}</td>
                    <td>
                      <input
                        type="date"
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-sm"
                        value={row.exam_date}
                        onChange={(e) => updateScheduleRow(index, { exam_date: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-sm"
                        value={row.start_time}
                        onChange={(e) => updateScheduleRow(index, { start_time: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-sm"
                        value={row.end_time}
                        onChange={(e) => updateScheduleRow(index, { end_time: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="w-full min-w-[140px] rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-sm"
                        list={VENUE_DATALIST_ID}
                        placeholder="Required — same or different per row"
                        value={row.venue}
                        onChange={(e) => updateScheduleRow(index, { venue: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            disabled={savingSchedule || missingDbSubjects.length > 0 || !scheduleFullyFilled}
            onClick={() => void saveSchedule()}
          >
            {savingSchedule ? "Saving…" : "Save schedule"}
          </Button>
        </section>
      )}

      {/* Section 3 */}
      {classId && scheduleSaved && (
        <section className="no-print surface-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">3. Students</h2>
          <p className="text-[var(--text-secondary)]">
            <strong>{students.length}</strong> student{students.length === 1 ? "" : "s"} found{className ? ` in ${className}` : ""}.
          </p>
          {loadingSchedule ? (
            <p className="text-sm text-[var(--text-muted)]">Loading students…</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {students.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm"
                >
                  <ProfilePhoto src={s.profile_photo} alt="" size={40} />
                  <span>
                    {s.roll_number} — {s.full_name}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Button type="button" disabled={!scheduleFullyFilled} onClick={onGeneratePreview}>
            Generate &amp; preview admit cards
          </Button>
        </section>
      )}

      {/* Section 4 — print target */}
      {showCardPreview && cardsData.length > 0 && (
        <section className="space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">4. Admit cards</h2>
            <Button type="button" variant="secondary" onClick={() => void handlePrint()}>
              Print all
            </Button>
          </div>

          <div ref={printRef} className="admit-print-root bg-white text-black print:bg-white">
            {/* Screen preview */}
            <div className="no-print space-y-6 p-4 print:hidden">
              {cardsData.map(({ student, schedule }) => (
                <div key={student.id} className="mx-auto max-w-md rounded-xl border border-[var(--border-strong)] bg-white p-4 shadow-sm">
                  <AdmitCardPrint examTypeLabel={examTypeLabel} examYear={examYear} student={student} scheduleOrdered={schedule} />
                </div>
              ))}
            </div>

            {/* Print: 2 cards per A4 (uses global .print-only) */}
            <div className="print-only">
              {chunkPairs(cardsData).map((pair, sheetIdx) => (
                <div key={sheetIdx} className="admit-a4-sheet flex flex-col gap-[4mm]">
                  {pair.map(({ student, schedule }) => (
                    <div key={student.id} className="admit-half min-h-0 flex-1">
                      <AdmitCardPrint examTypeLabel={examTypeLabel} examYear={examYear} student={student} scheduleOrdered={schedule} />
                    </div>
                  ))}
                  {pair.length === 1 ? <div className="admit-half flex-1 border border-dashed border-neutral-300" aria-hidden /> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
