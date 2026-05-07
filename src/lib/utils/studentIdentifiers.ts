export function getGrPrefixFromClassName(className: string | null | undefined): string {
  const normalized = (className ?? "").trim();
  if (["Play Group", "Junior", "Montessory"].includes(normalized)) return "KG";
  if (["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"].includes(normalized)) return "PP";
  if (["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"].includes(normalized)) return "SS";
  return "ST";
}

export function formatGrNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(Math.max(sequence, 1)).padStart(3, "0")}`;
}

export function getRankSuffix(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const mod10 = rank % 10;
  if (mod10 === 1) return `${rank}st`;
  if (mod10 === 2) return `${rank}nd`;
  if (mod10 === 3) return `${rank}rd`;
  return `${rank}th`;
}
