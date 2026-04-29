"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";

export type Defaulter = {
  student_id: string;
  full_name: string;
  roll_number: string;
  class_name: string;
  unpaid_months: number;
  total_unpaid: number;
};

/** Snapshot rows for dashboard widget — sourced from vouchers (no DB view required). */
export function useFeeDefaulters() {
  const supabase = useSupabaseClient();
  const [data, setData] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: rows, error } = await supabase
        .from("fee_vouchers")
        .select(
          "student_id,amount,remaining_amount,month,students(full_name,roll_number,classes(name))",
        )
        .eq("is_defaulter", true)
        .in("status", ["unpaid", "overdue"]);

      if (cancelled) return;

      if (error) {
        setData([]);
        setLoading(false);
        return;
      }

      type RawRow = {
        student_id: string;
        amount: number;
        remaining_amount: number | null;
        month: string;
        students: Record<string, unknown> | Record<string, unknown>[] | null;
      };

      const map = new Map<
        string,
        {
          student_id: string;
          full_name: string;
          roll_number: string;
          class_name: string;
          months: Set<string>;
          total_unpaid: number;
        }
      >();

      for (const raw of (rows ?? []) as RawRow[]) {
        const st = raw.students;
        const studentObj = Array.isArray(st) ? st[0] : st;
        if (!studentObj || !raw.student_id) continue;
        const cls = studentObj.classes as { name: string } | { name: string }[] | null;
        const className = Array.isArray(cls) ? cls[0]?.name ?? "—" : cls?.name ?? "—";
        const bal = Number(raw.remaining_amount ?? raw.amount ?? 0);
        const prev = map.get(raw.student_id);
        const mo = raw.month ?? "";
        if (!prev) {
          map.set(raw.student_id, {
            student_id: raw.student_id,
            full_name: String(studentObj.full_name ?? ""),
            roll_number: String(studentObj.roll_number ?? ""),
            class_name: className,
            months: new Set(mo ? [mo] : []),
            total_unpaid: bal,
          });
        } else {
          prev.total_unpaid += bal;
          if (mo) prev.months.add(mo);
        }
      }

      const list: Defaulter[] = [...map.values()].map((v) => ({
        student_id: v.student_id,
        full_name: v.full_name,
        roll_number: v.roll_number,
        class_name: v.class_name,
        unpaid_months: v.months.size,
        total_unpaid: v.total_unpaid,
      }));

      list.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setData(list);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return { data, loading };
}
