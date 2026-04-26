-- Salary vouchers system similar to fee vouchers
-- Run after schema.sql and phase2.sql

create table if not exists salary_vouchers (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references teachers(id) on delete cascade,
  voucher_number text unique not null,
  amount numeric(10,2) not null,
  due_date date not null,
  issue_date date default current_date,
  month text not null,
  status text check (status in ('paid', 'unpaid', 'overdue')) default 'unpaid',
  payment_date date,
  payment_method text,
  received_by text,
  remarks text,
  created_at timestamptz default now()
);

-- Function to generate salary voucher number
create or replace function generate_salary_voucher_number()
returns trigger
language plpgsql
as $$
declare
  year_part text := extract(year from now())::text;
  month_part text := lpad(extract(month from now())::text, 2, '0');
  n_existing int;
  seq_num text;
begin
  n_existing := (
    select count(*)::int
    from salary_vouchers
    where extract(year from created_at) = extract(year from now())
    and extract(month from created_at) = extract(month from now())
  );
  seq_num := lpad((n_existing + 1)::text, 4, '0');
  new.voucher_number := 'SAL-' || year_part || month_part || '-' || seq_num;
  return new;
end;
$$;

drop trigger if exists set_salary_voucher_number on salary_vouchers;
create trigger set_salary_voucher_number
before insert on salary_vouchers
for each row
when (new.voucher_number is null)
execute function generate_salary_voucher_number();

-- Function to auto-generate salary vouchers at month end
create or replace function generate_monthly_salary_vouchers()
returns void
language plpgsql
as $$
declare
  prev_month text;
  prev_month_start date;
  prev_month_end date;
  teacher_record record;
begin
  -- Get previous month
  prev_month := to_char(current_date - interval '1 month', 'YYYY-MM');
  prev_month_start := date_trunc('month', current_date - interval '1 month');
  prev_month_end := (date_trunc('month', current_date) - interval '1 day')::date;

  -- Generate vouchers for active teachers
  for teacher_record in
    select t.id, t.salary, t.employee_code,
           coalesce(t.full_name, p.full_name, 'Teacher') as teacher_name
    from teachers t
    left join profiles p on t.profile_id = p.id
    where t.status = 'active' and t.salary > 0
  loop
    -- Check if voucher already exists for this teacher and month
    if not exists (
      select 1 from salary_vouchers
      where teacher_id = teacher_record.id
      and month = prev_month
    ) then
      insert into salary_vouchers (
        teacher_id,
        amount,
        due_date,
        month,
        status
      ) values (
        teacher_record.id,
        teacher_record.salary,
        prev_month_end + interval '10 days', -- Due 10 days after month end
        prev_month,
        'unpaid'
      );
    end if;
  end loop;
end;
$$;

-- RLS
alter table salary_vouchers enable row level security;

drop policy if exists "salary_vouchers_all" on salary_vouchers;
create policy "salary_vouchers_all" on salary_vouchers for all to authenticated using (true) with check (true);
