'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@/lib/supabase/hooks';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

interface Teacher {
  id: string;
  full_name: string;
  employee_code: string;
  salary: number;
  subject: string;
}

export function AddSalaryVoucher() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    teacher_id: '',
    amount: 0,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
    payment_method: 'Cash',
    remarks: '',
  });

  useEffect(() => {
    const loadTeachers = async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, full_name, employee_code, salary, subject')
        .eq('status', 'active')
        .order('full_name');

      if (error) {
        toast.error('Failed to load teachers');
      } else {
        setTeachers(data || []);
      }
      setLoading(false);
    };

    loadTeachers();
  }, [supabase]);

  const handleTeacherChange = (teacher_id: string) => {
    const teacher = teachers.find(t => t.id === teacher_id);
    setFormData(prev => ({
      ...prev,
      teacher_id,
      amount: teacher?.salary || 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('salary_vouchers')
        .insert([
          {
            teacher_id: formData.teacher_id,
            amount: formData.amount,
            month: formData.month,
            year: formData.year,
            due_date: formData.due_date,
            payment_method: formData.payment_method,
            remarks: formData.remarks || null,
            status: 'unpaid',
          },
        ]);

      if (error) {
        toast.error(`Failed to create voucher: ${error.message}`);
      } else {
        toast.success('Salary voucher created successfully');
        router.push('/salaries');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-[var(--text-secondary)]">Loading...</p>;
  }

  return (
    <div className="surface-card p-6 max-w-2xl">
      <h2 className="section-title mb-6">Add Individual Salary Voucher</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-text mb-2 block">Teacher *</label>
            <select
              value={formData.teacher_id}
              onChange={e => handleTeacherChange(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
            >
              <option value="">Select a teacher</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-text mb-2 block">Amount (Rs.) *</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={e => setFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
              required
            />
          </div>

          <div>
            <label className="label-text mb-2 block">Month</label>
            <select
              value={formData.month}
              onChange={e => setFormData(prev => ({ ...prev, month: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>
                  {new Date(formData.year, m - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-text mb-2 block">Year</label>
            <select
              value={formData.year}
              onChange={e => setFormData(prev => ({ ...prev, year: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-text mb-2 block">Due Date</label>
            <Input
              type="date"
              value={formData.due_date}
              onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="label-text mb-2 block">Payment Method</label>
            <select
              value={formData.payment_method}
              onChange={e => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
            >
              <option>Cash</option>
              <option>Bank Transfer</option>
              <option>Cheque</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label-text mb-2 block">Remarks</label>
          <textarea
            value={formData.remarks}
            onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] transition-colors focus:border-[var(--accent-blue)] focus:outline-none resize-none"
            placeholder="Optional remarks"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Voucher'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
