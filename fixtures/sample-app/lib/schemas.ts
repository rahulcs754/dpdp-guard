import { z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().min(2),
  contact: z.string().email(),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  dob: z.coerce.date(),
  password: z.string().min(8),
});
