import { z } from 'zod';

// Accepts an optional leading + and 10–15 digits; spaces and dashes are stripped first.
export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{10,15}$/, 'Enter a valid phone number'));

export const requestOtpSchema = z.object({ phone: phoneSchema });

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

// A real calendar date in YYYY-MM-DD form (rejects things like 2026-02-30).
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Due date is not a valid date');

// Amount arrives in rupees (as a number in JSON, or a string from a multipart form)
// and is converted to integer paise for storage.
export const createLoanSchema = z.object({
  friendName: z.string().trim().min(1, 'Friend name is required').max(100, 'Friend name is too long'),
  amount: z.coerce
    .number({ message: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .max(10_000_000, 'Amount is too large')
    // Small tolerance because e.g. 19.99 * 100 is 1998.9999999999998 in floating point.
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Amount can have at most 2 decimal places')
    .transform((n) => Math.round(n * 100)),
  dueDate: dateSchema,
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
