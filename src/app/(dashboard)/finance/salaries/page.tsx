import { TeacherSalariesModule } from "@/components/finance/TeacherSalariesModule";

export default function FinanceTeacherSalariesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Teacher Salaries</h1>
        <p className="body-text mt-1">Finance · Monthly salary records and payments</p>
      </div>
      <TeacherSalariesModule />
    </div>
  );
}
