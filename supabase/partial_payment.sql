-- Partial fee payments + receipt columns.
-- Run in Supabase SQL Editor after backups.

alter table fee_vouchers add column if not exists amount_paid numeric(10,2) default 0;
alter table fee_vouchers add column if not exists remaining_amount numeric(10,2) default 0;
alter table fee_vouchers add column if not exists is_partial boolean default false;
alter table fee_vouchers add column if not exists student_phone text;

alter table fee_vouchers drop constraint if exists fee_vouchers_status_check;
alter table fee_vouchers add constraint fee_vouchers_status_check
  check (status in ('paid', 'unpaid', 'overdue', 'partial'));

-- Backfill legacy rows (safe if columns already populated)
update fee_vouchers set amount_paid = amount where status = 'paid' and (amount_paid is null or amount_paid = 0);
update fee_vouchers set amount_paid = 0 where status in ('unpaid', 'overdue');
update fee_vouchers set remaining_amount = amount where status in ('unpaid', 'overdue');
update fee_vouchers set remaining_amount = 0 where status = 'paid';
