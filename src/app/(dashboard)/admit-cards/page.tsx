import { AdmitCardsTool } from "@/components/admit-cards/AdmitCardsTool";

export default function AdmitCardsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admit cards</h1>
      <p className="text-slate-400">Build exam schedules, preview cards, and print two per A4 sheet.</p>
      <AdmitCardsTool />
    </div>
  );
}
