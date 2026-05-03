import { z } from "zod";

export const studentSchema = z.object({
  rollNumber: z.string().min(1, "Roll number is required"),
  fullName: z.string().min(2, "Name is required"),
  fatherName: z.string().min(2, "Father name is required"),
  motherName: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["Male", "Female", "Other"]),
  classId: z.string().min(1, "Select a class"),
  address: z.string().min(3, "Address is required"),
  phone: z.string().min(7, "Phone is required"),
  email: z
    .string()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Invalid email"),
  admissionDate: z.string().min(1, "Admission date is required"),
  profilePhoto: z.string().url().optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "graduated"]),
});

export type StudentFormValues = z.infer<typeof studentSchema>;
