"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { ORDERED_CLASSES, FIXED_SUBJECTS } from "@/lib/constants/academics";

export type ClassTile = {
  id: string | null;
  name: string;
  generatedResults: number;
  studentCount: number;
};

export function ClassGrid() {
  const supabase = useSupabaseClient();
  const [tiles, setTiles] = useState<ClassTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data: classes, error: classError } = await supabase.from("classes").select("id,name");
      if (classError) {
        setError(classError.message);
        setLoading(false);
        return;
      }
      if (!classes?.length) {
        setTiles([]);
        setLoading(false);
        return;
      }

      const out: ClassTile[] = [];
      for (const className of ORDERED_CLASSES) {
        const cls = classes.find((c) => c.name === className);
        if (!cls) {
          out.push({ id: null, name: className, generatedResults: 0, studentCount: 0 });
          continue;
        }

        // Query student count
        const { data: students, error: studentError } = await supabase
          .from("students")
          .select("id", { count: "exact" })
          .eq("class_id", cls.id)
          .eq("status", "active");

        if (studentError) {
          setError(studentError.message);
          setLoading(false);
          return;
        }

        const { data: results, error: resultError } = await supabase
          .from("results")
          .select("student_id,exam_type,exam_year,subject_id")
          .eq("class_id", cls.id);
        if (resultError) {
          setError(resultError.message);
          setLoading(false);
          return;
        }

        const grouped = new Map<string, Set<string>>();
        (results ?? []).forEach((row) => {
          const key = `${row.student_id}|${row.exam_type}|${row.exam_year}`;
          if (!grouped.has(key)) grouped.set(key, new Set());
          grouped.get(key)?.add(row.subject_id as string);
        });
        const completed = [...grouped.values()].filter((subjects) => subjects.size >= FIXED_SUBJECTS.length).length;

        out.push({ 
          id: cls.id, 
          name: cls.name, 
          generatedResults: completed,
          studentCount: students?.length ?? 0,
        });
      }
      setTiles(out);
      setLoading(false);
    };
    void load();
  }, [supabase]);

  if (loading) {
    return <p className="text-slate-400">Loading classes…</p>;
  }

  if (error) {
    return <p className="text-red-400">Failed to load classes: {error}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.name}>
          {t.id ? (
            <Link href={`/results/${t.id}`} className="surface-card block p-4 transition hover:border-[var(--accent-blue)]/50">
              <h3 className="text-lg font-semibold text-[var(--accent-blue)]">{t.name}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">👥 Students enrolled: {t.studentCount}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">📋 Generated results: {t.generatedResults}</p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">Open class results →</p>
            </Link>
          ) : (
            <div className="surface-card block border-dashed p-4 opacity-70">
              <h3 className="text-lg font-semibold text-[var(--accent-blue)]">{t.name}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">👥 Students enrolled: 0</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">📋 Generated results: 0</p>
              <p className="mt-2 text-xs text-[var(--accent-amber)]">Seed class data from SQL first</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
