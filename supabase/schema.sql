create extension if not exists "uuid-ossp";

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

create table if not exists teachers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade,
  employee_code text unique not null,
  subject text not null,
  qualification text,
  salary numeric(10,2) not null default 0,
  salary_paid_month text,
  class_assigned text,
  status text check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz default now()
);

create table if not exists classes (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  section text default 'A',
  teacher_id uuid references teachers(id),
  created_at timestamptz default now()
);

create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
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
  created_at timestamptz default now()
);

create table if not exists subjects (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references classes(id) on delete cascade,
  name text not null,
  max_marks integer default 100,
  passing_marks integer default 40,
  created_at timestamptz default now()
);

create table if not exists results (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  class_id uuid references classes(id),
  subject_id uuid references subjects(id),
  exam_type text check (exam_type in ('Monthly', 'Mid-Term', 'Final', 'Unit Test')) default 'Final',
  marks_obtained numeric(5,2),
  max_marks integer default 100,
  exam_year text default '2024',
  teacher_id uuid references teachers(id),
  created_at timestamptz default now(),
  unique(student_id, subject_id, exam_type, exam_year)
);

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
  payment_method text,
  remarks text,
  created_at timestamptz default now()
);

create table if not exists attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  class_id uuid references classes(id),
  date date not null default current_date,
  status text check (status in ('present', 'absent', 'late')) default 'present',
  created_at timestamptz default now(),
  unique(student_id, date)
);

create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text not null,
  target text check (target in ('all', 'teachers', 'students')) default 'all',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
