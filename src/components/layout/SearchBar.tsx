"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { cn } from "@/lib/utils/cn";

type Hit =
  | { type: "student"; id: string; title: string; subtitle: string }
  | { type: "teacher"; id: string; title: string; subtitle: string };

export function SearchBar() {
  const supabase = useSupabaseClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (term: string) => {
      const t = term.trim();
      if (t.length < 2) {
        setHits([]);
        return;
      }
      const p = `%${t}%`;
      const [sName, sRoll, sFather, sUid, tName, tCode] = await Promise.all([
        supabase.from("students").select("id,full_name,roll_number,father_name,student_uid,classes(name)").ilike("full_name", p).limit(5),
        supabase.from("students").select("id,full_name,roll_number,father_name,student_uid,classes(name)").ilike("roll_number", p).limit(5),
        supabase.from("students").select("id,full_name,roll_number,father_name,student_uid,classes(name)").ilike("father_name", p).limit(5),
        supabase.from("students").select("id,full_name,roll_number,father_name,student_uid,classes(name)").ilike("student_uid", p).limit(5),
        supabase.from("teachers").select("id,full_name,employee_code,subject").ilike("full_name", p).limit(5),
        supabase.from("teachers").select("id,full_name,employee_code,subject").ilike("employee_code", p).limit(5),
      ]);
      const sMap = new Map<string, Record<string, unknown>>();
      [sName.data, sRoll.data, sFather.data, sUid.data].forEach((rows) => {
        (rows ?? []).forEach((row: Record<string, unknown>) => sMap.set(row.id as string, row));
      });
      const sRes = { data: [...sMap.values()].slice(0, 8) };
      const tMap = new Map<string, Record<string, unknown>>();
      [tName.data, tCode.data].forEach((rows) => {
        (rows ?? []).forEach((row: Record<string, unknown>) => tMap.set(row.id as string, row));
      });
      const tRes = { data: [...tMap.values()].slice(0, 8) };

      const studentHits: Hit[] =
        (sRes.data ?? []).map((row: Record<string, unknown>) => {
          const cls = row.classes as { name: string } | { name: string }[] | null;
          const cn = Array.isArray(cls) ? cls[0]?.name : cls?.name;
          const uid = row.student_uid as string | null;
          return {
            type: "student" as const,
            id: row.id as string,
            title: row.full_name as string,
            subtitle: `${uid ? `${uid} · ` : ""}${row.roll_number as string} · ${cn ?? "Class"}`,
          };
        }) ?? [];

      const teacherHits: Hit[] =
        (tRes.data ?? []).map((row: Record<string, unknown>) => ({
          type: "teacher" as const,
          id: row.id as string,
          title: (row.full_name as string) ?? "Teacher",
          subtitle: `${row.employee_code as string} · ${row.subject as string}`,
        })) ?? [];

      setHits([...studentHits, ...teacherHits]);
      setActive(0);
    },
    [supabase],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      void runSearch(q);
    }, 300);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" && hits[active]) {
      window.location.href =
        hits[active].type === "student" ? `/students/${hits[active].id}` : `/teachers/${hits[active].id}`;
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full max-w-xl">
      <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 focus-within:border-[var(--accent-blue)] transition-colors">
        <Search size={16} className="text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          placeholder="Search students or teachers… (Ctrl+K)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
        />
      </label>
      {open && hits.length > 0 && (
        <ul
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1 shadow-xl"
          role="listbox"
        >
          {hits.map((h, i) => (
            <li key={`${h.type}-${h.id}`} role="option" aria-selected={i === active}>
              <Link
                href={h.type === "student" ? `/students/${h.id}` : `/teachers/${h.id}`}
                className={cn(
                  "block px-3 py-2 text-sm hover:bg-[var(--bg-surface-2)] transition-colors",
                  i === active && "bg-[var(--bg-surface-2)]",
                )}
                onMouseEnter={() => setActive(i)}
              >
                <span className="font-medium text-[var(--text-primary)]">{h.title}</span>
                <span className="ml-2 text-xs text-[var(--text-muted)]">{h.type === "student" ? "Student" : "Teacher"}</span>
                <p className="text-xs text-[var(--text-secondary)]">{h.subtitle}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
