type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variants: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  danger: 'bg-red-500/15 text-red-400 border-red-500/30',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  neutral: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
  size?: 'sm' | 'md';
}

export function Badge({ label, variant, size = 'md' }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${variants[variant]} ${sizeClass}`}
    >
      {label}
    </span>
  );
}

export function getStatusBadgeVariant(status: string): BadgeVariant {
  const lowerStatus = status?.toLowerCase() || '';

  // Fee statuses
  if (lowerStatus === 'paid') return 'success';
  if (lowerStatus === 'unpaid') return 'warning';
  if (lowerStatus === 'overdue') return 'danger';

  // Student statuses
  if (lowerStatus === 'active') return 'success';
  if (lowerStatus === 'inactive') return 'neutral';
  if (lowerStatus === 'graduated') return 'info';

  // Attendance statuses
  if (lowerStatus === 'present') return 'success';
  if (lowerStatus === 'absent') return 'danger';
  if (lowerStatus === 'late') return 'warning';

  // Leave/Request statuses
  if (lowerStatus === 'approved') return 'success';
  if (lowerStatus === 'rejected') return 'danger';
  if (lowerStatus === 'pending') return 'warning';

  return 'neutral';
}
