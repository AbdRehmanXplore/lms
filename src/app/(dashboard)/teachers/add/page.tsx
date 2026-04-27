"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { TeacherForm } from "@/components/teachers/TeacherForm";

export default function AddTeacherPage() {
  const supabase = useSupabaseClient();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [suggestedCode, setSuggestedCode] = useState("TCH-001");

  useEffect(() => {
    const load = async () => {
      const { data: classRows } = await supabase.from("classes").select("id,name").order("sort_order");
      setClasses(classRows ?? []);
      const { count } = await supabase.from("teachers").select("id", { count: "exact", head: true });
      setSuggestedCode(`TCH-${String((count ?? 0) + 1).padStart(3, "0")}`);
    };
    void load();
  }, [supabase]);

  return <TeacherForm classes={classes} suggestedEmployeeCode={suggestedCode} />;
}
