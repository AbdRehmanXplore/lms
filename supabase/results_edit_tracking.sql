alter table results
add column if not exists updated_at timestamptz default now();

create or replace function set_results_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_results_updated_at on results;
create trigger trg_results_updated_at
before update on results
for each row
execute function set_results_updated_at();
