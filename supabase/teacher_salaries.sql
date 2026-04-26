-- Teacher monthly salaries (run after teachers + profiles + expenses exist)

create table if not exists teacher_salaries (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references teachers(id) on delete cascade,
  month_year text not null,
  salary_amount numeric(10,2) not null,
  status text check (status in ('paid', 'unpaid')) default 'unpaid',
  due_date date not null,
  paid_date date,
  paid_by uuid references profiles(id),
  payment_method text check (payment_method in ('Cash', 'Bank Transfer', 'Cheque')),
  remarks text,
  created_at timestamptz default now(),
  unique(teacher_id, month_year)
);

-- Ensure rows exist for all active teachers for a given month (default: current calendar month)
create or replace function generate_monthly_salaries(p_month_year text default null)
returns void
language plpgsql
as $$
declare
  v_month text := coalesce(nullif(trim(p_month_year), ''), to_char(now(), 'YYYY-MM'));
  v_month_start date := to_date(v_month || '-01', 'YYYY-MM-DD');
  v_due date := (date_trunc('month', v_month_start) + interval '10 days')::date;
begin
  insert into teacher_salaries (
    teacher_id,
    month_year,
    salary_amount,
    status,
    due_date
  )
  select
    t.id,
    v_month,
    t.salary,
    'unpaid',
    v_due
  from teachers t
  where t.status = 'active'
  on conflict (teacher_id, month_year) do nothing;
end;
$$;

alter table teacher_salaries enable row level security;

drop policy if exists "salaries_all" on teacher_salaries;
drop policy if exists "teacher_salaries_all" on teacher_salaries;
create policy "teacher_salaries_all" on teacher_salaries
  for all to authenticated using (true) with check (true);

grant execute on function generate_monthly_salaries(text) to authenticated;
