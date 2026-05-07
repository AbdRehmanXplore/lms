export const FEE_TYPES = [
  "Tuition",
  "A.C.",
  "Stationary Charges",
  "Activity Charges",
  "Admission Fee",
  "Examination Fee",
  "Other",
] as const;

export type FeeType = (typeof FEE_TYPES)[number];
