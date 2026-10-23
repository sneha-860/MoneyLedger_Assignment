# MiniLedger

A small app to track money lent to friends: log in with your phone number (mock OTP), record who owes you what and when, mark loans as repaid, and see at a glance how much is outstanding and overdue.

- **Backend:** Node.js, TypeScript, Express 5, PostgreSQL (via `pg`), zod for validation, JWT auth, multer for receipt uploads, Vitest and Supertest for tests
- **App:** React Native (Expo SDK 58, TypeScript)

```
backend/   REST API + SQL migrations + tests
mobile/    Expo React Native app
docker-compose.yml   Postgres 16 for local development
```

## Features

| Requirement | Where |
| --- | --- |
| Phone login with mock OTP printed in the server log | `POST /auth/request-otp`, `POST /auth/verify-otp` (`backend/src/auth.ts`) |
| Add a loan (friend, amount, due date) | `POST /loans` (`backend/src/loans.ts`) |
| Mark a loan as repaid | `PATCH /loans/:id/repay` |
| Summary: total lent, repaid, overdue | `GET /loans/summary` |
| Login screen (phone, then OTP) | `mobile/src/screens/LoginScreen.tsx` |
| Entry list with overdue entries highlighted | `mobile/src/screens/HomeScreen.tsx`, `mobile/src/components/LoanItem.tsx` |
| Add-entry form and summary card | `mobile/src/components/AddLoanForm.tsx`, `mobile/src/components/SummaryCard.tsx` |
| **Bonus:** receipt photo upload | `receipt` image field on `POST /loans`; picker in the add form |
| **Bonus:** input validation and tests | `backend/src/validation.ts`, `backend/tests/` (16 tests) |

## Running it locally

### Prerequisites

- Node.js 20+ (tested on Node 24)
- Docker (for Postgres), or any Postgres 14+ you already have
- To use the app on a phone, install the **Expo Go** app and put the phone on the same Wi-Fi as your computer. You can also use an Android emulator or the iOS simulator.

### 1. Start the database and backend

```bash
docker compose up -d            # Postgres on localhost:5433

cd backend
cp .env.example .env            # then set JWT_SECRET to any long random string
npm install
npm run migrate                 # creates the tables
npm run dev                     # API on http://localhost:4000
```

Check it's up: `curl http://localhost:4000/health` should return `{"status":"ok"}`.

### 2. Start the app

In a second terminal:

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). You can also press `a` for an Android emulator, `i` for the iOS simulator, or `w` to open it in a web browser.

The app finds the backend automatically: it uses the IP address of the machine running `expo start`, on port 4000. If that doesn't work for your setup, copy `mobile/.env.example` to `mobile/.env.local` and set `EXPO_PUBLIC_API_URL`. For the Android emulator that's usually `http://10.0.2.2:4000`.

> **Phone can't reach the server?** Make sure the phone and computer are on the same network, and that your firewall allows incoming connections to Node on port 4000. On Windows, accept the firewall prompt the first time you run `npm run dev`.

### 3. Log in

Enter any phone number (10–15 digits) and tap **Send OTP**. No SMS is sent; the code is printed in the backend terminal:

```
[mock-sms] OTP for 9876543210: 482913 (valid 5 min)
```

Type it into the app. A new user account is created on first login.

### Running the tests

```bash
cd backend
npm test
```

- `validation.test.ts`: unit tests for the phone, OTP, amount and date rules.
- `api.test.ts`: auth guard and validation errors over HTTP. Doesn't need a database.
- `flow.test.ts`: the full flow against Postgres. It logs in using the OTP captured from the log, adds loans, marks one repaid, checks the summary, and uploads a receipt. It runs when `DATABASE_URL` is set (from `.env`) and cleans up its test user afterwards.

## API reference

All `/loans` routes require `Authorization: Bearer <token>`. Amounts are in rupees in requests and responses. Errors look like `{ "error": "message" }`.

| Method & path | Body | Response |
| --- | --- | --- |
| `POST /auth/request-otp` | `{ "phone": "9876543210" }` | `{ "message": "OTP sent" }` (code printed to server log) |
| `POST /auth/verify-otp` | `{ "phone": "...", "code": "123456" }` | `{ "token": "...", "user": { "id", "phone" } }` |
| `GET /loans` | | Array of loans. Unpaid first (soonest due on top), repaid last |
| `POST /loans` | JSON `{ friendName, amount, dueDate: "YYYY-MM-DD" }`, or `multipart/form-data` with the same fields plus an optional `receipt` image (max 5 MB) | `201` with the created loan |
| `PATCH /loans/:id/repay` | | The updated loan. `404` if it isn't yours or doesn't exist, `409` if it's already repaid |
| `GET /loans/summary` | | `{ totalLent, totalRepaid, outstanding, overdueAmount, overdueCount }` |

A loan looks like:

```json
{
  "id": 7,
  "friendName": "Asha",
  "amount": 500,
  "dueDate": "2026-10-20",
  "repaidAt": null,
  "isOverdue": true,
  "receiptUrl": "/uploads/3f1c....jpg",
  "createdAt": "2026-10-24T09:12:00.000Z"
}
```

## Design notes

- **Money is stored as integer paise** (`amount_paise INTEGER`), not floats, so totals never pick up rounding errors like `0.1 + 0.2`. The API converts to and from rupees at the edges.
- **Overdue is computed, not stored:** a loan is overdue when `repaid_at IS NULL AND due_date < CURRENT_DATE`. That rule lives in one SQL expression, which both the list and the summary use, so the highlight in the app and the overdue total always agree. A loan due *today* is not overdue yet.
- **OTP handling:** the code is a random 6-digit number from `crypto.randomInt`. Only its SHA-256 hash is stored. It expires after 5 minutes and is deleted once used, and asking for a new code replaces the old one.
- **Auth:** after verifying the OTP the server returns a JWT (valid 7 days). Every `/loans` query filters by the user id from the token, so users can only see and change their own loans. The app keeps the token in SecureStore (Keychain/Keystore) so you stay logged in.
- **Validation** happens on the server with zod (`backend/src/validation.ts`). The app runs the same checks first for instant feedback and shows the server's message if the server still rejects something.
- **Receipts** are saved to `backend/uploads/` under random UUID filenames. Only image files up to 5 MB are accepted.
- **Migrations** are plain SQL files in `backend/migrations/`, applied in order by a tiny runner (`npm run migrate`). Applied files are recorded in `schema_migrations`.

## Known limitations / what I'd add next

- The OTP is a mock: there's no SMS provider and no rate limiting of OTP requests or verification attempts. A real version needs both.
- Receipt images are served publicly by their (unguessable) URL instead of through an authenticated route. In production they'd go to object storage (e.g. S3) behind signed URLs.
- "Today" for overdue checks is the database server's date, so a user in a different timezone could see the flip happen a few hours early or late.
- No editing or deleting of entries, and no partial repayments.
- The due date is typed as `YYYY-MM-DD` and a week from today is pre-filled. A native date picker would be nicer.
