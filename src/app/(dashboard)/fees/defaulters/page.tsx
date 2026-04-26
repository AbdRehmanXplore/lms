"use client";

import Link from "next/link";
import { useFeeDefaulters } from "@/lib/hooks/useFeeDefaulters";
import { formatCurrency } from "@/lib/utils/formatCurrency";

export default function DefaultersPage() {
  const { data, loading } = useFeeDefaulters();

  if (loading) {
    return <p className="text-slate-400">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fee defaulters</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-800/80">
            <tr>
              <th className="p-3">Student</th>
              <th className="p-3">Roll</th>
              <th className="p-3">Class</th>
              <th className="p-3">Unpaid months</th>
              <th className="p-3">Total due</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  No defaulters.
                </td>
              </tr>
            ) : (
              data.map((d) => (
                <tr key={d.student_id} className="border-t border-slate-700">
                  <td className="p-3">{d.full_name}</td>
                  <td className="p-3">{d.roll_number}</td>
                  <td className="p-3">{d.class_name}</td>
                  <td className="p-3">{d.unpaid_months}</td>
                  <td className="p-3 text-red-300">{formatCurrency(Number(d.total_unpaid))}</td>
                  <td className="p-3">
                    <Link href={`/students/${d.student_id}`} className="text-blue-400 hover:underline">
                      Student
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
