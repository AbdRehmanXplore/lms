"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { StudentResultEntry } from "@/components/results/StudentResultEntry";

function StudentResultContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = typeof params.classId === "string" ? params.classId : "";
  const studentId = typeof params.studentId === "string" ? params.studentId : "";
  const examType = searchParams.get("examType") ?? "Final";
  const examYear = searchParams.get("examYear") ?? String(new Date().getFullYear());
  const autoPrint = searchParams.get("print") === "1";

  if (!classId || !studentId) {
    return <p className="text-slate-400">Invalid route.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Result Sheet</h1>
      <StudentResultEntry
        classId={classId}
        studentId={studentId}
        initialExamType={examType}
        initialExamYear={examYear}
        autoPrint={autoPrint}
      />
    </div>
  );
}

export default function StudentResultPage() {
  return (
    <Suspense fallback={<p className="text-[var(--text-muted)]">Loading result…</p>}>
      <StudentResultContent />
    </Suspense>
  );
}
