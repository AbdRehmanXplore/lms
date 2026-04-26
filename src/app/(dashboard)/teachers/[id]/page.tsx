"use client";

import { useParams } from "next/navigation";
import { TeacherDetail } from "@/components/teachers/TeacherDetail";

export default function TeacherDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return <p className="text-slate-400">Invalid teacher.</p>;
  }

  return <TeacherDetail teacherId={id} />;
}
