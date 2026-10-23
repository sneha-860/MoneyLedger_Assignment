import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { signToken } from '../src/auth';

// These requests are all rejected before any database query runs, so no Postgres is needed.
beforeAll(() => {
  process.env.JWT_SECRET ??= 'test-secret';
});

describe('auth guard', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/loans');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/loans').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });
});

describe('input validation', () => {
  it('rejects a bad phone number on OTP request', async () => {
    const res = await request(app).post('/auth/request-otp').send({ phone: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phone/i);
  });

  it('rejects an invalid loan body', async () => {
    const res = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${signToken(1)}`)
      .send({ friendName: 'Asha', amount: -10, dueDate: '2026-12-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/greater than 0/);
  });

  it('rejects a non-numeric loan id', async () => {
    const res = await request(app).patch('/loans/abc/repay').set('Authorization', `Bearer ${signToken(1)}`);
    expect(res.status).toBe(400);
  });
});
