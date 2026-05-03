/** Human-readable "X years, Y months" from a calendar date (YYYY-MM-DD) to an end date (default: today). */
export function formatDurationYearsMonths(startIsoDate: string, end: Date = new Date()): string {
  const start = new Date(`${startIsoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "—";

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (end.getDate() < start.getDate()) {
    months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
  }

  const yPart = years <= 0 ? "" : years === 1 ? "1 year" : `${years} years`;
  const mPart = months <= 0 ? "" : months === 1 ? "1 month" : `${months} months`;
  if (!yPart && !mPart) return "less than a month";
  return [yPart, mPart].filter(Boolean).join(", ");
}
