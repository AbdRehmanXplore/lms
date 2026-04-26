import { SalaryVoucherDetail } from '@/components/salaries/SalaryVoucherDetail';

export default function SalaryVoucherPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <SalaryVoucherDetail id={params.id} />
    </div>
  );
}
