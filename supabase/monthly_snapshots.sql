create table if not exists monthly_snapshots (
  id uuid primary key default uuid_generate_v4(),
  month_year text not null unique,
  total_students integer default 0,
  total_teachers integer default 0,
  fees_collected numeric(10,2) default 0,
  fees_pending numeric(10,2) default 0,
  total_expenses numeric(10,2) default 0,
  net_balance numeric(10,2) default 0,
  avg_attendance_percentage numeric(5,2) default 0,
  snapshot_data jsonb,
  created_at timestamptz default now()
);

create or replace view monthly_attendance_summary as
select
  to_char(a.date, 'YYYY-MM') as month_year,
  round(
    case
      when count(*) = 0 then 0::numeric
      else (count(*) filter (where a.status in ('present', 'late')))::numeric / count(*)::numeric * 100
    end,
    2
  ) as attendance_percentage
from attendance a
group by to_char(a.date, 'YYYY-MM');

create or replace function create_monthly_snapshot(target_month text)
returns void as $$
declare
  v_fees_collected numeric;
  v_fees_pending numeric;
  v_total_expenses numeric;
  v_avg_attendance numeric;
  v_year text;
  v_month int;
  v_month_label text;
begin
  v_year := split_part(target_month, '-', 1);
  v_month := split_part(target_month, '-', 2)::int;
  v_month_label := to_char(make_date(v_year::int, v_month, 1), 'FMMonth') || ' ' || v_year;

  select coalesce(sum(amount), 0) into v_fees_collected
  from fee_vouchers
  where to_char(payment_date, 'YYYY-MM') = target_month
  and status = 'paid';

  select coalesce(sum(amount), 0) into v_fees_pending
  from fee_vouchers
  where month ilike '%' || v_month_label || '%'
  and status in ('unpaid', 'overdue');

  select coalesce(sum(amount), 0) into v_total_expenses
  from expenses
  where to_char(expense_date, 'YYYY-MM') = target_month;

  select coalesce(avg(attendance_percentage), 0) into v_avg_attendance
  from monthly_attendance_summary
  where month_year = target_month;

  insert into monthly_snapshots (
    month_year,
    total_students,
    total_teachers,
    fees_collected,
    fees_pending,
    total_expenses,
    net_balance,
    avg_attendance_percentage
  ) values (
    target_month,
    (select count(*) from students where status = 'active'),
    (select count(*) from teachers where status = 'active'),
    v_fees_collected,
    v_fees_pending,
    v_total_expenses,
    v_fees_collected - v_total_expenses,
    v_avg_attendance
  )
  on conflict (month_year) do update set
    fees_collected = excluded.fees_collected,
    fees_pending = excluded.fees_pending,
    total_expenses = excluded.total_expenses,
    net_balance = excluded.net_balance,
    avg_attendance_percentage = excluded.avg_attendance_percentage;
end;
$$ language plpgsql;

alter table monthly_snapshots enable row level security;
drop policy if exists "snapshots_all" on monthly_snapshots;
create policy "snapshots_all" on monthly_snapshots for all to authenticated using (true) with check (true);

alter table fee_vouchers add column if not exists received_by text;
alter table fee_vouchers add column if not exists is_defaulter boolean default false;

grant select on monthly_attendance_summary to authenticated;
