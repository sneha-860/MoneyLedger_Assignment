import { describe, expect, it } from 'vitest';
import { createLoanSchema, phoneSchema, verifyOtpSchema } from '../src/validation';

describe('phoneSchema', () => {
  it('accepts 10–15 digits with optional +, stripping spaces and dashes', () => {
    expect(phoneSchema.parse('98765 43210')).toBe('9876543210');
    expect(phoneSchema.parse('+91-98765-43210')).toBe('+919876543210');
  });

  it('rejects short or non-numeric numbers', () => {
    expect(phoneSchema.safeParse('12345').success).toBe(false);
    expect(phoneSchema.safeParse('98765abcde').success).toBe(false);
  });
});

describe('verifyOtpSchema', () => {
  it('requires a 6-digit code', () => {
    expect(verifyOtpSchema.safeParse({ phone: '9876543210', code: '123456' }).success).toBe(true);
    expect(verifyOtpSchema.safeParse({ phone: '9876543210', code: '12345' }).success).toBe(false);
  });
});

describe('createLoanSchema', () => {
  const valid = { friendName: 'Asha', amount: 250.5, dueDate: '2026-12-01' };

  it('converts rupees to integer paise', () => {
    expect(createLoanSchema.parse(valid).amount).toBe(25050);
    expect(createLoanSchema.parse({ ...valid, amount: 19.99 }).amount).toBe(1999);
  });

  it('accepts amount as a string (multipart forms send strings)', () => {
    expect(createLoanSchema.parse({ ...valid, amount: '100' }).amount).toBe(10000);
  });

  it('trims the friend name and rejects empty ones', () => {
    expect(createLoanSchema.parse({ ...valid, friendName: '  Ravi ' }).friendName).toBe('Ravi');
    expect(createLoanSchema.safeParse({ ...valid, friendName: '   ' }).success).toBe(false);
  });

  it('rejects zero, negative, non-numeric and over-precise amounts', () => {
    for (const amount of [0, -5, 'abc', 10.001]) {
      expect(createLoanSchema.safeParse({ ...valid, amount }).success).toBe(false);
    }
  });

  it('rejects malformed and impossible dates', () => {
    for (const dueDate of ['01-12-2026', '2026-13-01', '2026-02-30', '']) {
      expect(createLoanSchema.safeParse({ ...valid, dueDate }).success).toBe(false);
    }
  });
});
