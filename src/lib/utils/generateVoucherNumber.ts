export function generateVoucherNumber(sequence: number, year: number): string {
  return `VCH-${year}-${String(sequence).padStart(4, "0")}`;
}
