-- One-time cleanup after changing joining-month salary rules (run in Supabase SQL Editor).

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'salary_records'
      and column_name = 'is_joining_month'
  ) then
    delete from salary_records where is_joining_month = true;
  end if;
end;
$$;

alter table salary_records drop column if exists is_joining_month;
