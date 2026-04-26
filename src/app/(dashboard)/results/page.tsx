import { ClassGrid } from "@/components/results/ClassGrid";

export default function ResultsOverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Results</h1>
      <p className="text-slate-400">Select a class to generate, view, and print results.</p>
      <ClassGrid />
    </div>
  );
}
