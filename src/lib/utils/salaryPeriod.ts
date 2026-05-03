/** Matches PostgreSQL `trim(to_char(now(), 'Month'))` for salary_records.month */
export function currentSalaryMonthYear(d: Date = new Date()): { month: string; year: string } {
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = String(d.getFullYear());
  return { month, year };
}

/** Matches fee voucher / `to_char(now(), 'FMMonth YYYY')` e.g. "May 2026" */
export function currentFeeMonthLabel(d: Date = new Date()): string {
  const month = d.toLocaleString("en-US", { month: "long" });
  return `${month} ${d.getFullYear()}`;
}
