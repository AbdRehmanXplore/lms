"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { scheduleEffectLoad } from "@/lib/utils/scheduleEffectLoad";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

type ClassRow = { id: string; name: string };
type SubjectRow = { id: string; name: string; class_id: string };
type TeacherRow = { id: string; full_name: string | null; employee_code: string };
type Cell = {
  id?: string;
  subject_id: string | null;
  teacher_id: string | null;
  room: string | null;
  start_time: string;
  end_time: string;
};

function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function defaultTimes(period: number): { start: string; end: string } {
  const base = 7 + period;
  return { start: `${String(base).padStart(2, "0")}:00:00`, end: `${String(base + 1).padStart(2, "0")}:00:00` };
}

export function TimetableModule() {
  const supabase = useSupabaseClient();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [grid, setGrid] = useState<Record<string, Cell>>({});
  const [loading, setLoading] = useState(true);
  const [allOverview, setAllOverview] = useState<{ id: string; name: string; filled: number }[]>([]);
  const [modal, setModal] = useState<{ day: string; period: number } | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editTeacher, setEditTeacher] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [saving, setSaving] = useState(false);

  const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "NEW OXFORD GRAMMER SCHOOL";

  const loadOverview = useCallback(async () => {
    const { data: cls } = await supabase.from("classes").select("id,name").order("sort_order");
    const list = cls ?? [];
    const stats: { id: string; name: string; filled: number }[] = [];
    for (const c of list) {
      const { count } = await supabase
        .from("timetable")
        .select("*", { count: "exact", head: true })
        .eq("class_id", c.id)
        .not("subject_id", "is", null);
      stats.push({ id: c.id, name: c.name, filled: count ?? 0 });
    }
    setAllOverview(stats);
  }, [supabase]);

  const loadClassGrid = useCallback(async () => {
    if (!classId) {
      setGrid({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: tt } = await supabase.from("timetable").select("*").eq("class_id", classId);
    const { data: subs } = await supabase.from("subjects").select("id,name,class_id").eq("class_id", classId);
    const { data: t } = await supabase.from("teachers").select("id,full_name,employee_code").eq("status", "active");
    setSubjects((subs ?? []) as SubjectRow[]);
    setTeachers((t ?? []) as TeacherRow[]);
    const map: Record<string, Cell> = {};
    (tt ?? []).forEach((row: Record<string, unknown>) => {
      const key = `${row.day as string}-${row.period_number as number}`;
      map[key] = {
        id: row.id as string,
        subject_id: (row.subject_id as string | null) ?? null,
        teacher_id: (row.teacher_id as string | null) ?? null,
        room: (row.room as string | null) ?? null,
        start_time: String(row.start_time),
        end_time: String(row.end_time),
      };
    });
    setGrid(map);
    setLoading(false);
  }, [classId, supabase]);

  useEffect(() => {
    return scheduleEffectLoad(() => {
      void supabase
        .from("classes")
        .select("id,name")
        .order("sort_order")
        .then(({ data }) => setClasses(data ?? []));
    });
  }, [supabase]);

  useEffect(() => {
    return scheduleEffectLoad(() => {
      void loadOverview();
    });
  }, [loadOverview]);

  useEffect(() => {
    return scheduleEffectLoad(() => {
      void loadClassGrid();
    });
  }, [loadClassGrid]);

  const cellKey = (day: string, period: number) => `${day}-${period}`;

  const openCell = (day: string, period: number) => {
    const k = cellKey(day, period);
    const c = grid[k];
    setModal({ day, period });
    setEditSubject(c?.subject_id ?? "");
    setEditTeacher(c?.teacher_id ?? "");
    setEditRoom(c?.room ?? "");
  };

  const saveCell = async () => {
    if (!classId || !modal) return;
    setSaving(true);
    const k = cellKey(modal.day, modal.period);
    const existing = grid[k];
    const def = defaultTimes(modal.period);
    const row = {
      class_id: classId,
      day: modal.day,
      period_number: modal.period,
      start_time: existing?.start_time?.slice(0, 8) ?? def.start,
      end_time: existing?.end_time?.slice(0, 8) ?? def.end,
      subject_id: editSubject || null,
      teacher_id: editTeacher || null,
      room: editRoom.trim() || null,
    };
    const { error } = await supabase.from("timetable").upsert(row, {
      onConflict: "class_id,day,period_number",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Timetable updated");
    setModal(null);
    void loadClassGrid();
    void loadOverview();
  };

  const subjectName = (id: string | null) => subjects.find((s) => s.id === id)?.name ?? "—";
  const teacherName = (id: string | null) => {
    const t = teachers.find((x) => x.id === id);
    return t?.full_name ?? t?.employee_code ?? "—";
  };

  const fmtTime = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t);

  const printTitle = useMemo(() => {
    const c = classes.find((x) => x.id === classId);
    return c ? `${schoolName} — ${c.name}` : schoolName;
  }, [classId, classes, schoolName]);

  return (
    <div className="space-y-8">
      <div className="surface-card p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-200">All classes overview</h2>
        <p className="mb-3 text-sm text-slate-400">Number of periods with a subject assigned (max 48 = 6×8).</p>
        <div className="flex flex-wrap gap-2">
          {allOverview.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                classId === o.id ? "border-blue-500 bg-blue-950/50 text-blue-100" : "border-slate-600 hover:bg-slate-800"
              }`}
              onClick={() => setClassId(o.id)}
            >
              {o.name}{" "}
              <span className="text-slate-500">
                ({o.filled}/48)
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="no-print flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-slate-400">Class</label>
          <select
            className="mt-1 block min-w-[200px] rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="secondary" disabled={!classId} onClick={() => void handlePrint()}>
          Print timetable
        </Button>
      </div>

      {!classId && <p className="text-slate-500">Select a class to edit the weekly grid.</p>}
      {classId && loading && <p className="text-slate-400">Loading…</p>}

      {classId && !loading && (
        <div className="no-print overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-slate-600 bg-slate-800 p-2 text-left">Period</th>
                {DAYS.map((d) => (
                  <th key={d} className="border border-slate-600 bg-slate-800 p-2">
                    {d.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p) => (
                <tr key={p}>
                  <td className="border border-slate-700 bg-slate-800/50 p-2 font-medium">P{p}</td>
                  {DAYS.map((d) => {
                    const k = cellKey(d, p);
                    const c = grid[k];
                    const sid = c?.subject_id;
                    const bg = sid ? `hsl(${hashHue(sid)} 45% 22%)` : "transparent";
                    return (
                      <td
                        key={k}
                        className="cursor-pointer border border-slate-700 p-1 align-top transition hover:opacity-90"
                        style={{ background: bg }}
                        onClick={() => openCell(d, p)}
                      >
                        <div className="min-h-[72px] p-1">
                          <p className="font-medium leading-tight">{subjectName(sid)}</p>
                          <p className="text-xs text-slate-300">{teacherName(c?.teacher_id ?? null)}</p>
                          {c?.room && <p className="text-xs text-slate-400">Rm {c.room}</p>}
                          <p className="text-[10px] text-slate-500">
                            {fmtTime(c?.start_time ?? "")}–{fmtTime(c?.end_time ?? "")}
                          </p>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div ref={printRef} className="hidden print-timetable print:block">
        <h1 className="mb-4 text-center text-lg font-bold text-black">{printTitle}</h1>
        <p className="mb-4 text-center text-sm text-black">Weekly timetable (Mon–Sat, periods 1–8)</p>
        {classId && (
          <table className="w-full border-collapse border border-black text-xs text-black">
            <thead>
              <tr>
                <th className="border border-black p-1">Period</th>
                {DAYS.map((d) => (
                  <th key={d} className="border border-black p-1">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p) => (
                <tr key={p}>
                  <td className="border border-black p-1 font-semibold">{p}</td>
                  {DAYS.map((d) => {
                    const k = cellKey(d, p);
                    const c = grid[k];
                    return (
                      <td key={k} className="border border-black p-1 align-top">
                        <div className="font-semibold">{subjectName(c?.subject_id ?? null)}</div>
                        <div>{teacherName(c?.teacher_id ?? null)}</div>
                        {c?.room && <div>Room: {c.room}</div>}
                        <div className="text-[10px]">
                          {fmtTime(c?.start_time ?? "")}–{fmtTime(c?.end_time ?? "")}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={!!modal}
        title={modal ? `Edit — ${modal.day} · Period ${modal.period}` : ""}
        onClose={() => setModal(null)}
        onConfirm={() => void saveCell()}
        confirmLabel={saving ? "Saving…" : "Save"}
        loading={saving}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400">Subject</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
            >
              <option value="">— Free period —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Teacher</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={editTeacher}
              onChange={(e) => setEditTeacher(e.target.value)}
            >
              <option value="">—</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name ?? t.employee_code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Room</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              value={editRoom}
              onChange={(e) => setEditRoom(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
