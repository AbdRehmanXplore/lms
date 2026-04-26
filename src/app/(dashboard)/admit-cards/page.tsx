import { AdmitCardsTool } from "@/components/admit-cards/AdmitCardsTool";

export default function AdmitCardsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admit cards</h1>
      <p className="text-[var(--text-muted)]">
        Select class → enter exam dates per subject → save schedule → generate admit cards for all students → print (two per A4).
      </p>
      <AdmitCardsTool />
    </div>
  );
}
