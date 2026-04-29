import type { SupabaseClient } from "@supabase/supabase-js";

export function generateVoucherNumber(sequence: number, year: number): string {
  const width = Math.max(4, String(sequence).length);
  return `VCH-${year}-${String(sequence).padStart(width, "0")}`;
}

/** Allocates next fee voucher number (safe under concurrency when RPC exists). */
export async function allocateFeeVoucherNumber(supabase: SupabaseClient, year: number): Promise<string> {
  const { data, error } = await supabase.rpc("allocate_fee_voucher_number", { p_year: year });
  if (!error && data != null && typeof data === "string") {
    return data;
  }

  const prefix = `VCH-${year}-`;
  const { data: rows } = await supabase
    .from("fee_vouchers")
    .select("voucher_number")
    .like("voucher_number", `${prefix}%`);

  let maxSeq = 0;
  const re = new RegExp(`^VCH-${year}-(\\d+)$`);
  for (const r of rows ?? []) {
    const m = re.exec(r.voucher_number);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  return generateVoucherNumber(maxSeq + 1, year);
}
