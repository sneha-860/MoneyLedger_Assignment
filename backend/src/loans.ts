import crypto from 'crypto';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { pool } from './db';
import { requireAuth } from './auth';
import { createLoanSchema } from './validation';

export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Receipts are saved to disk under a random name; only images up to 5 MB are accepted.
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase());
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'receipt'));
  },
});

// Columns every loan query returns. "overdue" is computed in SQL so the rule
// (unpaid and due date before today) lives in one place.
const LOAN_COLUMNS = `
  id, friend_name, amount_paise, due_date::text AS due_date, repaid_at, receipt_path, created_at,
  (repaid_at IS NULL AND due_date < CURRENT_DATE) AS overdue`;

type LoanRow = {
  id: number;
  friend_name: string;
  amount_paise: number;
  due_date: string;
  repaid_at: Date | null;
  receipt_path: string | null;
  created_at: Date;
  overdue: boolean;
};

// Shape sent to the client: camelCase, amounts back in rupees.
function toLoan(row: LoanRow) {
  return {
    id: row.id,
    friendName: row.friend_name,
    amount: row.amount_paise / 100,
    dueDate: row.due_date,
    repaidAt: row.repaid_at,
    isOverdue: row.overdue,
    receiptUrl: row.receipt_path ? `/uploads/${row.receipt_path}` : null,
    createdAt: row.created_at,
  };
}

export const loansRouter = Router();
loansRouter.use(requireAuth);

// Overdue first, then other unpaid loans by due date, then repaid ones.
loansRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query<LoanRow>(
    `SELECT ${LOAN_COLUMNS} FROM loans WHERE user_id = $1
     ORDER BY (repaid_at IS NOT NULL), due_date, id`,
    [res.locals.userId]
  );
  res.json(rows.map(toLoan));
});

// Total lent, total repaid and overdue amount (all in rupees).
loansRouter.get('/summary', async (_req, res) => {
  const { rows } = await pool.query<{ lent: string; repaid: string; overdue: string; overdue_count: string }>(
    `SELECT
       COALESCE(SUM(amount_paise), 0) AS lent,
       COALESCE(SUM(amount_paise) FILTER (WHERE repaid_at IS NOT NULL), 0) AS repaid,
       COALESCE(SUM(amount_paise) FILTER (WHERE repaid_at IS NULL AND due_date < CURRENT_DATE), 0) AS overdue,
       COUNT(*) FILTER (WHERE repaid_at IS NULL AND due_date < CURRENT_DATE) AS overdue_count
     FROM loans WHERE user_id = $1`,
    [res.locals.userId]
  );
  // SUM/COUNT return bigint, which pg hands back as a string.
  const s = rows[0];
  const lent = Number(s.lent);
  const repaid = Number(s.repaid);
  res.json({
    totalLent: lent / 100,
    totalRepaid: repaid / 100,
    outstanding: (lent - repaid) / 100,
    overdueAmount: Number(s.overdue) / 100,
    overdueCount: Number(s.overdue_count),
  });
});

// Accepts JSON, or multipart/form-data when a "receipt" image is attached.
loansRouter.post('/', upload.single('receipt'), async (req, res) => {
  const parsed = createLoanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { friendName, amount, dueDate } = parsed.data;

  const { rows } = await pool.query<LoanRow>(
    `INSERT INTO loans (user_id, friend_name, amount_paise, due_date, receipt_path)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${LOAN_COLUMNS}`,
    [res.locals.userId, friendName, amount, dueDate, req.file?.filename ?? null]
  );
  res.status(201).json(toLoan(rows[0]));
});

loansRouter.patch('/:id/repay', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid loan id' });
    return;
  }

  // The user_id check means you can only repay your own loans.
  const { rows } = await pool.query<LoanRow>(
    `UPDATE loans SET repaid_at = now()
     WHERE id = $1 AND user_id = $2 AND repaid_at IS NULL
     RETURNING ${LOAN_COLUMNS}`,
    [id, res.locals.userId]
  );
  if (rows[0]) {
    res.json(toLoan(rows[0]));
    return;
  }

  // Nothing updated: either the loan doesn't exist (for this user) or it's already repaid.
  const existing = await pool.query('SELECT 1 FROM loans WHERE id = $1 AND user_id = $2', [id, res.locals.userId]);
  if (existing.rowCount) res.status(409).json({ error: 'Loan is already marked as repaid' });
  else res.status(404).json({ error: 'Loan not found' });
});
