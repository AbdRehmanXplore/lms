import { ExpensesModule } from "@/components/expenses/ExpensesModule";

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Expenses</h1>
      <ExpensesModule />
    </div>
  );
}
