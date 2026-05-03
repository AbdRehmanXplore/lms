-- Monthly fee vouchers + salary_records automation (run in Supabase SQL Editor after schema.sql, partial_payment.sql, fee_voucher_allocate.sql).
-- Uses pg_cron (enable under Database > Extensions on Supabase if needed).

create extension if not exists "uuid-ossp";
-- Enable pg_cron from Supabase Dashboard (Database → Extensions) before scheduling jobs below.

-- Teachers joining date (may already exist from phase2.sql)
alter table teachers add column if not exists joining_date date;

-- ---------------------------------------------------------------------------
-- salary_records (canonical monthly salary rows for the app UI)
-- ---------------------------------------------------------------------------
create table if not exists salary_records (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references teachers(id) on delete cascade not null,
  month text not null,
  year text not null,
  amount numeric(10,2) not null,
  status text check (status in ('paid', 'unpaid')) default 'unpaid',
  payment_date date,
  payment_method text,
  paid_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(teacher_id, month, year)
);

alter table salary_records enable row level security;
drop policy if exists "salary_records_all" on salary_records;
drop policy if exists "salary_all" on salary_records;
create policy "salary_records_all" on salary_records
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on salary_records to authenticated;

-- ---------------------------------------------------------------------------
-- Monthly fee vouchers (1st of month): one unpaid voucher per active student
-- Month label matches app: "May 2026" (FMMonth YYYY)
-- ---------------------------------------------------------------------------
create or replace function public.generate_monthly_fee_vouchers()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_month text;
  v_voucher_number text;
  v_count integer;
  v_year int := extract(year from now())::int;
  v_amt numeric(10,2) := 2500;
begin
  v_month := to_char(now(), 'FMMonth YYYY');

  for v_student in
    select s.id, s.phone
    from students s
    join classes c on s.class_id = c.id
    where s.status = 'active'
  loop
    select count(*) into v_count
    from fee_vouchers
    where student_id = v_student.id
      and month = v_month;

    if v_count = 0 then
      v_voucher_number := public.allocate_fee_voucher_number(v_year);
      insert into fee_vouchers (
        student_id,
        voucher_number,
        amount,
        due_date,
        issue_date,
        month,
        status,
        student_phone,
        amount_paid,
        remaining_amount,
        is_partial
      ) values (
        v_student.id,
        v_voucher_number,
        v_amt,
        (date_trunc('month', now()) + interval '15 days')::date,
        current_date,
        v_month,
        'unpaid',
        v_student.phone,
        0,
        v_amt,
        false
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.generate_monthly_fee_vouchers() to postgres;
grant execute on function public.generate_monthly_fee_vouchers() to service_role;
grant execute on function public.generate_monthly_fee_vouchers() to authenticated;

-- ---------------------------------------------------------------------------
-- Monthly salary rows (1st of month): unpaid row per active teacher (if missing)
-- month = full English name, e.g. "May" (trimmed)
-- Function name: generate_monthly_salaries() — zero-arg overload (distinct from generate_monthly_salaries(text) on teacher_salaries if present)
-- ---------------------------------------------------------------------------
drop function if exists public.generate_monthly_salary_records();

create or replace function public.generate_monthly_salaries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher record;
  v_month text;
  v_year text;
  v_count integer;
begin
  v_month := trim(to_char(now(), 'Month'));
  v_year := extract(year from now())::text;

  for v_teacher in
    select id, salary
    from teachers
    where status = 'active'
  loop
    select count(*) into v_count
    from salary_records
    where teacher_id = v_teacher.id
      and trim(month) = v_month
      and year = v_year;

    if v_count = 0 then
      insert into salary_records (
        teacher_id,
        month,
        year,
        amount,
        status
      ) values (
        v_teacher.id,
        v_month,
        v_year,
        coalesce(v_teacher.salary, 0),
        'unpaid'
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.generate_monthly_salaries() to postgres;
grant execute on function public.generate_monthly_salaries() to service_role;
grant execute on function public.generate_monthly_salaries() to authenticated;

-- ---------------------------------------------------------------------------
-- Supabase pg_cron (run once in SQL Editor after enabling pg_cron extension)
-- If job names already exist, unschedule from Dashboard or: select cron.unschedule(jobid) from cron.job where jobname = '...';
-- ---------------------------------------------------------------------------
-- select cron.schedule(
--   'monthly-fee-vouchers',
--   '0 0 1 * *',
--   'select public.generate_monthly_fee_vouchers();'
-- );
-- select cron.schedule(
--   'monthly-salary-records',
--   '0 0 1 * *',
--   'select public.generate_monthly_salaries();'
-- );
