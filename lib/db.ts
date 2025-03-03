import { Pool } from 'pg';

// Create a connection pool using the same connection string as the Python backend
const pool = new Pool({
  connectionString: process.env.DB_CONNECTION || 'postgresql://postgres:redknightS3@localhost:5432/pdf_db',
});

export async function query(text: string, params?: any[]) {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export default {
  query,
  pool,
};