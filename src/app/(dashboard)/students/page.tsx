"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { StudentTable, type StudentRow } from "@/components/students/StudentTable";
import { Button } from "@/components/ui/Button";

export default function StudentsPage() {
  const supabase = useSupabaseClient();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,student_uid,roll_number,full_name,father_name,gender,status,profile_photo,classes(name)")
        .order("roll_number")
        .limit(100);
      if (!error && data) {
        const mapped: StudentRow[] = (data as unknown as Record<string, unknown>[]).map((row) => {
          const cls = row.classes as { name: string } | { name: string }[] | null;
          const nameObj = Array.isArray(cls) ? cls[0] : cls;
          return {
            id: row.id as string,
            student_uid: (row.student_uid as string | null) ?? null,
            roll_number: row.roll_number as string,
            full_name: row.full_name as string,
            father_name: row.father_name as string,
            gender: row.gender as string | null,
            status: row.status as string,
            profile_photo: row.profile_photo as string | null,
            classes: nameObj ? { name: nameObj.name } : null,
          };
        });
        setStudents(mapped);
      }
      setLoading(false);
    };
    void load();
  }, [supabase]);

  if (loading) {
    return <p className="text-slate-400">Loading students…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Students</h1>
        <Link href="/students/add">
          <Button type="button">Add Student</Button>
        </Link>
      </div>
      <StudentTable students={students} />
    </div>
  );
}
