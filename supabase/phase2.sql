-- Run after schema.sql in Supabase SQL Editor

-- Teacher display name (independent of auth profile)
alter table teachers add column if not exists full_name text;

-- Teacher contact fields (when not linked to auth profile)
alter table teachers add column if not exists email text;
alter table teachers add column if not exists phone text;
alter table teachers add column if not exists cnic text;
alter table teachers add column if not exists address text;
alter table teachers add column if not exists profile_photo text;
alter table teachers add column if not exists joining_date date;

create table if not exists teacher_salary_history (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  month text not null,
  amount numeric(10,2) not null,
  paid_at timestamptz default now()
);

alter table fee_vouchers add column if not exists line_items jsonb;

-- Seed default subjects per class (Class 1–10), skip if that subject row exists
insert into subjects (class_id, name, max_marks, passing_marks)
select c.id, v.name, 100, 40
from classes c
cross join (
  values
    ('English'),
    ('Urdu'),
    ('Mathematics'),
    ('Science'),
    ('Islamiat')
) as v(name)
where not exists (
  select 1 from subjects s where s.class_id = c.id and s.name = v.name
);

-- Auto profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    case
      when coalesce(new.raw_user_meta_data->>'role', '') = 'admin' then 'admin'::text
      else 'teacher'::text
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Views
create or replace view fee_defaulters as
select
  s.id as student_id,
  s.full_name,
  s.roll_number,
  s.father_name,
  c.name as class_name,
  count(fv.id) filter (where fv.status in ('unpaid', 'overdue')) as unpaid_months,
  coalesce(sum(fv.amount) filter (where fv.status in ('unpaid', 'overdue')), 0) as total_unpaid,
  min(fv.due_date) filter (where fv.status in ('unpaid', 'overdue')) as oldest_due_date
from students s
join classes c on s.class_id = c.id
left join fee_vouchers fv on fv.student_id = s.id
where s.status = 'active'
group by s.id, s.full_name, s.roll_number, s.father_name, c.name
having count(fv.id) filter (where fv.status in ('unpaid', 'overdue')) > 0;

-- RLS
alter table profiles enable row level security;
alter table teachers enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table subjects enable row level security;
alter table results enable row level security;
alter table fee_vouchers enable row level security;
alter table attendance enable row level security;
alter table announcements enable row level security;
alter table teacher_salary_history enable row level security;

drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_insert" on profiles;
drop policy if exists "profiles_update" on profiles;
drop policy if exists "teachers_all" on teachers;
drop policy if exists "classes_all" on classes;
drop policy if exists "students_all" on students;
drop policy if exists "subjects_all" on subjects;
drop policy if exists "results_all" on results;
drop policy if exists "fee_vouchers_all" on fee_vouchers;
drop policy if exists "attendance_all" on attendance;
drop policy if exists "announcements_all" on announcements;
drop policy if exists "teacher_salary_history_all" on teacher_salary_history;

create policy "profiles_select" on profiles for select to authenticated using (true);
create policy "profiles_insert" on profiles for insert to authenticated with check (true);
create policy "profiles_update" on profiles for update to authenticated using (true);

create policy "teachers_all" on teachers for all to authenticated using (true) with check (true);
create policy "classes_all" on classes for all to authenticated using (true) with check (true);
create policy "students_all" on students for all to authenticated using (true) with check (true);
create policy "subjects_all" on subjects for all to authenticated using (true) with check (true);
create policy "results_all" on results for all to authenticated using (true) with check (true);
create policy "fee_vouchers_all" on fee_vouchers for all to authenticated using (true) with check (true);
create policy "attendance_all" on attendance for all to authenticated using (true) with check (true);
create policy "announcements_all" on announcements for all to authenticated using (true) with check (true);
create policy "teacher_salary_history_all" on teacher_salary_history for all to authenticated using (true) with check (true);

grant select on fee_defaulters to authenticated;

create index if not exists idx_attendance_date on attendance(date);
create index if not exists idx_attendance_student_date on attendance(student_id, date);
create index if not exists idx_fee_vouchers_student on fee_vouchers(student_id, status);
create index if not exists idx_fee_vouchers_month on fee_vouchers(month, status);
