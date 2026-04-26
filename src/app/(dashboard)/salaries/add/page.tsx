import { AddSalaryVoucher } from '@/components/salaries/AddSalaryVoucher';

export default function AddSalaryVoucherPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Add Salary Voucher</h1>
        <p className="text-[var(--text-secondary)] mt-1">Create an individual salary voucher for a teacher</p>
      </div>
      <AddSalaryVoucher />
    </div>
  );
}
