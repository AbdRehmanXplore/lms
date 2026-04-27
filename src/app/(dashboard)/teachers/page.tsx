"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { TeacherTable, type TeacherRow } from "@/components/teachers/TeacherTable";
import { Button } from "@/components/ui/Button";

export default function TeachersPage() {
  const supabase = useSupabaseClient();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id,full_name,employee_code,subject,class_assigned,salary,status,profile_photo")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error && data) setTeachers(data as TeacherRow[]);
      setLoading(false);
    };
    void load();
  }, [supabase]);

  if (loading) {
    return <p className="text-slate-400">Loading teachers…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Teachers</h1>
        <Link href="/teachers/add">
          <Button type="button">Add Teacher</Button>
        </Link>
      </div>
      <TeacherTable teachers={teachers} />
    </div>
  );
}
