"use client";

import Link from "next/link";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export type StudentRow = {
  id: string;
  student_uid: string | null;
  roll_number: string;
  full_name: string;
  father_name: string;
  gender: string | null;
  status: string;
  profile_photo: string | null;
  classes: { name: string } | null;
};

type Props = { students: StudentRow[] };

export function StudentTable({ students }: Props) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState<"" | "Male" | "Female" | "Other">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive" | "graduated">("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchQ =
        !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        s.father_name.toLowerCase().includes(q) ||
        (s.student_uid?.toLowerCase().includes(q) ?? false);
      const matchClass = !classFilter || (s.classes?.name ?? "").toLowerCase().includes(classFilter.toLowerCase());
      const matchGender = !genderFilter || s.gender === genderFilter;
      const matchStatus = !statusFilter || s.status === statusFilter;
      return matchQ && matchClass && matchGender && matchStatus;
    });
  }, [students, search, classFilter, genderFilter, statusFilter]);

  const exportCsv = () => {
    const header = "Roll No,Name,Father,Class,Status";
    const lines = filtered.map(
      (s) =>
        `"${s.roll_number}","${s.full_name.replace(/"/g, '""')}","${s.father_name.replace(/"/g, '""')}","${s.classes?.name ?? ""}","${s.status}"`,
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <Input placeholder="Search name, roll, father" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Input placeholder="Filter class name" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} />
        <select
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value as typeof genderFilter)}
        >
          <option value="">All genders</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        <select
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="graduated">Graduated</option>
        </select>
        <Button variant="secondary" type="button" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-800/80 text-slate-300">
            <tr>
              <th className="p-3">Photo</th>
              <th className="p-3">Student ID</th>
              <th className="p-3">Roll</th>
              <th className="p-3">Name</th>
              <th className="p-3">Father</th>
              <th className="p-3">Class</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
                <tr key={s.id} className="border-t border-slate-700 hover:bg-slate-800/50">
                  <td className="p-3">
                    <ProfilePhoto src={s.profile_photo} alt="" size={36} />
                  </td>
                  <td className="p-3 font-mono text-sm font-bold text-blue-300">{s.student_uid ?? "—"}</td>
                  <td className="p-3">{s.roll_number}</td>
                  <td className="p-3 font-medium">{s.full_name}</td>
                  <td className="p-3">{s.father_name}</td>
                  <td className="p-3">{s.classes?.name ?? "—"}</td>
                  <td className="p-3 capitalize">{s.status}</td>
                  <td className="p-3">
                    <Link href={`/students/${s.id}`} className="text-blue-400 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
