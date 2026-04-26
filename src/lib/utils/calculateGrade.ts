export function calculateGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
}

export function calculateStatus(percentage: number): "Pass" | "Fail" {
  return percentage >= 40 ? "Pass" : "Fail";
}
