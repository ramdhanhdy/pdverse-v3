// @ts-nocheck
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the current file path and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resets the database by deleting the existing file and recreating it
 */
export async function resetDatabase() {
  // Database file path
  const DATA_DIR = path.join(process.cwd(), 'data');
  const DB_PATH = path.join(DATA_DIR, 'pdverse.db');
  
  console.log(`Resetting database at ${DB_PATH}...`);
  
  // Close any existing database connections and delete file in a single try/catch
  try {
    // Try to close any open connections
    try {
      const tempDb = new Database(DB_PATH);
      tempDb.close();
    } catch (e) {
      // Ignore errors if no connection exists
    }
    
    // Delete the existing database file if it exists
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
  } catch (error) {
    console.error(`Error cleaning up existing database: ${error.message}`);
    // Continue anyway - we'll try to create a new one
  }
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  // Import the db module after deleting the file to ensure a fresh connection
  // This will automatically initialize the database with all tables
  const { db } = await import('./index.js');
  
  console.log('Database reset complete!');
  return true;
}

// Execute the reset if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase().catch(err => {
    console.error('Database reset failed:', err);
    process.exit(1);
  });
}