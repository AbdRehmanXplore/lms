"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { ORDERED_CLASSES } from "@/lib/constants/academics";
import { Badge } from "@/components/ui/Badge";

export default function ClassesPage() {
  const supabase = useSupabaseClient();
  const [items, setItems] = useState<{ id: string | null; name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data: classes, error: classError } = await supabase.from("classes").select("id,name").order("sort_order");
      if (classError) {
        setError(classError.message);
        setLoading(false);
        return;
      }

      const classCounts = await Promise.all(
        (classes ?? []).map(async (cls) => {
          const { count, error: countError } = await supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("class_id", cls.id)
            .eq("status", "active");
          if (countError) throw new Error(countError.message);
          return { classId: cls.id, count: count ?? 0 };
        }),
      );
      const countMap = new Map(classCounts.map((c) => [c.classId, c.count]));
      const out: { id: string | null; name: string; count: number }[] = ORDERED_CLASSES.map((className) => {
        const cls = (classes ?? []).find((c) => c.name === className);
        if (!cls) return { id: null, name: className, count: 0 };
        return { id: cls.id, name: cls.name, count: countMap.get(cls.id) ?? 0 };
      });
      setItems(out);
      setLoading(false);
    };
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load classes");
      setLoading(false);
    });
  }, [supabase]);

  if (loading) {
    return <p className="text-[var(--text-secondary)]">Loading classes…</p>;
  }

  if (error) {
    return <p className="text-[var(--accent-red)]">Failed to load classes: {error}</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Classes</h1>
      <p className="text-[var(--text-secondary)]">Select a class to view students.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {items.map((c) => (
          <div key={c.name}>
            {c.id ? (
              <Link href={`/classes/${c.id}`} className="surface-card block p-4 transition hover:border-[var(--accent-blue)]/50">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[var(--accent-blue)]">{c.name}</h2>
                  <Badge label={`${c.count}`} variant={c.count > 0 ? 'success' : 'neutral'} size="sm" />
                </div>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">{c.count} {c.count === 1 ? 'student' : 'students'}</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">Open class →</p>
              </Link>
            ) : (
              <div className="surface-card block border-dashed p-4 opacity-70">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[var(--accent-blue)]">{c.name}</h2>
                  <Badge label="0" variant="neutral" size="sm" />
                </div>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">0 students</p>
                <p className="mt-2 text-xs text-[var(--accent-amber)]">Seed class data from SQL first</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
