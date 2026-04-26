import { FeesOverview } from "@/components/fees/FeesOverview";

export default function FeesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fees</h1>
      <FeesOverview />
    </div>
  );
}
