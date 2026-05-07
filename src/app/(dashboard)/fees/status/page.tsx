import { FeeStatusModule } from "@/components/fees/FeeStatusModule";

export default function FeeStatusPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fee Status</h1>
      <FeeStatusModule />
    </div>
  );
}
