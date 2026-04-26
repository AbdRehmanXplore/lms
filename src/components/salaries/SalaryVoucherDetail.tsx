"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSupabaseClient } from "@/lib/supabase/hooks";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { getStatusBadgeVariant } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

type SalaryVoucher = {
  id: string;
  voucher_number: string;
  amount: number;
  month: string;
  status: string;
  payment_date: string | null;
  payment_method: string | null;
  received_by: string | null;
  due_date: string;
  issue_date: string;
  teacher_id: string;
  teachers: {
    employee_code: string;
    full_name: string | null;
    subject: string;
    email: string | null;
    phone: string | null;
  } | null;
};

interface SalaryVoucherDetailProps {
  id: string;
}

export function SalaryVoucherDetail({ id }: SalaryVoucherDetailProps) {
  const supabase = useSupabaseClient();
  const [voucher, setVoucher] = useState<SalaryVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [receivedBy, setReceivedBy] = useState("");

  const loadVoucher = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("salary_vouchers")
      .select(
        "id,voucher_number,amount,month,status,payment_date,payment_method,received_by,due_date,issue_date,teacher_id,teachers(employee_code,full_name,subject,email,phone)",
      )
      .eq("id", id)
      .single();

    if (data) {
      const teacher = (data.teachers as Record<string, unknown>[] | Record<string, unknown> | null);
      const teacherObj = Array.isArray(teacher) ? teacher[0] : teacher;
      setVoucher({
        ...data,
        teachers: teacherObj
          ? {
              employee_code: teacherObj.employee_code as string,
              full_name: (teacherObj.full_name as string | null) ?? null,
              subject: teacherObj.subject as string,
              email: (teacherObj.email as string | null) ?? null,
              phone: (teacherObj.phone as string | null) ?? null,
            }
          : null,
      } as SalaryVoucher);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadVoucher();
  }, [id]);

  const markAsPaid = async () => {
    if (!voucher) return;
    setMarkingPaid(true);
    const { error } = await supabase
      .from("salary_vouchers")
      .update({
        status: "paid",
        payment_date: paymentDate,
        payment_method: paymentMethod,
        received_by: receivedBy || null,
      })
      .eq("id", voucher.id);
    setMarkingPaid(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Salary marked as paid");
    setShowPaymentModal(false);
    void loadVoucher();
  };

  if (loading) {
    return <p className="text-[var(--text-secondary)]">Loading salary voucher…</p>;
  }

  if (!voucher) {
    return <p className="text-[var(--text-secondary)]">Salary voucher not found.</p>;
  }

  const teacher = voucher.teachers;
  const isPaid = voucher.status.toLowerCase() === "paid";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Salary Voucher</h1>
        {!isPaid && (
          <Button type="button" onClick={() => setShowPaymentModal(true)}>
            Mark as Paid
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="surface-card p-6">
          <h2 className="section-title mb-4">Voucher Details</h2>
          <dl className="space-y-3">
            <div>
              <dt className="label-text">Voucher Number</dt>
              <dd className="font-mono text-sm text-[var(--text-primary)]">{voucher.voucher_number}</dd>
            </div>
            <div>
              <dt className="label-text">Month</dt>
              <dd className="text-[var(--text-primary)]">{voucher.month}</dd>
            </div>
            <div>
              <dt className="label-text">Amount</dt>
              <dd className="text-lg font-semibold text-[var(--accent-blue)]">{formatCurrency(voucher.amount)}</dd>
            </div>
            <div>
              <dt className="label-text">Status</dt>
              <dd>
                <Badge label={voucher.status} variant={getStatusBadgeVariant(voucher.status)} />
              </dd>
            </div>
            <div>
              <dt className="label-text">Issue Date</dt>
              <dd className="text-[var(--text-primary)]">{voucher.issue_date}</dd>
            </div>
            <div>
              <dt className="label-text">Due Date</dt>
              <dd className="text-[var(--text-primary)]">{voucher.due_date}</dd>
            </div>
            {isPaid && (
              <>
                <div>
                  <dt className="label-text">Payment Date</dt>
                  <dd className="text-[var(--text-primary)]">{voucher.payment_date}</dd>
                </div>
                <div>
                  <dt className="label-text">Payment Method</dt>
                  <dd className="text-[var(--text-primary)]">{voucher.payment_method}</dd>
                </div>
                <div>
                  <dt className="label-text">Received By</dt>
                  <dd className="text-[var(--text-primary)]">{voucher.received_by || "—"}</dd>
                </div>
              </>
            )}
          </dl>
        </div>

        <div className="surface-card p-6">
          <h2 className="section-title mb-4">Teacher Details</h2>
          {teacher ? (
            <dl className="space-y-3">
              <div>
                <dt className="label-text">Employee Code</dt>
                <dd className="font-mono text-sm text-[var(--text-primary)]">{teacher.employee_code}</dd>
              </div>
              <div>
                <dt className="label-text">Name</dt>
                <dd className="text-[var(--text-primary)]">{teacher.full_name || "—"}</dd>
              </div>
              <div>
                <dt className="label-text">Subject</dt>
                <dd className="text-[var(--text-primary)]">{teacher.subject}</dd>
              </div>
              <div>
                <dt className="label-text">Email</dt>
                <dd className="text-[var(--text-primary)]">{teacher.email || "—"}</dd>
              </div>
              <div>
                <dt className="label-text">Phone</dt>
                <dd className="text-[var(--text-primary)]">{teacher.phone || "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-[var(--text-secondary)]">Teacher information not available.</p>
          )}
        </div>
      </div>

      <Modal
        open={showPaymentModal}
        title="Mark salary as paid"
        onClose={() => setShowPaymentModal(false)}
        onConfirm={markAsPaid}
        confirmLabel="Confirm Payment"
        loading={markingPaid}
      >
        <div className="space-y-4">
          <div>
            <label className="label-text mb-2 block">Payment Date</label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className="label-text mb-2 block">Payment Method</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="label-text mb-2 block">Received By</label>
            <Input placeholder="Admin name" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
