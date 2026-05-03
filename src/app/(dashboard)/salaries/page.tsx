import { TeacherSalariesModule } from "@/components/finance/TeacherSalariesModule";

export default function SalariesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Teacher Salaries</h1>
        <p className="body-text mt-1">Finance · Current month payroll, filters, and payment actions</p>
      </div>
      <TeacherSalariesModule />
    </div>
  );
}
