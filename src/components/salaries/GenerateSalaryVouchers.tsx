'use client';

import { useState } from 'react';
import { useSupabaseClient } from '@/lib/supabase/hooks';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

interface Teacher {
  id: string;
  full_name: string;
  employee_code: string;
  subject: string;
  salary: number;
  voucherExists: boolean;
}

export function GenerateSalaryVouchers() {
  const supabase = useSupabaseClient();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewed, setPreviewed] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    try {
      // Get all active teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('id, full_name, employee_code, subject, salary')
        .eq('status', 'active');

      if (teachersError) {
        toast.error('Failed to load teachers');
        setLoading(false);
        return;
      }

      // Check which ones already have vouchers for this month/year
      const { data: existingVouchers } = await supabase
        .from('salary_vouchers')
        .select('teacher_id')
        .eq('month', month)
        .eq('year', year);

      const existingTeacherIds = new Set((existingVouchers || []).map(v => v.teacher_id));

      const teachersWithStatus = (teachersData || []).map(t => ({
        ...t,
        voucherExists: existingTeacherIds.has(t.id),
      }));

      setTeachers(teachersWithStatus);
      setPreviewed(true);
      toast.success(`Loaded ${teachersWithStatus.length} teachers`);
    } catch {
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_monthly_salary_vouchers', {
        p_month: month,
        p_year: year,
      });

      if (error) {
        toast.error(`Failed to generate vouchers: ${error.message}`);
      } else {
        toast.success(`Generated ${data || 0} vouchers successfully`);
        setPreviewed(false);
        setTeachers([]);
      }
    } catch {
      toast.error('Error generating vouchers');
    } finally {
      setGenerating(false);
    }
  };

  const newVouchers = teachers.filter(t => !t.voucherExists);
  const totalAmount = newVouchers.reduce((sum, t) => sum + (t.salary || 0), 0);

  return (
    <div className="space-y-6">
      <div className="surface-card p-6">
        <h2 className="section-title mb-4">Generate Monthly Salary Vouchers</h2>

        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <div>
            <label className="label-text mb-2 block">Month</label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>
                  {new Date(year, m - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-text mb-2 block">Year</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          onClick={handlePreview}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Loading...' : 'Preview'}
        </Button>
      </div>

      {previewed && teachers.length > 0 && (
        <div className="surface-card p-6">
          <h3 className="section-title mb-4">
            Preview ({newVouchers.length} new vouchers)
          </h3>

          <div className="overflow-x-auto mb-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Teacher Name</th>
                  <th>Employee Code</th>
                  <th>Subject</th>
                  <th>Salary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.id}>
                    <td>{t.full_name}</td>
                    <td className="font-mono text-sm">{t.employee_code}</td>
                    <td>{t.subject}</td>
                    <td>Rs. {t.salary.toLocaleString()}</td>
                    <td>
                      {t.voucherExists ? (
                        <Badge label="Already exists" variant="neutral" size="sm" />
                      ) : (
                        <Badge label="New" variant="success" size="sm" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-[var(--bg-surface-2)] p-4 rounded-lg mb-6">
            <p className="text-[var(--text-secondary)]">
              Total amount to be paid (new vouchers only): <span className="font-bold text-[var(--accent-emerald)]">Rs. {totalAmount.toLocaleString()}</span>
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || newVouchers.length === 0}
            className="w-full"
          >
            {generating ? 'Generating...' : `Generate ${newVouchers.length} Vouchers`}
          </Button>
        </div>
      )}
    </div>
  );
}
