"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";

type StudentRow = {
  id: string;
  student_uid: string | null;
  roll_number: string;
  full_name: string;
  father_name: string;
  gender: string | null;
  status: string;
  profile_photo: string | null;
};

export default function ClassDetailPage() {
  const params = useParams();
  const classId = typeof params.classId === "string" ? params.classId : "";
  const supabase = useSupabaseClient();
  const [className, setClassName] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [{ data: cls, error: classError }, { data: rows, error: studentError }] = await Promise.all([
        supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
        supabase
          .from("students")
          .select("id,student_uid,roll_number,full_name,father_name,gender,status,profile_photo")
          .eq("class_id", classId)
          .order("roll_number"),
      ]);

      if (classError) {
        setError(classError.message);
        setLoading(false);
        return;
      }
      if (studentError) {
        setError(studentError.message);
        setLoading(false);
        return;
      }

      setClassName(cls?.name ?? "Class");
      setStudents(rows ?? []);
      setLoading(false);
    };

    void load();
  }, [classId, supabase]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.father_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        (s.student_uid?.toLowerCase().includes(q) ?? false),
    );
  }, [students, search]);

  if (!classId) {
    return <p className="text-slate-400">Invalid class.</p>;
  }

  if (loading) {
    return <p className="text-slate-400">Loading class details…</p>;
  }

  if (error) {
    return <p className="text-red-400">Failed to load class: {error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{className}</h1>
          <p className="text-slate-400">Total students: {students.length}</p>
        </div>
        <Link href={`/students/add?classId=${classId}`}>
          <Button type="button">Add Student to this Class</Button>
        </Link>
      </div>

      <div className="max-w-md">
        <Input placeholder="Search by student ID, roll no, name, father name" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-800/90 text-slate-300">
            <tr>
              <th className="p-3">Student ID</th>
              <th className="p-3">Roll No</th>
              <th className="p-3">Name</th>
              <th className="p-3">Father Name</th>
              <th className="p-3">Gender</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-slate-700">
                <td className="p-3 font-mono text-xs text-blue-300">{s.student_uid ?? "—"}</td>
                <td className="p-3">{s.roll_number}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <ProfilePhoto src={s.profile_photo} alt={s.full_name} name={s.full_name} size={32} />
                    <span>{s.full_name}</span>
                  </div>
                </td>
                <td className="p-3">{s.father_name}</td>
                <td className="p-3">{s.gender ?? "—"}</td>
                <td className="p-3 capitalize">{s.status}</td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <Link href={`/students/${s.id}`} className="text-blue-400 hover:underline">
                      View Student
                    </Link>
                    <Link href={`/students/${s.id}`} className="text-emerald-400 hover:underline">
                      Edit Student
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={7}>
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
