-- Atomic fee voucher number allocation (avoids duplicate keys when row-count ≠ max suffix).
-- Run on Supabase SQL editor or via migration after schema.sql / phase2.sql.

create or replace function public.allocate_fee_voucher_number(p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_seq bigint;
  pad_width int;
begin
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'allocate_fee_voucher_number: invalid year %', p_year;
  end if;

  perform pg_advisory_xact_lock(hashtext('fee_voucher_alloc_' || p_year::text));

  select coalesce(max((regexp_match(voucher_number, '^VCH-' || p_year::text || '-(\d+)$'))[1]::bigint), 0) + 1
  into next_seq
  from fee_vouchers
  where voucher_number ~ ('^VCH-' || p_year::text || '-\d+$');

  pad_width := greatest(4, length(next_seq::text));
  return 'VCH-' || p_year::text || '-' || lpad(next_seq::text, pad_width, '0');
end;
$$;

grant execute on function public.allocate_fee_voucher_number(integer) to authenticated;
grant execute on function public.allocate_fee_voucher_number(integer) to service_role;
