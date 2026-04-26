-- Run in Supabase SQL Editor after schema.sql + phase2.sql

-- ========== FEATURE 1: Student UID ==========
alter table students add column if not exists student_uid text unique;

create or replace function generate_student_uid()
returns trigger
language plpgsql
as $$
declare
  year_part text := extract(year from now())::text;
  n_existing int;
  seq_num text;
begin
  -- Use := (subquery) so this never parses as SQL "SELECT ... INTO new_table" outside plpgsql
  n_existing := (
    select count(*)::int
    from students
    where extract(year from coalesce(created_at, now())) = extract(year from now())
  );
  seq_num := lpad((n_existing + 1)::text, 4, '0');
  new.student_uid := 'SMS-' || year_part || '-' || seq_num;
  return new;
end;
$$;

drop trigger if exists set_student_uid on students;
create trigger set_student_uid
before insert on students
for each row
when (new.student_uid is null)
execute function generate_student_uid();

-- Backfill existing rows without UID (one-time)
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY extract(year from coalesce(created_at, now()))
      ORDER BY created_at
    ) AS rn,
    extract(year from coalesce(created_at, now()))::int AS y
  FROM students
  WHERE student_uid IS NULL
)
UPDATE students s
SET student_uid = 'SMS-' || r.y::text || '-' || lpad(r.rn::text, 4, '0')
FROM ranked r
WHERE s.id = r.id;

-- ========== FEATURE 2: Exam schedules (admit cards) ==========
create table if not exists exam_schedules (
  id uuid primary key default uuid_generate_v4(),
  exam_type text not null,
  exam_year text not null,
  class_id uuid references classes(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  exam_date date not null,
  start_time time not null,
  end_time time not null,
  venue text,
  created_at timestamptz default now()
);

-- ========== FEATURE 3: Timetable ==========
create table if not exists timetable (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references classes(id) on delete cascade,
  day text check (day in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')) not null,
  period_number integer not null check (period_number between 1 and 8),
  start_time time not null,
  end_time time not null,
  subject_id uuid references subjects(id) on delete set null,
  teacher_id uuid references teachers(id) on delete set null,
  room text,
  created_at timestamptz default now(),
  unique(class_id, day, period_number)
);

-- ========== FEATURE 4: Expenses ==========
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text check (category in (
    'Salaries', 'Utilities', 'Maintenance',
    'Stationery', 'Events', 'Equipment', 'Other'
  )) not null,
  amount numeric(10,2) not null,
  expense_date date not null default current_date,
  paid_to text,
  payment_method text check (payment_method in ('Cash', 'Bank Transfer', 'Cheque')),
  receipt_number text,
  notes text,
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- ========== FEATURE 5: Teacher attendance & leaves ==========
create table if not exists teacher_attendance (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references teachers(id) on delete cascade,
  date date not null default current_date,
  status text check (status in ('present', 'absent', 'late', 'leave')) not null default 'present',
  check_in_time time,
  check_out_time time,
  remarks text,
  marked_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(teacher_id, date)
);

create table if not exists teacher_leaves (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references teachers(id) on delete cascade,
  leave_type text check (leave_type in ('Sick Leave', 'Casual Leave', 'Emergency Leave', 'Other')),
  from_date date not null,
  to_date date not null,
  reason text,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  approved_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create or replace view teacher_monthly_attendance as
select
  ta.teacher_id,
  t.employee_code,
  coalesce(t.full_name, p.full_name, 'Teacher') as teacher_name,
  to_char(ta.date, 'YYYY-MM') as month_year,
  count(*) filter (where ta.status = 'present') as present_count,
  count(*) filter (where ta.status = 'absent') as absent_count,
  count(*) filter (where ta.status = 'late') as late_count,
  count(*) filter (where ta.status = 'leave') as leave_count,
  count(*)::bigint as total_days,
  round(
    case when count(*) = 0 then 0::numeric
    else (count(*) filter (where ta.status = 'present'))::numeric / nullif(count(*)::numeric, 0) * 100
    end, 1
  ) as attendance_percentage
from teacher_attendance ta
join teachers t on ta.teacher_id = t.id
left join profiles p on t.profile_id = p.id
group by ta.teacher_id, t.employee_code, t.full_name, p.full_name, to_char(ta.date, 'YYYY-MM');

-- RLS
alter table exam_schedules enable row level security;
alter table timetable enable row level security;
alter table expenses enable row level security;
alter table teacher_attendance enable row level security;
alter table teacher_leaves enable row level security;

drop policy if exists "exam_schedules_all" on exam_schedules;
drop policy if exists "timetable_all" on timetable;
drop policy if exists "expenses_all" on expenses;
drop policy if exists "teacher_attendance_all" on teacher_attendance;
drop policy if exists "teacher_leaves_all" on teacher_leaves;

create policy "exam_schedules_all" on exam_schedules for all to authenticated using (true) with check (true);
create policy "timetable_all" on timetable for all to authenticated using (true) with check (true);
create policy "expenses_all" on expenses for all to authenticated using (true) with check (true);
create policy "teacher_attendance_all" on teacher_attendance for all to authenticated using (true) with check (true);
create policy "teacher_leaves_all" on teacher_leaves for all to authenticated using (true) with check (true);

grant select on teacher_monthly_attendance to authenticated;
