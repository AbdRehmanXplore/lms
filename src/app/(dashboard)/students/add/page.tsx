"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { StudentForm } from "@/components/students/StudentForm";

function AddStudentContent() {
  const searchParams = useSearchParams();
  const preselectedClassId = searchParams.get("classId") ?? "";
  const supabase = useSupabaseClient();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [suggestedRoll, setSuggestedRoll] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: classRows } = await supabase.from("classes").select("id,name").order("name");
      setClasses(classRows ?? []);
      const year = new Date().getFullYear();
      const { count } = await supabase.from("students").select("*", { count: "exact", head: true });
      setSuggestedRoll(`${year}-${String((count ?? 0) + 1).padStart(3, "0")}`);
    };
    void load();
  }, [supabase]);

  return (
    <StudentForm classes={classes} suggestedRoll={suggestedRoll} defaultValues={preselectedClassId ? { classId: preselectedClassId } : undefined} />
  );
}

export default function AddStudentPage() {
  return (
    <Suspense fallback={<p className="text-[var(--text-muted)]">Loading…</p>}>
      <AddStudentContent />
    </Suspense>
  );
}
