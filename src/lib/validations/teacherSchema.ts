import { z } from "zod";

export const teacherSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  employeeCode: z.string().min(2, "Employee code is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Phone is required"),
  cnic: z.string().optional(),
  address: z.string().optional(),
  qualification: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  classAssigned: z.string().optional(),
  salary: z.number().min(0),
  joiningDate: z.string().min(1, "Joining date is required"),
  status: z.enum(["active", "inactive"]),
  profilePhoto: z
    .string()
    .optional()
    .refine((val) => !val || /^https?:\/\//i.test(val), "Invalid photo URL"),
});

export type TeacherFormValues = z.infer<typeof teacherSchema>;
