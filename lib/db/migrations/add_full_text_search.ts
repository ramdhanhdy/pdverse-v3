import { db } from '../index';

console.log('Running full-text search migration...');

// Enable the FTS5 extension
db.pragma('legacy_alter_table = ON');

try {
  // Create FTS5 virtual table for document chunks
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(
      content,
      document_id UNINDEXED,
      page_number UNINDEXED,
      chunk_index UNINDEXED,
      content_type UNINDEXED,
      content='document_chunks',
      content_rowid='rowid'
    )
  `);
  console.log("Created document_chunks_fts virtual table");

  // Create triggers to keep FTS table in sync with document_chunks table
  
  // Insert trigger
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS document_chunks_ai AFTER INSERT ON document_chunks
    BEGIN
      INSERT INTO document_chunks_fts(rowid, content, document_id, page_number, chunk_index, content_type)
      VALUES (new.rowid, new.content, new.document_id, new.page_number, new.chunk_index, new.content_type);
    END
  `);
  console.log("Created insert trigger for FTS synchronization");

  // Update trigger
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS document_chunks_au AFTER UPDATE ON document_chunks
    BEGIN
      INSERT INTO document_chunks_fts(document_chunks_fts, rowid, content, document_id, page_number, chunk_index, content_type)
      VALUES ('delete', old.rowid, old.content, old.document_id, old.page_number, old.chunk_index, old.content_type);
      INSERT INTO document_chunks_fts(rowid, content, document_id, page_number, chunk_index, content_type)
      VALUES (new.rowid, new.content, new.document_id, new.page_number, new.chunk_index, new.content_type);
    END
  `);
  console.log("Created update trigger for FTS synchronization");

  // Delete trigger
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS document_chunks_ad AFTER DELETE ON document_chunks
    BEGIN
      INSERT INTO document_chunks_fts(document_chunks_fts, rowid, content, document_id, page_number, chunk_index, content_type)
      VALUES ('delete', old.rowid, old.content, old.document_id, old.page_number, old.chunk_index, old.content_type);
    END
  `);
  console.log("Created delete trigger for FTS synchronization");

  // Populate FTS table with existing data
  try {
    // First, check if the FTS table already has data
    const rowCount = db.prepare('SELECT count(*) as count FROM document_chunks_fts').get().count;
    
    if (rowCount > 0) {
      console.log(`FTS table already has ${rowCount} rows, skipping population step`);
    } else {
      // Only try to populate if the FTS table is empty
      db.exec(`
        INSERT INTO document_chunks_fts(rowid, content, document_id, page_number, chunk_index, content_type)
        SELECT rowid, content, document_id, page_number, chunk_index, content_type
        FROM document_chunks
      `);
      console.log("Populated FTS table with existing data");
    }
  } catch (error) {
    console.error('Error populating FTS table:', error);
    console.log('Continuing with migration despite FTS population error');
    // Don't rethrow the error - let the migration continue
  }

  console.log('Full-text search migration completed successfully!');
} catch (error) {
  console.error('Error in full-text search migration:', error);
  throw error;
}
