"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { scheduleEffectLoad } from "@/lib/utils/scheduleEffectLoad";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";

type ClassesJoin = { name: string } | { name: string }[] | null;

type StudentEmbed = {
  id: string;
  full_name: string;
  student_uid: string | null;
  phone: string | null;
  whatsapp_reminders: boolean | null;
  profile_photo: string | null;
  classes: ClassesJoin;
};

type VoucherSlice = {
  id: string;
  amount: number;
  remaining_amount: number | null;
  student_id: string;
  students: StudentEmbed | StudentEmbed[] | null;
};

function oneStudent(s: StudentEmbed | StudentEmbed[] | null): StudentEmbed | null {
  if (!s) return null;
  return Array.isArray(s) ? s[0] ?? null : s;
}

function classNameFrom(row: StudentEmbed | null): string {
  if (!row?.classes) return "—";
  const c = row.classes;
  return Array.isArray(c) ? c[0]?.name ?? "—" : c.name;
}

export default function DefaultersPage() {
  const [aggRows, setAggRows] = useState<
    { student: StudentEmbed; totalDue: number; voucherIds: string[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDefaulters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      const { data, error } = await supabase
        .from("fee_vouchers")
        .select(
          "id,amount,remaining_amount,student_id,students(id,full_name,student_uid,phone,whatsapp_reminders,profile_photo,classes(name))",
        )
        .eq("is_defaulter", true)
        .in("status", ["unpaid", "overdue"]);

      if (error) throw error;

      const map = new Map<
        string,
        { student: StudentEmbed; totalDue: number; voucherIds: string[] }
      >();

      for (const row of (data ?? []) as VoucherSlice[]) {
        const st = oneStudent(row.students);
        if (!st?.id) continue;
        const bal = Number(row.remaining_amount ?? row.amount ?? 0);
        const prev = map.get(st.id);
        const vid = row.id as string;
        if (!prev) {
          map.set(st.id, { student: st, totalDue: bal, voucherIds: [vid] });
        } else {
          prev.totalDue += bal;
          prev.voucherIds.push(vid);
        }
      }

      setAggRows(
        [...map.values()].sort((a, b) => a.student.full_name.localeCompare(b.student.full_name)),
      );
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load defaulters");
      setAggRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return scheduleEffectLoad(() => {
      void fetchDefaulters();
    });
  }, [fetchDefaulters]);

  async function toggleReminder(studentId: string, currentValue: boolean | null) {
    const supabase = createClient();
    const { error: uErr } = await supabase
      .from("students")
      .update({ whatsapp_reminders: !currentValue })
      .eq("id", studentId);
    if (uErr) {
      toast.error(uErr.message);
      return;
    }
    toast.success("Reminder preference updated");
    void fetchDefaulters();
  }

  async function removeFromDefaulters(studentId: string) {
    const supabase = createClient();
    const { error: uErr } = await supabase
      .from("fee_vouchers")
      .update({ is_defaulter: false })
      .eq("student_id", studentId)
      .in("status", ["unpaid", "overdue"]);
    if (uErr) {
      toast.error(uErr.message);
      return;
    }
    toast.success("Removed from defaulters");
    void fetchDefaulters();
  }

  const sorted = useMemo(() => aggRows, [aggRows]);

  if (loading) {
    return <div className="p-8 text-[var(--text-primary)]">Loading defaulters…</div>;
  }

  if (error) {
    return (
      <div className="space-y-4 p-8">
        <h1 className="text-xl font-semibold text-red-400">Error</h1>
        <p className="text-red-300">{error}</p>
        <button type="button" className="rounded-lg bg-slate-700 px-4 py-2 text-sm" onClick={() => void fetchDefaulters()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
        Fee Defaulters ({sorted.length})
      </h1>

      {sorted.length === 0 ? (
        <p className="text-[var(--text-muted)]">No defaulters found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-800/80 text-slate-300">
              <tr>
                <th className="p-3">Photo</th>
                <th className="p-3">Student</th>
                <th className="p-3">Class</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Total Due</th>
                <th className="p-3">Auto MSG</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ student, totalDue }) => (
                <tr key={student.id} className="border-t border-slate-700">
                  <td className="p-3">
                    <ProfilePhoto src={student.profile_photo} alt={student.full_name} name={student.full_name} size={36} />
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-[var(--text-primary)]">{student.full_name}</div>
                    <div className="text-xs text-slate-400">{student.student_uid ?? "—"}</div>
                  </td>
                  <td className="p-3 text-slate-300">{classNameFrom(student)}</td>
                  <td className="p-3 font-mono text-xs">{student.phone ?? "—"}</td>
                  <td className="p-3 font-medium text-red-300">
                    PKR {totalDue.toLocaleString(undefined, { minimumFractionDigits: 0 })} /-
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => void toggleReminder(student.id, student.whatsapp_reminders)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        student.whatsapp_reminders
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                          : "border-red-500/40 bg-red-500/15 text-red-300"
                      }`}
                    >
                      {student.whatsapp_reminders ? "✓ ON" : "✗ OFF"}
                    </button>
                  </td>
                  <td className="space-x-2 whitespace-nowrap p-3">
                    <button
                      type="button"
                      className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      onClick={() => void removeFromDefaulters(student.id)}
                    >
                      Remove
                    </button>
                    <Link href={`/students/${student.id}`} className="text-xs text-blue-400 hover:underline">
                      Profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
