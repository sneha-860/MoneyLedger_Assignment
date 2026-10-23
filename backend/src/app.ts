import express from 'express';
import { pool } from './db';

// The app is built separately from index.ts so tests can import it without starting a server.
export const app = express();
app.use(express.json());

// Confirms the server is up and can reach Postgres.
app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
});
