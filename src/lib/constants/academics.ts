export const ORDERED_CLASSES = [
  "Play Group",
  "Montessory",
  "Junior",
  "Senior",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
] as const;

export const FIXED_SUBJECTS = [
  "English",
  "Urdu",
  "Math",
  "Science",
  "Social Studies",
  "Islamiat",
  "Sindhi",
] as const;

export const EXAM_TYPES = ["Monthly Test", "Mid-Term", "Final Exam", "Unit Test"] as const;

export const EXAM_TYPE_DB_VALUE: Record<(typeof EXAM_TYPES)[number], string> = {
  "Monthly Test": "Monthly",
  "Mid-Term": "Mid-Term",
  "Final Exam": "Final",
  "Unit Test": "Unit Test",
};
