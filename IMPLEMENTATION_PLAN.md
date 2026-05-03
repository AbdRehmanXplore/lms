# 🏫 NEW OXFORD GRAMMER SCHOOL — Management System
# Complete Implementation Plan for Cursor AI

> **HOW TO USE THIS FILE:**
> Open this file in Cursor, press `Ctrl+L` to open Cursor Chat,
> then type: "Read this file completely and implement everything that is 
> missing or incomplete. Follow the checklist order exactly."

---

## PROJECT CURRENT STATUS

*Updated to match the repository (May 2026). Revisit this section when the app changes.*

### Completed (built and in use)

- **Joining & admission dates:** Teachers have required **Joining Date** (default today) saved to `teachers.joining_date`; students have required **Admission Date** (default today) saved to `students.admission_date`. Detail pages show formatted dates, duration (years + months), and teacher **Salary** tab + student **Fees** tab with current-month fee status, history, outstanding total, and manual **Generate voucher** for the current month when missing.
- **Monthly automation (Supabase):** Script `supabase/monthly_reset_salary_records.sql` adds `salary_records`, `generate_monthly_fee_vouchers()`, and **`generate_monthly_salaries()`** (zero-arg: unpaid `salary_records` for each **active** teacher **except** those whose **`joining_date`** falls in the **current** calendar month—first row appears on the **1st of next month**). **pg_cron** comments are in that file. **No** `salary_records` row is created when adding a teacher in-app. Optional one-time cleanup: `supabase/salary_records_joining_cleanup.sql` (drops `is_joining_month` if it ever existed). New students still do **not** get an automatic fee voucher for the join month.
- **Teacher salaries UI:** `/salaries` lists **only teachers who already have a `salary_records` row** for the selected calendar month (no client seeding of missing rows). Teacher list badge reads from `salary_records` only. Teacher detail **Salary** tab shows a clear empty state when there are no rows yet. Mark paid / bulk paid / dashboard salary-due unchanged in spirit.
- **Auth & access:** Login and register, Supabase session, middleware protection of dashboard routes.
- **Branding:** School name and `SchoolLogo` on login, sidebar, and print-oriented components.
- **Dashboard:** Live stats, fee vs expense area chart, class distribution and attendance trends, “fee by class” table, search (Ctrl+K), fee defaulters snapshot, quick actions, teacher attendance summary.
- **Classes:** 13-class overview, per-class student table with search, link to add student.
- **Teachers:** List, add/edit, profile photo to storage, detail with salary/attendance context, salary module (`/salaries`, `/finance/salaries` redirect, legacy `/salaries/add` voucher routes if present).
- **Students:** List with Student ID, CRUD, auto `SMS-YYYY-XXXX` UID, profile photo, detail with fee history and attendance counts, delete with confirm.
- **Results:** Per-class flow, 7 subjects, grades, save/update, generated list, print card.
- **Fees:** Unpaid/paid/defaulters tabs, search/filter, **partial payments** (columns `amount_paid`, `remaining_amount`, `is_partial`; status `partial`; remainder vouchers `*-R` / month suffix `(Remaining)`), mark payment modal with amount validation, defaulter flag + WhatsApp reminders, bulk class voucher generation, voucher detail/print receipts (paid full vs partial).
- **Student attendance** and **attendance history** pages.
- **Teacher attendance** (today with auto entry/exit times, history with daily times/hours, leaves) and dashboard-relevant stats (first/last arrival).
- **Timetable**, **admit cards**, **expenses** (summary + Recharts), **monthly** and **yearly** history.
- **Announcements** and **Settings**.

### Pending or partial (vs. original spec)

- **UI polish:** Dedicated loading **skeletons** are not used consistently (many views use text “Loading…” only).
- **Student detail:** Plan asked for **tabs** (e.g. profile / fees / attendance / **results**); the page is a **single scroll** with fee list + edit form—no in-page results tab.
- **Student attendance on profile:** No **attendance calendar** on student detail; history lives under `/attendance/history` for the school workflow.
- **Dashboard copy vs. data:** Widgets match intent (defaulters, teacher attendance) but not always the exact phrasing in the old checklist (e.g. “X Present | X Absent” vs. aggregate %).
- **Ongoing QA:** End-to-end verification of every print flow and edge-case form validation in production data.

### Known issues / notes

- **Next.js 16** may log a **deprecation** about the `middleware` file name (suggests `proxy`); the build still completes successfully.
- The **reference SQL** block below may still define `whatsapp_reminders` and `whatsapp_reminder_log` for **legacy databases**. The **application does not use** WhatsApp or those tables.

### Database: `salary_records` & monthly automation

Run in Supabase (after `partial_payment.sql`, `fee_voucher_allocate.sql`): **`supabase/monthly_reset_salary_records.sql`**.

| Object | Purpose |
|--------|---------|
| **`salary_records`** | One row per teacher per calendar month (`month` = English full name, `year` text), `amount`, `status` `paid`/`unpaid`, optional `payment_date`, `payment_method`, `paid_by`. |
| **`generate_monthly_fee_vouchers()`** | On the 1st (via cron): for each **active** student with a **class**, inserts an **unpaid** `fee_vouchers` row for **`to_char(now(), 'FMMonth YYYY')`** if none exists (default amount 2500, partial-payment columns set). |
| **`generate_monthly_salaries()`** (zero-arg) | On the 1st (via cron): inserts an **unpaid** `salary_records` row for current month/year when missing; **skips** teachers whose `joining_date` is in the **same** calendar month (first payroll row next month). If you also deploy legacy **`generate_monthly_salaries(text)`** from `teacher_salaries.sql`, both can coexist; if PostgREST RPC is ambiguous, rename or drop the legacy overload. |
| **`salary_records_joining_cleanup.sql`** | Optional: remove `is_joining_month` rows/column if present. |
| **pg_cron** | Uncomment the two `cron.schedule(...)` blocks at the bottom of that script after enabling the **pg_cron** extension in the project Dashboard. |
| **`teacher_attendance_time_columns.sql`** | Ensures `check_in_time`, `check_out_time`, and optional `check_in_date` exist on `teacher_attendance` for entry/exit tracking. |

### Known bugs fixed (recent)

- **Fee defaulters page stuck on “Compiling” / endless load:** `/fees/defaulters` now loads via direct `fee_vouchers` queries + client aggregation instead of broken nested `.eq('fee_vouchers…')` filters / reliance on `fee_defaulters` views.
- **Partial payments:** Added schema columns + app logic (`supabase/partial_payment.sql`); dashboard/expenses **collections** charts sum **`amount_paid`** for `paid` + **`partial`** vouchers.

---

## 🔧 TECH STACK
- **Framework**: Next.js 14 (App Router, TypeScript)
- **Database**: Supabase (already connected)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Print**: react-to-print
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Notifications**: Sonner (toast)
- **Storage**: Supabase Storage (bucket: avatars)

---

## 🏫 SCHOOL INFO
- **Name**: NEW OXFORD GRAMMER SCHOOL
- **Logo**: `/public/logo.png` (use next/image, fallback to "NOGS" text if file missing)
- **Logo appears on**: Login page, Sidebar, Result cards, Fee vouchers, Admit cards

---

## 📦 REQUIRED PACKAGES
```bash
npm install @supabase/supabase-js @supabase/ssr lucide-react 
react-hook-form @hookform/resolvers zod recharts react-to-print 
sonner date-fns zustand clsx tailwind-merge
```

---

## 🗄️ COMPLETE SQL — RUN IN SUPABASE SQL EDITOR

Run this entire block in Supabase SQL Editor. *The script may include `whatsapp_reminders` and `whatsapp_reminder_log` for existing databases; the current app does not use them.*

```sql
-- Extensions
create extension if not exists "uuid-ossp";

-- Profiles
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text unique not null,
  role text check (role in ('admin', 'teacher')) default 'teacher',
  phone text,
  address text,
  joining_date date,
  created_at timestamptz default now()
);

-- Teachers
create table if not exists teachers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade,
  full_name text,
  employee_code text unique not null,
  subject text not null,
  qualification text,
  salary numeric(10,2) not null default 0,
  class_assigned text,
  status text check (status in ('active', 'inactive')) default 'active',
  profile_photo text,
  created_at timestamptz default now()
);

-- Classes (14 classes)
create table if not exists classes (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  section text default 'A',
  teacher_id uuid references teachers(id),
  created_at timestamptz default now()
);

-- Insert all 14 classes
insert into classes (name, section) values
  ('Play Group', 'A'),
  ('Montessory', 'A'),
  ('Junior', 'A'),
  ('Senior', 'A'),
  ('Class 1', 'A'),
  ('Class 2', 'A'),
  ('Class 3', 'A'),
  ('Class 4', 'A'),
  ('Class 5', 'A'),
  ('Class 6', 'A'),
  ('Class 7', 'A'),
  ('Class 8', 'A'),
  ('Class 9', 'A'),
  ('Class 10', 'A')
on conflict (name) do nothing;

-- Students
create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  student_uid text unique,
  roll_number text unique not null,
  full_name text not null,
  father_name text not null,
  mother_name text,
  date_of_birth date,
  gender text check (gender in ('Male', 'Female', 'Other')),
  class_id uuid references classes(id) on delete set null,
  address text,
  phone text,
  email text,
  admission_date date default current_date,
  profile_photo text,
  status text check (status in ('active', 'inactive', 'graduated')) default 'active',
  whatsapp_reminders boolean default true,
  created_at timestamptz default now()
);

-- Student UID auto-generate
create or replace function generate_student_uid()
returns trigger language plpgsql as $$
declare
  year_part text := extract(year from now())::text;
  n_existing int;
  seq_num text;
begin
  select count(*)::int into n_existing
  from students
  where extract(year from coalesce(created_at, now())) = extract(year from now());
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

-- Backfill existing students
with ranked as (
  select id,
    row_number() over (
      partition by extract(year from coalesce(created_at, now()))
      order by created_at
    ) as rn,
    extract(year from coalesce(created_at, now()))::int as y
  from students where student_uid is null
)
update students s
set student_uid = 'SMS-' || r.y::text || '-' || lpad(r.rn::text, 4, '0')
from ranked r where s.id = r.id;

-- Subjects (7 fixed subjects for every class)
create table if not exists subjects (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references classes(id) on delete cascade,
  name text not null,
  max_marks integer default 100,
  passing_marks integer default 40,
  created_at timestamptz default now()
);

insert into subjects (class_id, name, max_marks, passing_marks)
select c.id, s.name, 100, 40
from classes c
cross join (values
  ('English'), ('Urdu'), ('Math'), ('Science'),
  ('Social Studies'), ('Islamiat'), ('Sindhi')
) as s(name)
on conflict do nothing;

-- Results
create table if not exists results (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  class_id uuid references classes(id),
  subject_id uuid references subjects(id),
  exam_type text check (exam_type in ('Monthly Test','Mid-Term','Final Exam','Unit Test')) default 'Final Exam',
  marks_obtained numeric(5,2),
  max_marks integer default 100,
  exam_year text default '2025',
  teacher_id uuid references teachers(id),
  is_edited boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(student_id, subject_id, exam_type, exam_year)
);

-- Fee Vouchers
create table if not exists fee_vouchers (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  voucher_number text unique not null,
  amount numeric(10,2) not null,
  due_date date not null,
  issue_date date default current_date,
  month text not null,
  status text check (status in ('paid', 'unpaid', 'overdue')) default 'unpaid',
  payment_date date,
  payment_method text check (payment_method in ('Cash', 'Bank Transfer', 'Cheque')),
  received_by text,
  remarks text,
  created_at timestamptz default now()
);

-- Attendance (Students)
create table if not exists attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  class_id uuid references classes(id),
  date date not null default current_date,
  status text check (status in ('present', 'absent', 'late')) default 'present',
  created_at timestamptz default now(),
  unique(student_id, date)
);

-- Teacher Attendance
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

-- Teacher Leaves
create table if not exists teacher_leaves (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references teachers(id) on delete cascade,
  leave_type text check (leave_type in ('Sick Leave','Casual Leave','Emergency Leave','Other')),
  from_date date not null,
  to_date date not null,
  reason text,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  approved_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Timetable
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

-- Exam Schedules (Admit Cards)
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

-- Expenses
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text check (category in (
    'Salaries','Utilities','Maintenance','Stationery','Events','Equipment','Other'
  )) not null,
  amount numeric(10,2) not null,
  expense_date date not null default current_date,
  paid_to text,
  payment_method text check (payment_method in ('Cash','Bank Transfer','Cheque')),
  receipt_number text,
  notes text,
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Announcements
create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text not null,
  target text check (target in ('all','teachers','students')) default 'all',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- WhatsApp Reminders Log
create table if not exists whatsapp_reminder_log (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  voucher_id uuid references fee_vouchers(id) on delete cascade,
  phone_number text not null,
  message text not null,
  sent_at timestamptz default now(),
  status text check (status in ('sent','failed','skipped')) default 'sent',
  skip_reason text
);

-- Monthly Snapshots
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

-- Views
create or replace view monthly_attendance_summary as
select
  a.student_id, s.full_name, s.roll_number, c.name as class_name,
  to_char(a.date, 'YYYY-MM') as month_year,
  count(*) filter (where a.status = 'present') as present_count,
  count(*) filter (where a.status = 'absent') as absent_count,
  count(*) filter (where a.status = 'late') as late_count,
  count(*) as total_days,
  round(count(*) filter (where a.status = 'present')::numeric / nullif(count(*)::numeric,0) * 100, 1) as attendance_percentage
from attendance a
join students s on a.student_id = s.id
join classes c on a.class_id = c.id
group by a.student_id, s.full_name, s.roll_number, c.name, to_char(a.date, 'YYYY-MM');

create or replace view teacher_monthly_attendance as
select
  ta.teacher_id, t.employee_code,
  coalesce(t.full_name, p.full_name, 'Teacher') as teacher_name,
  to_char(ta.date, 'YYYY-MM') as month_year,
  count(*) filter (where ta.status = 'present') as present_count,
  count(*) filter (where ta.status = 'absent') as absent_count,
  count(*) filter (where ta.status = 'late') as late_count,
  count(*) filter (where ta.status = 'leave') as leave_count,
  count(*) as total_days,
  round(count(*) filter (where ta.status = 'present')::numeric / nullif(count(*)::numeric,0) * 100, 1) as attendance_percentage
from teacher_attendance ta
join teachers t on ta.teacher_id = t.id
left join profiles p on t.profile_id = p.id
group by ta.teacher_id, t.employee_code, t.full_name, p.full_name, to_char(ta.date, 'YYYY-MM');

create or replace view fee_defaulters as
select
  s.id as student_id, s.full_name, s.roll_number, s.student_uid,
  s.father_name, s.phone, s.whatsapp_reminders, c.name as class_name,
  count(fv.id) filter (where fv.status = 'unpaid') as unpaid_months,
  sum(fv.amount) filter (where fv.status = 'unpaid') as total_unpaid,
  min(fv.due_date) filter (where fv.status = 'unpaid') as oldest_due_date
from students s
join classes c on s.class_id = c.id
left join fee_vouchers fv on fv.student_id = s.id
group by s.id, s.full_name, s.roll_number, s.student_uid,
  s.father_name, s.phone, s.whatsapp_reminders, c.name
having count(fv.id) filter (where fv.status = 'unpaid') > 0;

-- Monthly snapshot function
create or replace function create_monthly_snapshot(target_month text)
returns void as $$
declare
  v_fees_collected numeric;
  v_fees_pending numeric;
  v_total_expenses numeric;
  v_avg_attendance numeric;
begin
  select coalesce(sum(amount),0) into v_fees_collected
  from fee_vouchers
  where to_char(payment_date, 'YYYY-MM') = target_month and status = 'paid';

  select coalesce(sum(amount),0) into v_fees_pending
  from fee_vouchers
  where month = target_month and status = 'unpaid';

  select coalesce(sum(amount),0) into v_total_expenses
  from expenses
  where to_char(expense_date, 'YYYY-MM') = target_month;

  select coalesce(avg(attendance_percentage),0) into v_avg_attendance
  from monthly_attendance_summary
  where month_year = target_month;

  insert into monthly_snapshots (
    month_year, total_students, total_teachers,
    fees_collected, fees_pending, total_expenses,
    net_balance, avg_attendance_percentage
  ) values (
    target_month,
    (select count(*) from students where status = 'active'),
    (select count(*) from teachers where status = 'active'),
    v_fees_collected, v_fees_pending, v_total_expenses,
    v_fees_collected - v_total_expenses, v_avg_attendance
  )
  on conflict (month_year) do update set
    fees_collected = excluded.fees_collected,
    fees_pending = excluded.fees_pending,
    total_expenses = excluded.total_expenses,
    net_balance = excluded.net_balance,
    avg_attendance_percentage = excluded.avg_attendance_percentage;
end;
$$ language plpgsql;

-- Indexes
create index if not exists idx_attendance_date on attendance(date);
create index if not exists idx_attendance_student on attendance(student_id, date);
create index if not exists idx_fee_student on fee_vouchers(student_id, status);
create index if not exists idx_fee_month on fee_vouchers(month, status);
create index if not exists idx_results_student on results(student_id);
create index if not exists idx_teacher_att_date on teacher_attendance(teacher_id, date);

-- RLS Policies
alter table profiles enable row level security;
alter table teachers enable row level security;
alter table students enable row level security;
alter table classes enable row level security;
alter table subjects enable row level security;
alter table results enable row level security;
alter table fee_vouchers enable row level security;
alter table attendance enable row level security;
alter table teacher_attendance enable row level security;
alter table teacher_leaves enable row level security;
alter table timetable enable row level security;
alter table exam_schedules enable row level security;
alter table expenses enable row level security;
alter table announcements enable row level security;
alter table whatsapp_reminder_log enable row level security;
alter table monthly_snapshots enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','teachers','students','classes','subjects','results',
    'fee_vouchers','attendance','teacher_attendance','teacher_leaves',
    'timetable','exam_schedules','expenses','announcements',
    'whatsapp_reminder_log','monthly_snapshots'
  ] loop
    execute format('drop policy if exists "all_auth_%s" on %s', t, t);
    execute format(
      'create policy "all_auth_%s" on %s for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end$$;

grant select on monthly_attendance_summary to authenticated;
grant select on teacher_monthly_attendance to authenticated;
grant select on fee_defaulters to authenticated;
```

---

## 📁 COMPLETE FILE STRUCTURE

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
└── (dashboard)/
    ├── layout.tsx
    ├── dashboard/page.tsx
    ├── teachers/
    │   ├── page.tsx
    │   ├── add/page.tsx
    │   └── [id]/page.tsx
    ├── students/
    │   ├── page.tsx
    │   ├── add/page.tsx
    │   └── [id]/page.tsx
    ├── classes/
    │   ├── page.tsx
    │   └── [classId]/page.tsx
    ├── results/
    │   ├── page.tsx
    │   └── [classId]/page.tsx
    ├── fees/
    │   ├── page.tsx
    │   ├── add/page.tsx
    │   └── defaulters/page.tsx
    ├── attendance/page.tsx
    ├── teacher-attendance/page.tsx
    ├── timetable/page.tsx
    ├── admit-cards/page.tsx
    ├── expenses/page.tsx
    ├── history/
    │   ├── monthly/page.tsx
    │   └── yearly/page.tsx
    └── announcements/page.tsx

components/
├── layout/
│   ├── Sidebar.tsx
│   └── Header.tsx
├── results/
│   ├── ResultSheet.tsx
│   └── ResultPrintCard.tsx
├── fees/
│   ├── VoucherCard.tsx
│   └── VoucherPrint.tsx
└── ui/
    ├── Button.tsx
    ├── Modal.tsx
    └── Badge.tsx

lib/
├── supabase/
│   ├── client.ts
│   └── server.ts
└── utils/
    ├── calculateGrade.ts
    └── generateVoucherNumber.ts
```

---

## ✅ FEATURE CHECKLIST — STATUS (DONE = `[x]`, PENDING = `[ ]`)

### 1. AUTH & BRANDING
- [x] Login page: logo (/public/logo.png) + "NEW OXFORD GRAMMER SCHOOL" + "Management System"
- [x] Sidebar: logo (40px) + school name at top
- [x] Logo on all printable documents (result/fee/voucher/admit components)
- [x] Supabase Auth login/logout/register working
- [x] Route protection via middleware

### 2. DASHBOARD
- [x] Stats cards with live Supabase data (totals, fees, expenses, counts, attendance rates)
- [x] Global search bar (Ctrl+K) — students by name/roll/student ID
- [x] Charts: fee vs expense over months, class distribution, attendance trend (spec listed different chart names; functionality is in place)
- [x] Fee defaulters widget (snapshot + link to `/fees/defaulters`)
- [x] Teacher attendance today (summary on dashboard) — *spec also asked for explicit Present/Absent/Leave counts; implementation uses a combined rate*
- [x] Quick actions: Add Student, Add Teacher, Generate Voucher (and related links)

### 3. CLASSES (/classes)
- [x] 13 class tiles: Play Group, Junior, Montessory, Class 1–10
- [x] Each tile: class name + student count
- [x] Click class → /classes/[classId]
- [x] Class detail: table of students (Student ID | Roll | Name | Father | …)
- [x] Search within class
- [x] Add Student to class button

### 4. TEACHERS (/teachers)
- [x] List all teachers from Supabase
- [x] Add/Edit/Delete teacher (full CRUD)
- [x] Profile photo upload to Supabase Storage
- [x] Teacher detail page with salary + attendance context
- [x] Mark Salary Paid (via finance/salaries and salary flows)

### 5. STUDENTS (/students)
- [x] List all students with Student ID column
- [x] Add Student: auto-generate SMS-YYYY-XXXX student UID
- [x] Profile photo upload → Supabase Storage → save URL in profile_photo
- [x] Edit/Delete student
- [x] Student detail: profile, **fee history**, **attendance** summary
- [x] Fee alert banner if unpaid fees exist
- [ ] In-page **tabs** (profile / fees / attendance / **results** on one screen per original spec) — *currently single page + fee table + bottom form, no results tab*
- [ ] **Results** for the student on detail page (use `/results/...` from results module in practice)

### 6. RESULTS (/results)
- [x] 13 class tiles overview
- [x] Class results page has TWO sections (generate + generated list) with the behaviors below

  **SECTION A — Generate Result:**
  - [x] All students table with "Generate Result" (or link to flow)
  - [x] Result sheet with AUTO-FILLED student details
  - [x] 7 subjects: English, Urdu, Math, Science, Social Studies, Islamiat, Sindhi
  - [x] Max marks 100 each, Total 700
  - [x] Auto-calculate: Total, Percentage, Grade, Pass/Fail per subject
  - [x] Grade: 90%+=A+, 80+=A, 70+=B, 60+=C, 50+=D, <50=F
  - [x] Subject pass if marks >= 40
  - [x] Save Result → Supabase
  - [x] Save & Print flow

  **SECTION B — Generated Results:**
  - [x] Table of saved results for the class
  - [x] Edit → UPDATE not duplicate
  - [x] "Edited" badge where applicable
  - [x] Print per student

- [x] Printable result card (ResultPrintCard) with school branding and subject grid

### 7. FEES (/fees)
- [x] UNPAID tab + PAID tab
- [x] Generate Voucher: searchable student, photo, autofill, month/amount/due, voucher number
- [x] Mark as Paid modal: Payment Date + Method + Received By
- [x] After marking paid → list refresh (moves to PAID tab in UI)
- [x] Bulk voucher generation per class
- [x] Unpaid / paid voucher print (VoucherPrint and related)
- [ ] *Optional polish:* reconfirm every print edge case in production (stamp wording, long names)

### 8. STUDENT ATTENDANCE (/attendance)
- [x] Date picker + class selector
- [x] Mark Present/Absent/Late per student
- [x] Submit saves to Supabase
- [x] View previous months attendance history (`/attendance/history`)
- [ ] Student **detail** page: attendance **calendar** + deep monthly breakdown (not on student profile; history is global/role workflow)

### 9. TEACHER ATTENDANCE (/teacher-attendance)
- [x] Tab 1 — Today: mark Present/Absent/Late/Leave with **auto entry time** on Present/Late (instant save), **Mark exit** for checkout time, editable `<input type="time">` (stored HH:MM:SS)
- [x] Tab 2 — History: monthly rollup + **daily log** (date, day, status, entry, exit, hours, remarks) when a teacher is selected; drill-down modal includes times
- [x] Tab 3 — Leaves: apply / approve / reject
- [x] Dashboard: teacher attendance % plus **Present | Absent | Late | On leave** counts and **first / last arrival** with 12h time

### 10. TIMETABLE (/timetable)
- [x] Class selector
- [x] Weekly grid (Mon–Sat) × 8 periods
- [x] Click cell → subject + teacher + room
- [x] Color code by subject
- [x] Print timetable (print-friendly)

### 11. ADMIT CARDS (/admit-cards)
- [x] Exam type + year + class
- [x] Exam schedule rows: subject, date, time, venue
- [x] Generate admit cards for class
- [x] Printable cards (layout per component)

### 12. EXPENSES (/expenses)
- [x] Add expense (fields + categories)
- [x] List + category/month style filters
- [x] Summary + pie + bar charts (Recharts)

### 13. HISTORY — MONTHLY (/history/monthly)
- [x] Month + year selection
- [x] Save snapshot (create_monthly_snapshot path via hook)
- [x] Summary + tabs: Summary | Fees | Expenses | Attendance | Results
- [x] Read-only archive view

### 14. HISTORY — YEARLY (/history/yearly)
- [x] Year selector
- [x] Annual summary, fees vs expenses chart
- [x] Per-student month grid and attendance metrics (per `useYearlyArchive` / page)

---

## 🖨️ PRINT STYLES (styles/print.css)

```css
@media print {
  .no-print { display: none !important; }
  nav, aside, header, .sidebar, .topbar, button { display: none !important; }
  .print-only { display: block !important; }
  body { background: white !important; color: #000 !important; font-family: serif; }
  .print-card { 
    page-break-after: always;
    border: 2px solid #000;
    padding: 20px;
    max-width: 700px;
    margin: 0 auto;
  }
  .voucher-print { page-break-after: always; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #000; padding: 6px 10px; }
  .school-header { text-align: center; margin-bottom: 15px; }
  .school-header img { width: 80px; height: 80px; }
  .school-header h1 { font-size: 18px; font-weight: bold; margin: 5px 0; }
}
```

---

## 🎨 DESIGN SYSTEM

```
Background:     #0F172A  (dark slate)
Card/Surface:   #1E293B
Border:         #334155
Primary:        #3B82F6  (blue)
Success:        #10B981  (green)
Warning:        #F59E0B  (amber)
Danger:         #EF4444  (red)
Text Primary:   #F1F5F9
Text Muted:     #94A3B8
Font Heading:   Sora
Font Body:      DM Sans
```

---

## 🧭 FINAL SIDEBAR NAVIGATION

```
📊 Dashboard
─────────────────
👨‍🏫 Teachers
🎒 Students
📚 Classes
🗓️ Timetable
📋 Admit Cards
─────────────────
📝 Results
─────────────────
💰 Finance
  ├── Fees Overview
  ├── Generate Voucher
  ├── Fee Defaulters
  └── Teacher Salaries (/salaries)
📊 Expenses
─────────────────
📅 Student Attendance
👨‍🏫 Teacher Attendance
─────────────────
🗃️ History & Archives
  ├── 📆 Monthly History
  └── 🗓️ Yearly Archive
─────────────────
📢 Announcements
⚙️ Settings
```

---

## ⚠️ QUALITY CHECKLIST — BEFORE FINISHING

Make sure ALL of these are true before considering the project done:

### Data & Database
- [x] Every form saves real data to Supabase (no mock/dummy data)
- [x] Every list page fetches real data from Supabase
- [x] Student UID now uses `nogs-XX` sequence for new inserts (DB trigger needs to match this format)
- [x] Profile photos upload to Supabase Storage and URL saves to DB
- [x] Fee status updates on refresh after actions (in-app state updates; full instant without refresh depends on path)
- [x] Results UPDATE existing record when editing (not create duplicate) — *verify per edge case in DB*
- [x] All 14 classes appear in class-driven flows
- [x] All 7 subjects on result entry / print

### Session Progress Update (Completed)
- [x] Student photo upload implemented on add/edit with preview, 500KB limit, storage upload, old-photo delete on replace, and DB URL update
- [x] Student photo display implemented in students list, student detail header, class detail rows, fee voucher views, admit cards, and result print card
- [x] Fallback avatar unified to initials-in-circle (prevents broken image icons)
- [x] Teacher photo upload implemented on add/edit with preview, 500KB limit, storage upload, old-photo delete on replace, and DB URL update
- [x] Storage integration switched to bucket id `school_Children_photos` (case-sensitive match)
- [x] School branding settings implemented (`school_settings` table usage, school name + logo upload, dynamic branding in sidebar/login/prints)
- [x] Sidebar school logo/name now links to dashboard and settings page includes a logout option
- [x] Dashboard data fetching optimized (parallelized major fetch groups and reduced sequential waits)
- [x] Results module fetching optimized (class grid + class result sheets + generated results with parallel queries and map-based lookups)
- [x] Class order updated to: Play Group → Montessory → Junior → Senior → Class 1 ... Class 10
- [x] Class list fetches updated to use `order('sort_order')` for selectors and class-driven pages
- [x] SQL scripts added for new tables/config (`supabase/school_settings.sql`), class sort order (`supabase/classes_sort_order.sql`), and teacher `name` column sync (`supabase/teachers_name_column.sql`)
- [x] FK-safe guidance added for class sort update in production DBs (avoid `DELETE FROM classes` when referenced by results/fees/students)
- [x] Sidebar behavior improved: stays fixed/sticky while content scrolls
- [x] Day-mode form readability improved globally (removed harsh black form blocks; standardized text/placeholder/autofill/select colors)
- [x] Build verification completed after each major change (`npm run build` successful)
- [x] Teacher joining date display + joining date on add/edit forms (`teachers.joining_date`)
- [x] Student admission date display + required admission date on add/edit (`students.admission_date`)
- [x] Duration calculation on teacher/student detail pages (`formatDurationYearsMonths`)
- [x] Monthly auto fee voucher generation (`generate_monthly_fee_vouchers` + pg_cron instructions in SQL file)
- [x] Monthly auto salary generation (`generate_monthly_salaries()` + pg_cron instructions in SQL file; skips joining month)
- [x] New teacher joining month = **no** `salary_records` row from the app; first row on **1st of next month** (unpaid)
- [x] Teacher salary management UI (badges, `/salaries`, detail Salary tab, mark paid + print)
- [x] Salary history per teacher (`salary_records`)
- [x] Teacher entry time auto-fills when marked present/late (`teacher_attendance.check_in_time`, instant save)
- [x] Teacher exit time auto-fills when **Mark exit** is clicked (`check_out_time`, editable time inputs, 12h display)
- [x] Hours worked auto-calculated from entry/exit (`workDurationLabel` on detail + history views)
- [x] Time tracking on teacher detail **Attendance** tab (daily table for selected month)
- [x] Teacher attendance **History** tab: daily log with entry/exit/hours when a teacher is selected; drill-down modal includes times
- [x] Dashboard teacher widget: Present/Absent/Late/Leave counts + first/last arrival with time (`supabase/teacher_attendance_time_columns.sql` for `check_in_date` if used)

### UI & UX
- [ ] Loading **skeletons** (most screens use "Loading…" text)
- [x] Toast notifications on save/update/delete (major flows)
- [x] Confirmation modals for destructive actions (not every minor delete in every sub-view — spot-check)
- [x] Empty states in many list views
- [x] Search on major list pages (students, fees, class detail, global search)
- [x] Form validation (Zod / RHF) on primary forms
- [ ] **Mobile** layout — *usable but not fully audited on every page*

### Print
- [x] Result print path uses `react-to-print` / print class patterns
- [x] Fee voucher / receipt print components exist
- [x] Timetable and admit print affordances
- [ ] Final **print QA** on real browser + paper (user acceptance)

### Auth & Security
- [x] Logged out users cannot access dashboard routes (middleware)
- [x] Login/register work with Supabase
- [x] Session persists on refresh
- [x] Logout clears session

### School Branding
- [x] "NEW OXFORD GRAMMER SCHOOL" on login
- [x] Logo on sidebar
- [x] School name + logo on printed document components

---

## 🚀 IMPLEMENTATION ORDER FOR CURSOR

Build in this exact order:

1. SQL schema (already provided above — run in Supabase)
2. Supabase client setup + middleware + auth
3. Login page with school branding
4. Dashboard layout (sidebar + header)
5. Dashboard page (stats + charts + search)
6. Classes module (14 classes + student list)
7. Students module (CRUD + photo upload + Student UID)
8. Teachers module (CRUD + photo upload)
9. Results module (two sections + print)
10. Fees module (vouchers + paid/unpaid + photo + print)
11. Student Attendance
12. Teacher Attendance + Leaves
13. Timetable
14. Admit Cards
15. Expenses
16. Monthly History + Yearly Archive
17. Announcements
18. Settings & salaries / finance polish as needed
19. Final QA — test every feature end to end

---

*This is the complete implementation plan for NEW OXFORD GRAMMER SCHOOL Management System.
Every feature listed here must be fully functional, connected to Supabase, and production-ready.*
