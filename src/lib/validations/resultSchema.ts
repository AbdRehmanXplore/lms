import { z } from "zod";

export const resultEntrySchema = z.object({
  marksObtained: z.number().min(0).optional(),
  maxMarks: z.number().min(1).default(100),
});

export type ResultEntryValues = z.infer<typeof resultEntrySchema>;
