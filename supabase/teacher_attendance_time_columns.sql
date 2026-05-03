-- Teacher attendance entry/exit times (run in Supabase SQL Editor if columns are missing)

alter table teacher_attendance add column if not exists check_in_time time;
alter table teacher_attendance add column if not exists check_out_time time;
alter table teacher_attendance add column if not exists check_in_date date default current_date;
