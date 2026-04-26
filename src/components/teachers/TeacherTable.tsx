"use client";

import Link from "next/link";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils/formatCurrency";

export type TeacherRow = {
  id: string;
  full_name: string | null;
  employee_code: string;
  subject: string;
  class_assigned: string | null;
  salary: number;
  status: string;
  profile_photo: string | null;
};

type Props = { teachers: TeacherRow[] };

const PAGE_SIZE = 10;

export function TeacherTable({ teachers }: Props) {
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return teachers.filter((t) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (t.full_name?.toLowerCase().includes(q) ?? false) ||
        t.employee_code.toLowerCase().includes(q);
      const matchSubject = !subjectFilter || t.subject.toLowerCase().includes(subjectFilter.toLowerCase());
      const matchStatus = !statusFilter || t.status === statusFilter;
      return matchSearch && matchSubject && matchStatus;
    });
  }, [teachers, search, subjectFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const slice = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <Input placeholder="Search name or employee code" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Input placeholder="Filter subject" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} />
        <select
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-800/80 text-slate-300">
            <tr>
              <th className="p-3">Photo</th>
              <th className="p-3">Name</th>
              <th className="p-3">Code</th>
              <th className="p-3">Subject</th>
              <th className="p-3">Class</th>
              <th className="p-3">Salary</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((t) => (
              <tr key={t.id} className="border-t border-slate-700 hover:bg-slate-800/50">
                <td className="p-3">
                  <ProfilePhoto src={t.profile_photo} alt="" size={40} />
                </td>
                <td className="p-3 font-medium">{t.full_name ?? "—"}</td>
                <td className="p-3">{t.employee_code}</td>
                <td className="p-3">{t.subject}</td>
                <td className="p-3">{t.class_assigned ?? "—"}</td>
                <td className="p-3">{formatCurrency(Number(t.salary))}</td>
                <td className="p-3 capitalize">{t.status}</td>
                <td className="p-3">
                  <Link href={`/teachers/${t.id}`} className="text-blue-400 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          Page {pageSafe + 1} of {pageCount} · {filtered.length} teachers
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" type="button" disabled={pageSafe === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Prev
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={pageSafe >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
