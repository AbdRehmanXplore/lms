"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";

export function useAttendanceHistory(studentId: string) {
  const supabase = useSupabaseClient();
  const [rows, setRows] = useState<unknown[]>([]);

  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      const { data } = await supabase.from("attendance").select("*").eq("student_id", studentId);
      setRows(data ?? []);
    };
    void load();
  }, [studentId, supabase]);

  return { rows };
}
