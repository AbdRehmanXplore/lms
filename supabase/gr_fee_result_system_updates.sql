-- Run in Supabase SQL Editor after existing schema scripts.

alter table students
add column if not exists gr_number text unique;

alter table students
add column if not exists shift text
check (shift in ('Morning', 'Evening')) default 'Morning';

alter table students
add column if not exists section text default 'A';

alter table fee_vouchers
add column if not exists fee_type text default 'Tuition';

alter table results
add column if not exists remarks text;

alter table results
add column if not exists total_attendance integer;

alter table results
add column if not exists present_attendance integer;

alter table results
add column if not exists rank_in_class integer;

create or replace function generate_gr_number()
returns trigger
language plpgsql
as $$
declare
  prefix text;
  seq_num integer;
begin
  select case
    when c.name in ('Play Group', 'Junior', 'Montessory') then 'KG'
    when c.name in ('Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5') then 'PP'
    when c.name in ('Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10') then 'SS'
    else 'ST'
  end
  into prefix
  from classes c
  where c.id = new.class_id;

  select coalesce(max(cast(split_part(gr_number, '-', 2) as integer)), 0) + 1
  into seq_num
  from students
  where gr_number like prefix || '-%';

  new.gr_number := prefix || '-' || lpad(seq_num::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists set_gr_number on students;
create trigger set_gr_number
before insert on students
for each row
when (new.gr_number is null)
execute function generate_gr_number();

do $$
declare
  v_student record;
  prefix text;
  seq_num integer;
begin
  for v_student in
    select s.id, c.name as class_name
    from students s
    join classes c on c.id = s.class_id
    where s.gr_number is null
    order by s.created_at nulls last, s.id
  loop
    prefix := case
      when v_student.class_name in ('Play Group', 'Junior', 'Montessory') then 'KG'
      when v_student.class_name in ('Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5') then 'PP'
      when v_student.class_name in ('Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10') then 'SS'
      else 'ST'
    end;

    select coalesce(max(cast(split_part(gr_number, '-', 2) as integer)), 0) + 1
    into seq_num
    from students
    where gr_number like prefix || '-%';

    update students
    set gr_number = prefix || '-' || lpad(seq_num::text, 3, '0')
    where id = v_student.id;
  end loop;
end
$$;

insert into subjects (class_id, name, max_marks, passing_marks)
select c.id, 'Computer', 100, 40
from classes c
where not exists (
  select 1
  from subjects s
  where s.class_id = c.id
    and lower(s.name) = 'computer'
);
