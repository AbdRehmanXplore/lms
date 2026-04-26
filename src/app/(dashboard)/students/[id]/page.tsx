"use client";

import { useParams } from "next/navigation";
import { StudentDetail } from "@/components/students/StudentDetail";

export default function StudentDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return <p className="text-slate-400">Invalid student.</p>;
  }

  return <StudentDetail studentId={id} />;
}
