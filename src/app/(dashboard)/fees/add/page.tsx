import { VoucherAddForm } from "@/components/fees/VoucherAddForm";

export default function FeesAddPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Generate fee voucher</h1>
      <VoucherAddForm />
    </div>
  );
}
