-- Demo seed data for client presentation (FK-safe)
-- Re-runnable: uses natural keys + UPSERTS, no hardcoded FK UUID dependencies

begin;

alter table if exists teachers add column if not exists full_name text;
alter table if exists teachers add column if not exists email text;
alter table if exists teachers add column if not exists phone text;
alter table if exists teachers add column if not exists address text;
alter table if exists teachers add column if not exists joining_date date;
alter table if exists fee_vouchers add column if not exists received_by text;
alter table if exists fee_vouchers add column if not exists is_defaulter boolean default false;

-- Cleanup repeatable demo rows
delete from expenses where notes = 'DEMO_SEED_2026';
delete from announcements where content like '%DEMO_SEED_2026%';

-- 1) Teachers
insert into teachers (
  employee_code, full_name, subject, qualification, salary, class_assigned, status,
  email, phone, joining_date, address
)
values
  ('TCH-001', 'Ahmed Ali', 'Mathematics', 'MSc Mathematics', 55000, 'Class 10', 'active', 'ahmed.ali@school.demo', '0300-1111111', '2023-08-01', 'Main Campus'),
  ('TCH-002', 'Sara Khan', 'English', 'MA English', 50000, 'Class 9', 'active', 'sara.khan@school.demo', '0300-2222222', '2022-03-12', 'City Branch'),
  ('TCH-003', 'Usman Raza', 'Science', 'MSc Physics', 52000, 'Class 8', 'active', 'usman.raza@school.demo', '0300-3333333', '2021-09-20', 'Main Campus'),
  ('TCH-004', 'Fatima Noor', 'Urdu', 'MA Urdu', 48000, 'Class 7', 'active', 'fatima.noor@school.demo', '0300-4444444', '2020-01-18', 'Main Campus'),
  ('TCH-005', 'Bilal Ahmed', 'Islamiat', 'MA Islamic Studies', 47000, 'Class 6', 'active', 'bilal.ahmed@school.demo', '0300-5555555', '2019-07-10', 'City Branch')
on conflict (employee_code) do update set
  full_name = excluded.full_name,
  subject = excluded.subject,
  qualification = excluded.qualification,
  salary = excluded.salary,
  class_assigned = excluded.class_assigned,
  status = excluded.status,
  email = excluded.email,
  phone = excluded.phone,
  joining_date = excluded.joining_date,
  address = excluded.address;

-- 2) Classes (teacher by employee code, never by fixed uuid)
insert into classes (name, section, teacher_id)
select v.name, 'A', t.id
from (values
  ('Class 6','TCH-005'),
  ('Class 7','TCH-004'),
  ('Class 8','TCH-003'),
  ('Class 9','TCH-002'),
  ('Class 10','TCH-001')
) as v(name, teacher_code)
join teachers t on t.employee_code = v.teacher_code
on conflict (name) do update set
  section = excluded.section,
  teacher_id = excluded.teacher_id;

-- 3) Students (class by name)
insert into students (
  roll_number, full_name, father_name, mother_name, gender, class_id, phone, address, admission_date, status
)
select x.roll_number, x.full_name, x.father_name, x.mother_name, x.gender, c.id, x.phone, x.address, x.admission_date, x.status
from (values
  ('2026-001','Ali Hassan','Hassan Iqbal','Saima Hassan','Male','Class 10','0301-1000001','Street 1','2024-04-01'::date,'active'),
  ('2026-002','Ayesha Noor','Noor Ahmed','Sadia Noor','Female','Class 10','0301-1000002','Street 2','2024-04-01'::date,'active'),
  ('2026-003','Hamza Saleem','Saleem Akhtar','Rukhsana Saleem','Male','Class 9','0301-1000003','Street 3','2024-04-01'::date,'active'),
  ('2026-004','Mariam Faisal','Faisal Karim','Amina Faisal','Female','Class 9','0301-1000004','Street 4','2024-04-01'::date,'active'),
  ('2026-005','Zain Abbas','Abbas Raza','Nadia Abbas','Male','Class 8','0301-1000005','Street 5','2024-04-01'::date,'active'),
  ('2026-006','Hira Imran','Imran Yousaf','Samina Imran','Female','Class 8','0301-1000006','Street 6','2024-04-01'::date,'active'),
  ('2026-007','Taha Javed','Javed Latif','Kausar Javed','Male','Class 7','0301-1000007','Street 7','2024-04-01'::date,'active'),
  ('2026-008','Laiba Aslam','Aslam Qureshi','Farah Aslam','Female','Class 6','0301-1000008','Street 8','2024-04-01'::date,'active')
) as x(roll_number,full_name,father_name,mother_name,gender,class_name,phone,address,admission_date,status)
join classes c on c.name = x.class_name
on conflict (roll_number) do update set
  full_name = excluded.full_name,
  father_name = excluded.father_name,
  mother_name = excluded.mother_name,
  gender = excluded.gender,
  class_id = excluded.class_id,
  phone = excluded.phone,
  address = excluded.address,
  status = excluded.status;

-- 4) Subjects
insert into subjects (class_id, name, max_marks, passing_marks)
select c.id, s.name, 100, 40
from classes c
cross join (values ('English'), ('Urdu'), ('Mathematics'), ('Science'), ('Islamiat')) as s(name)
where c.name in ('Class 6','Class 7','Class 8','Class 9','Class 10')
and not exists (
  select 1 from subjects x where x.class_id = c.id and x.name = s.name
);

-- 5) Fee vouchers (lookup student by roll number)
insert into fee_vouchers (
  voucher_number, student_id, amount, due_date, issue_date, month, status, payment_date, payment_method, remarks, received_by, is_defaulter
)
select v.voucher_number, s.id, v.amount, v.due_date, v.issue_date, v.month, v.status, v.payment_date, v.payment_method, v.remarks, v.received_by, v.is_defaulter
from (values
  ('VCH-202604-001','2026-001',12000::numeric,'2026-04-10'::date,'2026-04-01'::date,'April 2026','paid','2026-04-05'::date,'Cash','On time','Admin',false),
  ('VCH-202604-002','2026-002',12000::numeric,'2026-04-10'::date,'2026-04-01'::date,'April 2026','unpaid',null,'','Pending',null,true),
  ('VCH-202604-003','2026-003',11500::numeric,'2026-04-10'::date,'2026-04-01'::date,'April 2026','paid','2026-04-07'::date,'Bank Transfer','Cleared','Admin',false),
  ('VCH-202604-004','2026-004',11500::numeric,'2026-04-10'::date,'2026-04-01'::date,'April 2026','overdue',null,'','Late',null,true),
  ('VCH-202604-005','2026-005',11000::numeric,'2026-04-10'::date,'2026-04-01'::date,'April 2026','paid','2026-04-08'::date,'Cheque','Cleared','Admin',false),
  ('VCH-202604-006','2026-006',11000::numeric,'2026-04-10'::date,'2026-04-01'::date,'April 2026','unpaid',null,'','Pending',null,true),
  ('VCH-202604-007','2026-007',10500::numeric,'2026-04-10'::date,'2026-04-01'::date,'April 2026','paid','2026-04-09'::date,'Cash','Paid','Admin',false),
  ('VCH-202604-008','2026-008',10000::numeric,'2026-04-10'::date,'2026-04-01'::date,'April 2026','paid','2026-04-09'::date,'Bank Transfer','Paid','Admin',false)
) as v(voucher_number,roll_number,amount,due_date,issue_date,month,status,payment_date,payment_method,remarks,received_by,is_defaulter)
join students s on s.roll_number = v.roll_number
on conflict (voucher_number) do update set
  amount = excluded.amount,
  due_date = excluded.due_date,
  issue_date = excluded.issue_date,
  month = excluded.month,
  status = excluded.status,
  payment_date = excluded.payment_date,
  payment_method = excluded.payment_method,
  remarks = excluded.remarks,
  received_by = excluded.received_by,
  is_defaulter = excluded.is_defaulter;

-- 6) Expenses
insert into expenses (title, category, amount, expense_date, paid_to, payment_method, receipt_number, notes)
values
  ('Electricity Bill - April', 'Utilities', 18500, '2026-04-06', 'K-Electric', 'Bank Transfer', 'RCP-DEMO-001', 'DEMO_SEED_2026'),
  ('Stationery Purchase', 'Stationery', 7600, '2026-04-08', 'City Book Center', 'Cash', 'RCP-DEMO-002', 'DEMO_SEED_2026'),
  ('School Maintenance', 'Maintenance', 12000, '2026-04-12', 'Repair Services', 'Cash', 'RCP-DEMO-003', 'DEMO_SEED_2026'),
  ('Science Lab Materials', 'Equipment', 9500, '2026-04-14', 'Lab Supplies Co', 'Bank Transfer', 'RCP-DEMO-004', 'DEMO_SEED_2026'),
  ('Salary � Ahmed Ali � April 2026', 'Salaries', 55000, '2026-04-10', 'Ahmed Ali', 'Bank Transfer', 'RCP-DEMO-005', 'DEMO_SEED_2026'),
  ('Salary � Sara Khan � April 2026', 'Salaries', 50000, '2026-04-10', 'Sara Khan', 'Bank Transfer', 'RCP-DEMO-006', 'DEMO_SEED_2026');

-- 7) Student attendance (last 10 days)
insert into attendance (student_id, class_id, date, status)
select s.id, s.class_id, d::date,
  case
    when extract(dow from d) in (0, 6) then 'absent'
    when (extract(day from d)::int + right(s.roll_number, 1)::int) % 9 = 0 then 'late'
    when (extract(day from d)::int + right(s.roll_number, 1)::int) % 11 = 0 then 'absent'
    else 'present'
  end
from students s
cross join generate_series(current_date - interval '9 day', current_date, interval '1 day') d
where s.roll_number between '2026-001' and '2026-008'
on conflict (student_id, date) do update set
  status = excluded.status,
  class_id = excluded.class_id;

-- 8) Teacher attendance (last 10 days)
insert into teacher_attendance (teacher_id, date, status, check_in_time, check_out_time, remarks)
select t.id, d::date,
  case
    when (extract(day from d)::int + right(t.employee_code, 1)::int) % 13 = 0 then 'leave'
    when (extract(day from d)::int + right(t.employee_code, 1)::int) % 7 = 0 then 'late'
    when (extract(day from d)::int + right(t.employee_code, 1)::int) % 10 = 0 then 'absent'
    else 'present'
  end,
  '08:05', '14:15', 'Demo attendance'
from teachers t
cross join generate_series(current_date - interval '9 day', current_date, interval '1 day') d
where t.employee_code in ('TCH-001','TCH-002','TCH-003','TCH-004','TCH-005')
on conflict (teacher_id, date) do update set
  status = excluded.status,
  check_in_time = excluded.check_in_time,
  check_out_time = excluded.check_out_time,
  remarks = excluded.remarks;

-- 9) Results (Final 2026, English + Math)
insert into results (student_id, class_id, subject_id, exam_type, marks_obtained, max_marks, exam_year, teacher_id)
select
  s.id,
  s.class_id,
  sub.id,
  'Final',
  case
    when sub.name = 'Mathematics' then (60 + (right(s.roll_number,1)::int * 3) % 35)
    when sub.name = 'English' then (58 + (right(s.roll_number,1)::int * 4) % 34)
    else 65
  end::numeric,
  100,
  '2026',
  c.teacher_id
from students s
join classes c on c.id = s.class_id
join subjects sub on sub.class_id = s.class_id and sub.name in ('English', 'Mathematics')
where s.roll_number between '2026-001' and '2026-008'
on conflict (student_id, subject_id, exam_type, exam_year) do update set
  marks_obtained = excluded.marks_obtained,
  max_marks = excluded.max_marks,
  teacher_id = excluded.teacher_id;

-- 10) Teacher salaries (new module)
insert into teacher_salaries (
  teacher_id, month_year, salary_amount, status, due_date, paid_date, payment_method, remarks
)
select t.id, x.month_year, x.salary_amount, x.status, x.due_date, x.paid_date, x.payment_method, 'DEMO_SEED_2026'
from (values
  ('TCH-001','2026-04',55000::numeric,'paid','2026-04-10'::date,'2026-04-10'::date,'Bank Transfer'),
  ('TCH-002','2026-04',50000::numeric,'paid','2026-04-10'::date,'2026-04-10'::date,'Bank Transfer'),
  ('TCH-003','2026-04',52000::numeric,'unpaid','2026-04-10'::date,null,'Cash'),
  ('TCH-004','2026-04',48000::numeric,'unpaid','2026-04-10'::date,null,'Cash'),
  ('TCH-005','2026-04',47000::numeric,'unpaid','2026-04-10'::date,null,'Cash')
) as x(code,month_year,salary_amount,status,due_date,paid_date,payment_method)
join teachers t on t.employee_code = x.code
on conflict (teacher_id, month_year) do update set
  salary_amount = excluded.salary_amount,
  status = excluded.status,
  due_date = excluded.due_date,
  paid_date = excluded.paid_date,
  payment_method = excluded.payment_method,
  remarks = excluded.remarks;

-- 11) Legacy salary vouchers (if table exists)
do $$
begin
  if to_regclass('public.salary_vouchers') is not null then
    insert into salary_vouchers (
      teacher_id, voucher_number, amount, due_date, issue_date, month, status, payment_date, payment_method, received_by, remarks
    )
    select t.id, v.voucher_number, v.amount, v.due_date, v.issue_date, v.month, v.status, v.payment_date, v.payment_method, v.received_by, 'DEMO_SEED_2026'
    from (values
      ('TCH-001','SAL-202604-0001',55000::numeric,'2026-04-10'::date,'2026-04-01'::date,'2026-04','paid','2026-04-10'::date,'Bank Transfer','Admin'),
      ('TCH-002','SAL-202604-0002',50000::numeric,'2026-04-10'::date,'2026-04-01'::date,'2026-04','paid','2026-04-10'::date,'Bank Transfer','Admin'),
      ('TCH-003','SAL-202604-0003',52000::numeric,'2026-04-10'::date,'2026-04-01'::date,'2026-04','unpaid',null,'Cash',null)
    ) as v(code,voucher_number,amount,due_date,issue_date,month,status,payment_date,payment_method,received_by)
    join teachers t on t.employee_code = v.code
    on conflict (voucher_number) do update set
      amount = excluded.amount,
      due_date = excluded.due_date,
      status = excluded.status,
      payment_date = excluded.payment_date,
      payment_method = excluded.payment_method,
      received_by = excluded.received_by,
      remarks = excluded.remarks;
  end if;
end $$;

-- 12) Timetable + exam schedule
do $$
begin
  insert into timetable (class_id, day, period_number, start_time, end_time, subject_id, teacher_id, room)
  select c.id, 'Monday', 1, '08:00', '08:40', s.id, c.teacher_id, 'R-01'
  from classes c
  join subjects s on s.class_id = c.id and s.name = 'English'
  where c.name in ('Class 9','Class 10')
  on conflict (class_id, day, period_number) do update set
    subject_id = excluded.subject_id,
    teacher_id = excluded.teacher_id,
    room = excluded.room;

  insert into exam_schedules (exam_type, exam_year, class_id, subject_id, exam_date, start_time, end_time, venue)
  select 'Final', '2026', c.id, s.id, '2026-11-20', '09:00', '11:00', 'Main Hall'
  from classes c
  join subjects s on s.class_id = c.id and s.name = 'Mathematics'
  where c.name in ('Class 9','Class 10')
  and not exists (
    select 1 from exam_schedules e
    where e.class_id = c.id and e.exam_type = 'Final' and e.exam_year = '2026' and e.subject_id = s.id
  );
end $$;

-- 13) Snapshot row
insert into monthly_snapshots (
  month_year, total_students, total_teachers, fees_collected, fees_pending, total_expenses, net_balance, avg_attendance_percentage
)
values (
  '2026-04',
  (select count(*) from students where status = 'active'),
  (select count(*) from teachers where status = 'active'),
  (select coalesce(sum(amount),0) from fee_vouchers where status = 'paid' and month ilike '%April 2026%'),
  (select coalesce(sum(amount),0) from fee_vouchers where status in ('unpaid','overdue') and month ilike '%April 2026%'),
  (select coalesce(sum(amount),0) from expenses where notes = 'DEMO_SEED_2026'),
  (select coalesce(sum(amount),0) from fee_vouchers where status = 'paid' and month ilike '%April 2026%')
    - (select coalesce(sum(amount),0) from expenses where notes = 'DEMO_SEED_2026'),
  (
    select round(
      case when count(*) = 0 then 0::numeric
      else (count(*) filter (where status in ('present','late')))::numeric / count(*)::numeric * 100
      end, 2
    )
    from attendance
    where to_char(date, 'YYYY-MM') = '2026-04'
  )
)
on conflict (month_year) do update set
  total_students = excluded.total_students,
  total_teachers = excluded.total_teachers,
  fees_collected = excluded.fees_collected,
  fees_pending = excluded.fees_pending,
  total_expenses = excluded.total_expenses,
  net_balance = excluded.net_balance,
  avg_attendance_percentage = excluded.avg_attendance_percentage;

-- 14) Announcements
insert into announcements (title, content, target)
values
  ('PTM Notice', 'Parent Teacher Meeting on Friday 10:00 AM. DEMO_SEED_2026', 'all'),
  ('Final Exams Schedule', 'Final exams start next month. DEMO_SEED_2026', 'students'),
  ('Staff Briefing', 'Monthly staff briefing at 2:30 PM. DEMO_SEED_2026', 'teachers');

commit;
