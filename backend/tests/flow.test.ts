import 'dotenv/config';
import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

// End-to-end flow against a real Postgres. Skipped when DATABASE_URL isn't set.
// Uses a fresh random phone number so it doesn't collide with existing data.
describe.skipIf(!process.env.DATABASE_URL)('full flow (needs Postgres)', () => {
  const phone = '9' + Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  let token = '';

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
    await pool.end();
  });

  it('logs in with the OTP printed to the server log', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await request(app).post('/auth/request-otp').send({ phone }).expect(200);
    const code = String(log.mock.calls.at(-1)?.[0]).match(/: (\d{6})/)?.[1];
    log.mockRestore();
    expect(code).toBeDefined();

    const wrongCode = ((Number(code![0]) + 1) % 10) + code!.slice(1);
    await request(app).post('/auth/verify-otp').send({ phone, code: wrongCode }).expect(401);

    const res = await request(app).post('/auth/verify-otp').send({ phone, code }).expect(200);
    token = res.body.token;

    // The OTP is single-use.
    await request(app).post('/auth/verify-otp').send({ phone, code }).expect(401);
  });

  it('adds loans, marks one repaid, and summarises', async () => {
    const auth = { Authorization: `Bearer ${token}` };

    const overdue = await request(app).post('/loans').set(auth)
      .send({ friendName: 'Asha', amount: 500, dueDate: '2020-01-01' }).expect(201);
    expect(overdue.body.isOverdue).toBe(true);

    const future = await request(app).post('/loans').set(auth)
      .send({ friendName: 'Ravi', amount: 199.99, dueDate: '2099-01-01' }).expect(201);
    expect(future.body).toMatchObject({ amount: 199.99, isOverdue: false, repaidAt: null });

    const repaid = await request(app).patch(`/loans/${future.body.id}/repay`).set(auth).expect(200);
    expect(repaid.body.repaidAt).not.toBeNull();
    await request(app).patch(`/loans/${future.body.id}/repay`).set(auth).expect(409);
    await request(app).patch('/loans/999999999/repay').set(auth).expect(404);

    const list = await request(app).get('/loans').set(auth).expect(200);
    expect(list.body.map((l: { friendName: string }) => l.friendName)).toEqual(['Asha', 'Ravi']);

    const summary = await request(app).get('/loans/summary').set(auth).expect(200);
    expect(summary.body).toEqual({
      totalLent: 699.99,
      totalRepaid: 199.99,
      outstanding: 500,
      overdueAmount: 500,
      overdueCount: 1,
    });
  });

  it('attaches a receipt image', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
      'base64'
    );
    const res = await request(app).post('/loans').set('Authorization', `Bearer ${token}`)
      .field('friendName', 'Meera').field('amount', '42').field('dueDate', '2099-06-01')
      .attach('receipt', png, { filename: 'receipt.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.receiptUrl).toMatch(/^\/uploads\/.+\.png$/);
    await request(app).get(res.body.receiptUrl).expect(200);
  });
});
