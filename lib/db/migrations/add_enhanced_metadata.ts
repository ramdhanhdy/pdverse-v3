import { db } from '../index';

export function addEnhancedMetadataFields() {
  // Check if columns already exist
  const tableInfo = db.prepare("PRAGMA table_info(pdf_metadata)").all() as any[];
  const columns = tableInfo.map(col => col.name);
  
  // Add summary column if it doesn't exist
  if (!columns.includes('summary')) {
    db.prepare("ALTER TABLE pdf_metadata ADD COLUMN summary TEXT").run();
    console.log("Added summary column to pdf_metadata table");
  }
  
  // Add document_type column if it doesn't exist
  if (!columns.includes('document_type')) {
    db.prepare("ALTER TABLE pdf_metadata ADD COLUMN document_type TEXT").run();
    console.log("Added document_type column to pdf_metadata table");
  }
  
  // Add topics column if it doesn't exist
  if (!columns.includes('topics')) {
    db.prepare("ALTER TABLE pdf_metadata ADD COLUMN topics TEXT").run();
    console.log("Added topics column to pdf_metadata table");
  }
  
  // Add ai_enhanced column if it doesn't exist
  if (!columns.includes('ai_enhanced')) {
    db.prepare("ALTER TABLE pdf_metadata ADD COLUMN ai_enhanced INTEGER DEFAULT 0").run();
    console.log("Added ai_enhanced column to pdf_metadata table");
  }
  
  // Add needs_review column if it doesn't exist
  if (!columns.includes('needs_review')) {
    db.prepare("ALTER TABLE pdf_metadata ADD COLUMN needs_review INTEGER DEFAULT 0").run();
    console.log("Added needs_review column to pdf_metadata table");
  }
  
  // Create document_chunks table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_type TEXT DEFAULT 'text',
      token_count INTEGER,
      importance REAL DEFAULT 0.5,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (document_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);
  console.log("Created document_chunks table if it didn't exist");
}