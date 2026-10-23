import { Pool } from 'pg';

// One shared connection pool for the whole app.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
