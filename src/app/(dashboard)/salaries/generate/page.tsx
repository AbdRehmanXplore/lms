import { GenerateSalaryVouchers } from '@/components/salaries/GenerateSalaryVouchers';

export default function GenerateSalariesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Generate Salary Vouchers</h1>
        <p className="text-[var(--text-secondary)] mt-1">Create monthly salary vouchers for active teachers</p>
      </div>
      <GenerateSalaryVouchers />
    </div>
  );
}
