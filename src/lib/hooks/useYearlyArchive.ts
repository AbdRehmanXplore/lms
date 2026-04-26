"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";

export function useYearlyArchive(year: string) {
  const supabase = useSupabaseClient();
  const [results, setResults] = useState<unknown[]>([]);
  const [expenses, setExpenses] = useState<unknown[]>([]);
  const [snapshots, setSnapshots] = useState<unknown[]>([]);
  const [feeVouchers, setFeeVouchers] = useState<unknown[]>([]);
  const [students, setStudents] = useState<unknown[]>([]);
  const [attendanceMonthly, setAttendanceMonthly] = useState<unknown[]>([]);

  useEffect(() => {
    const load = async () => {
      const from = `${year}-01-01`;
      const to = `${year}-12-31`;
      const [{ data }, { data: expenseRows }, { data: snapshotRows }, { data: voucherRows }, { data: studentRows }, { data: attendanceRows }] = await Promise.all([
        supabase.from("results").select("*").eq("exam_year", year),
        supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to),
        supabase.from("monthly_snapshots").select("*").like("month_year", `${year}-%`).order("month_year"),
        supabase.from("fee_vouchers").select("id,student_id,month,status,amount,due_date,payment_date").ilike("month", `%${year}%`),
        supabase.from("students").select("id,full_name,roll_number,student_uid,classes(name)").order("roll_number"),
        supabase.from("monthly_attendance_summary").select("student_id,full_name,roll_number,class_name,month_year,attendance_percentage").like("month_year", `${year}-%`),
      ]);
      setResults(data ?? []);
      setExpenses(expenseRows ?? []);
      setSnapshots(snapshotRows ?? []);
      setFeeVouchers(voucherRows ?? []);
      setStudents(studentRows ?? []);
      setAttendanceMonthly(attendanceRows ?? []);
    };
    void load();
  }, [year, supabase]);

  return { results, expenses, snapshots, feeVouchers, students, attendanceMonthly };
}
