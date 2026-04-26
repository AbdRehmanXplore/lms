"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";

export type MonthlySnapshot = {
  id: string;
  month_year: string;
  total_students: number;
  total_teachers: number;
  fees_collected: number;
  fees_pending: number;
  total_expenses: number;
  net_balance: number;
  avg_attendance_percentage: number;
  created_at: string;
};

export function useMonthlyHistory(monthKey: string) {
  const supabase = useSupabaseClient();
  const [feeRows, setFeeRows] = useState<unknown[]>([]);
  const [expenseRows, setExpenseRows] = useState<unknown[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<unknown[]>([]);
  const [resultRows, setResultRows] = useState<unknown[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);

  useEffect(() => {
    const load = async () => {
      const [y, m] = monthKey.split("-");
      const dt = new Date(Number(y), Number(m) - 1, 1);
      const monthLabel = `${dt.toLocaleString("en", { month: "long" })} ${y}`;
      const from = `${monthKey}-01`;
      const toDate = new Date(Number(y), Number(m), 0).getDate();
      const to = `${monthKey}-${String(toDate).padStart(2, "0")}`;
      const [
        { data: fees },
        { data: expenses },
        { data: attendanceSummary, error: attendanceSummaryErr },
        { data: results },
        { data: snapshotRows },
      ] = await Promise.all([
        supabase.from("fee_vouchers").select("*").ilike("month", `%${monthLabel}%`),
        supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to),
        supabase.from("monthly_attendance_summary").select("*").eq("month_year", monthKey),
        supabase.from("results").select("*").gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`),
        supabase.from("monthly_snapshots").select("*").order("month_year", { ascending: false }),
      ]);
      let attendanceRowsSafe = attendanceSummary ?? [];

      // Fallback when monthly_attendance_summary view is missing in DB.
      if (attendanceSummaryErr?.code === "42P01") {
        const { data: attendanceRaw } = await supabase.from("attendance").select("status").gte("date", from).lte("date", to);
        const all = attendanceRaw ?? [];
        const present = all.filter((r) => r.status === "present" || r.status === "late").length;
        const percentage = all.length ? Number(((present / all.length) * 100).toFixed(2)) : 0;
        attendanceRowsSafe = [{ month_year: monthKey, attendance_percentage: percentage }];
      }
      setFeeRows(fees ?? []);
      setExpenseRows(expenses ?? []);
      setAttendanceRows(attendanceRowsSafe);
      setResultRows(results ?? []);
      setSnapshots((snapshotRows ?? []) as MonthlySnapshot[]);
    };
    void load();
  }, [monthKey, supabase]);

  const saveCurrentSnapshot = async () => {
    return supabase.rpc("create_monthly_snapshot", { target_month: monthKey });
  };

  const deleteSnapshot = async (id: string) => {
    return supabase.from("monthly_snapshots").delete().eq("id", id);
  };

  return { feeRows, expenseRows, attendanceRows, resultRows, snapshots, saveCurrentSnapshot, deleteSnapshot };
}
