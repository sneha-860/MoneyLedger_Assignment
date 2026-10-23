import crypto from 'crypto';
import { Router, type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db';
import { requestOtpSchema, verifyOtpSchema } from './validation';

const OTP_TTL_MINUTES = 5;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

// OTPs are stored hashed so a database leak doesn't expose live codes.
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// Exported so tests can create a token without going through the OTP flow.
export function signToken(userId: number): string {
  return jwt.sign({ userId }, jwtSecret(), { expiresIn: '7d' });
}

export const authRouter = Router();

// Step 1: generate a 6-digit OTP. This is a mock, so instead of sending an SMS
// we print it to the server log.
authRouter.post('/request-otp', async (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { phone } = parsed.data;

  const code = crypto.randomInt(100000, 1000000).toString();
  await pool.query(
    `INSERT INTO otps (phone, code_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))
     ON CONFLICT (phone) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at`,
    [phone, hashCode(code), OTP_TTL_MINUTES]
  );

  console.log(`[mock-sms] OTP for ${phone}: ${code} (valid ${OTP_TTL_MINUTES} min)`);
  res.json({ message: 'OTP sent' });
});

// Step 2: check the OTP, create the user on first login, and return a JWT.
authRouter.post('/verify-otp', async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { phone, code } = parsed.data;

  const { rows } = await pool.query<{ code_hash: string; expired: boolean }>(
    'SELECT code_hash, expires_at < now() AS expired FROM otps WHERE phone = $1',
    [phone]
  );
  const otp = rows[0];
  const matches =
    otp !== undefined &&
    crypto.timingSafeEqual(Buffer.from(otp.code_hash), Buffer.from(hashCode(code)));
  if (!otp || otp.expired || !matches) {
    res.status(401).json({ error: 'Invalid or expired OTP' });
    return;
  }

  // An OTP can only be used once.
  await pool.query('DELETE FROM otps WHERE phone = $1', [phone]);

  const user = await pool.query<{ id: number }>(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id`,
    [phone]
  );
  const userId = user.rows[0].id;

  res.json({ token: signToken(userId), user: { id: userId, phone } });
});

// Protects routes: expects "Authorization: Bearer <token>" and puts the user id in res.locals.
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Missing auth token' });
    return;
  }
  try {
    const payload = jwt.verify(token, jwtSecret()) as { userId: number };
    res.locals.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

