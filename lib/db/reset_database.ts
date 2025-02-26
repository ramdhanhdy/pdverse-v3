// @ts-nocheck
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addEnhancedMetadataFields } from './migrations/add_enhanced_metadata.js';

// Get the current file path and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resets the database by deleting the existing file and recreating it with the updated schema
 */
export async function resetDatabase() {
  // Database file path
  const DATA_DIR = path.join(process.cwd(), 'data');
  const DB_PATH = path.join(DATA_DIR, 'pdverse.db');
  
  // Close any existing database connections
  try {
    const tempDb = new Database(DB_PATH);
    tempDb.close();
  } catch (error) {
    console.log('No existing database connection to close');
  }
  
  // Delete the existing database file if it exists
  if (fs.existsSync(DB_PATH)) {
    console.log(`Deleting existing database at ${DB_PATH}`);
    fs.unlinkSync(DB_PATH);
    console.log('Database file deleted successfully');
  }
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  console.log('Creating new database with updated schema...');
  
  // Import the db module after deleting the file to ensure a fresh connection
  const { db } = await import('./index.js');
  
  // Run the migration to add enhanced metadata fields
  console.log('Running migration to add enhanced metadata fields...');
  addEnhancedMetadataFields();
  
  console.log('Database reset complete with updated schema');
  
  return true;
}

// If this file is run directly, execute the reset
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase();
}