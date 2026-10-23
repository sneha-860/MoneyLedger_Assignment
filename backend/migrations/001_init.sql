CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  phone      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One pending OTP per phone; requesting a new one replaces the old.
CREATE TABLE otps (
  phone      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Amounts are stored in paise (integer) to avoid floating-point rounding.
-- A loan is overdue when repaid_at IS NULL and due_date < today.
CREATE TABLE loans (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_name  TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  due_date     DATE NOT NULL,
  repaid_at    TIMESTAMPTZ,
  receipt_path TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX loans_user_id_idx ON loans(user_id);
