import fs from 'fs';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import multer from 'multer';
import { pool } from './db';
import { authRouter } from './auth';
import { loansRouter, UPLOAD_DIR } from './loans';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// The app is built separately from index.ts so tests can import it without starting a server.
export const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// Confirms the server is up and can reach Postgres.
app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/loans', loansRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Express 5 forwards errors thrown in async handlers here.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Receipt must be 5 MB or smaller' : 'Receipt must be an image';
    res.status(400).json({ error: message });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
};
app.use(errorHandler);
