create table if not exists school_settings (
  id uuid primary key default uuid_generate_v4(),
  school_name text default 'NEW OXFORD GRAMMER SCHOOL',
  logo_url text,
  updated_at timestamptz default now()
);

