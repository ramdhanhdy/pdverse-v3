import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database file path
const DB_PATH = path.join(DATA_DIR, 'pdverse.db');

// Create SQLite database connection
const db = new Database(DB_PATH);

// Initialize database with tables
function initializeDatabase() {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create files table
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      user_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create file_tags junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_tags (
      file_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (file_id, tag_id),
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // Create chat_sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      user_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create chat_messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `);

  // Create chat_session_files junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_session_files (
      session_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (session_id, file_id),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);

  // Create pdf_metadata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pdf_metadata (
      file_id TEXT PRIMARY KEY,
      title TEXT,
      author TEXT,
      subject TEXT,
      keywords TEXT,
      creator TEXT,
      producer TEXT,
      page_count INTEGER,
      creation_date TEXT,
      modification_date TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )
  `);

  // Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      key TEXT NOT NULL,
      value TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  console.log(`Database initialized at: ${DB_PATH}`);
  console.log('Database initialized successfully');
}

// Initialize the database
initializeDatabase();

// Helper functions for common database operations

// User functions
export function createUser(data: { name?: string; email: string }) {
  const stmt = db.prepare(`
    INSERT INTO users (id, name, email, created_at, updated_at)
    VALUES (?, ?, ?, unixepoch(), unixepoch())
  `);
  
  const id = uuidv4();
  stmt.run(id, data.name || null, data.email);
  
  return getUserById(id);
}

export function getUserById(id: string) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
}

export function getUserByEmail(email: string) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

// File type
export type FileRecord = {
  id: string;
  filename: string;
  original_filename: string;
  size: number;
  path: string;
  mimetype: string;
  user_id?: string;
  created_at: number;
  updated_at: number;
};

// File functions
export function createFile(data: {
  filename: string;
  originalFilename: string;
  size: number;
  path: string;
  mimetype: string;
  userId?: string;
}): FileRecord {
  const stmt = db.prepare(`
    INSERT INTO files (id, filename, original_filename, size, path, mimetype, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `);
  
  const id = uuidv4();
  stmt.run(
    id,
    data.filename,
    data.originalFilename,
    data.size,
    data.path,
    data.mimetype,
    data.userId || null
  );
  
  return getFileById(id) as FileRecord;
}

export function getFileById(id: string): FileRecord | undefined {
  const stmt = db.prepare('SELECT * FROM files WHERE id = ?');
  return stmt.get(id) as FileRecord | undefined;
}

export function getAllFiles(userId?: string): FileRecord[] {
  let stmt;
  if (userId) {
    stmt = db.prepare('SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId) as FileRecord[];
  } else {
    stmt = db.prepare('SELECT * FROM files ORDER BY created_at DESC');
    return stmt.all() as FileRecord[];
  }
}

export function updateFile(id: string, data: Partial<{
  filename: string;
  originalFilename: string;
  size: number;
  path: string;
  mimetype: string;
  userId: string;
}>) {
  const updates = Object.entries(data)
    .filter(([_, value]) => value !== undefined)
    .map(([key, _]) => {
      // Convert camelCase to snake_case
      return `${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`;
    });
  
  if (updates.length === 0) return getFileById(id);
  
  const sql = `
    UPDATE files
    SET ${updates.join(', ')}, updated_at = unixepoch()
    WHERE id = ?
  `;
  
  const stmt = db.prepare(sql);
  const values = [...Object.values(data).filter(v => v !== undefined), id];
  stmt.run(...values);
  
  return getFileById(id);
}

export function deleteFile(id: string) {
  const stmt = db.prepare('DELETE FROM files WHERE id = ?');
  return stmt.run(id);
}

// Tag functions
export function createTag(data: { name: string; userId?: string }) {
  const stmt = db.prepare(`
    INSERT INTO tags (id, name, user_id, created_at)
    VALUES (?, ?, ?, unixepoch())
  `);
  
  const id = uuidv4();
  stmt.run(id, data.name, data.userId || null);
  
  return getTagById(id);
}

export function getTagById(id: string) {
  const stmt = db.prepare('SELECT * FROM tags WHERE id = ?');
  return stmt.get(id);
}

export function getAllTags(userId?: string) {
  let stmt;
  if (userId) {
    stmt = db.prepare('SELECT * FROM tags WHERE user_id = ? OR user_id IS NULL ORDER BY name');
    return stmt.all(userId);
  } else {
    stmt = db.prepare('SELECT * FROM tags ORDER BY name');
    return stmt.all();
  }
}

// File tag functions
export function addTagToFile(fileId: string, tagId: string) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO file_tags (file_id, tag_id, created_at)
    VALUES (?, ?, unixepoch())
  `);
  
  return stmt.run(fileId, tagId);
}

export function removeTagFromFile(fileId: string, tagId: string) {
  const stmt = db.prepare('DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?');
  return stmt.run(fileId, tagId);
}

export function getFilesByTag(tagId: string) {
  const stmt = db.prepare(`
    SELECT f.*
    FROM files f
    JOIN file_tags ft ON f.id = ft.file_id
    WHERE ft.tag_id = ?
    ORDER BY f.created_at DESC
  `);
  
  return stmt.all(tagId);
}

export function getTagsByFile(fileId: string) {
  const stmt = db.prepare(`
    SELECT t.*
    FROM tags t
    JOIN file_tags ft ON t.id = ft.tag_id
    WHERE ft.file_id = ?
    ORDER BY t.name
  `);
  
  return stmt.all(fileId);
}

// Chat functions
export function createChatSession(data: { title: string; userId?: string }) {
  const stmt = db.prepare(`
    INSERT INTO chat_sessions (id, title, user_id, created_at, updated_at)
    VALUES (?, ?, ?, unixepoch(), unixepoch())
  `);
  
  const id = uuidv4();
  stmt.run(id, data.title, data.userId || null);
  
  return getChatSessionById(id);
}

export function getChatSessionById(id: string) {
  const stmt = db.prepare('SELECT * FROM chat_sessions WHERE id = ?');
  return stmt.get(id);
}

export function getAllChatSessions(userId?: string) {
  let stmt;
  if (userId) {
    stmt = db.prepare('SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC');
    return stmt.all(userId);
  } else {
    stmt = db.prepare('SELECT * FROM chat_sessions ORDER BY updated_at DESC');
    return stmt.all();
  }
}

export function updateChatSession(id: string, data: { title: string }) {
  const stmt = db.prepare(`
    UPDATE chat_sessions
    SET title = ?, updated_at = unixepoch()
    WHERE id = ?
  `);
  
  stmt.run(data.title, id);
  
  return getChatSessionById(id);
}

export function deleteChatSession(id: string) {
  const stmt = db.prepare('DELETE FROM chat_sessions WHERE id = ?');
  return stmt.run(id);
}

export function addMessageToChat(data: { 
  sessionId: string; 
  role: 'user' | 'assistant' | 'system'; 
  content: string 
}) {
  const stmt = db.prepare(`
    INSERT INTO chat_messages (id, session_id, role, content, created_at)
    VALUES (?, ?, ?, ?, unixepoch())
  `);
  
  const id = uuidv4();
  stmt.run(id, data.sessionId, data.role, data.content);
  
  // Update the chat session's updated_at timestamp
  const updateStmt = db.prepare(`
    UPDATE chat_sessions
    SET updated_at = unixepoch()
    WHERE id = ?
  `);
  updateStmt.run(data.sessionId);
  
  return getMessageById(id);
}

export function getMessageById(id: string) {
  const stmt = db.prepare('SELECT * FROM chat_messages WHERE id = ?');
  return stmt.get(id);
}

export function getChatMessages(sessionId: string) {
  const stmt = db.prepare(`
    SELECT * FROM chat_messages
    WHERE session_id = ?
    ORDER BY created_at
  `);
  
  return stmt.all(sessionId);
}

export function addFileToChat(sessionId: string, fileId: string) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO chat_session_files (session_id, file_id, created_at)
    VALUES (?, ?, unixepoch())
  `);
  
  return stmt.run(sessionId, fileId);
}

export function removeFileFromChat(sessionId: string, fileId: string) {
  const stmt = db.prepare('DELETE FROM chat_session_files WHERE session_id = ? AND file_id = ?');
  return stmt.run(sessionId, fileId);
}

export function getChatFiles(sessionId: string) {
  const stmt = db.prepare(`
    SELECT f.*
    FROM files f
    JOIN chat_session_files csf ON f.id = csf.file_id
    WHERE csf.session_id = ?
  `);
  
  return stmt.all(sessionId);
}

// PDF metadata type
export type PdfMetadata = {
  id: string;
  file_id: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  page_count?: number;
  creation_date?: string;
  modification_date?: string;
  created_at: number;
  updated_at: number;
};

// PDF metadata functions
export function savePdfMetadata(data: {
  fileId: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  pageCount?: number;
  creationDate?: string;
  modificationDate?: string;
}) {
  // Check if metadata already exists for this file
  const existing = getPdfMetadata(data.fileId);
  
  if (existing) {
    // Update existing metadata
    const updates = Object.entries(data)
      .filter(([key, _]) => key !== 'fileId') // Exclude fileId from updates
      .filter(([_, value]) => value !== undefined)
      .map(([key, _]) => {
        // Convert camelCase to snake_case
        return `${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`;
      });
    
    if (updates.length === 0) return existing;
    
    const sql = `
      UPDATE pdf_metadata
      SET ${updates.join(', ')}, updated_at = unixepoch()
      WHERE file_id = ?
    `;
    
    const stmt = db.prepare(sql);
    const values = [
      ...Object.entries(data)
        .filter(([key, _]) => key !== 'fileId')
        .filter(([_, value]) => value !== undefined)
        .map(([_, value]) => value),
      data.fileId
    ];
    
    stmt.run(...values);
  } else {
    // Insert new metadata
    const columns = ['file_id', ...Object.keys(data)
      .filter(key => key !== 'fileId' && data[key as keyof typeof data] !== undefined)
      .map(key => key.replace(/([A-Z])/g, '_$1').toLowerCase())
    ];
    
    const placeholders = columns.map(() => '?').join(', ');
    
    const sql = `
      INSERT INTO pdf_metadata (${columns.join(', ')}, created_at, updated_at)
      VALUES (${placeholders}, unixepoch(), unixepoch())
    `;
    
    const stmt = db.prepare(sql);
    const values = [
      data.fileId,
      ...Object.entries(data)
        .filter(([key, _]) => key !== 'fileId')
        .filter(([_, value]) => value !== undefined)
        .map(([_, value]) => value)
    ];
    
    stmt.run(...values);
  }
  
  return getPdfMetadata(data.fileId);
}

export function getPdfMetadata(fileId: string): PdfMetadata | undefined {
  const stmt = db.prepare('SELECT * FROM pdf_metadata WHERE file_id = ?');
  return stmt.get(fileId) as PdfMetadata | undefined;
}

// Settings functions
export function saveSetting(data: { userId?: string; key: string; value: string }) {
  // Check if setting already exists
  const existing = getSetting(data.key, data.userId);
  
  if (existing) {
    // Update existing setting
    const stmt = db.prepare(`
      UPDATE settings
      SET value = ?, updated_at = unixepoch()
      WHERE id = ?
    `);
    
    stmt.run(data.value, existing.id);
    return getSettingById(existing.id);
  } else {
    // Insert new setting
    const stmt = db.prepare(`
      INSERT INTO settings (id, user_id, key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
    `);
    
    const id = uuidv4();
    stmt.run(id, data.userId || null, data.key, data.value);
    
    return getSettingById(id);
  }
}

export function getSettingById(id: string) {
  const stmt = db.prepare('SELECT * FROM settings WHERE id = ?');
  return stmt.get(id);
}

export function getSetting(key: string, userId?: string) {
  let stmt;
  if (userId) {
    stmt = db.prepare('SELECT * FROM settings WHERE key = ? AND user_id = ?');
    return stmt.get(key, userId);
  } else {
    stmt = db.prepare('SELECT * FROM settings WHERE key = ? AND user_id IS NULL');
    return stmt.get(key);
  }
}

export function getAllSettings(userId?: string) {
  let stmt;
  if (userId) {
    stmt = db.prepare('SELECT * FROM settings WHERE user_id = ?');
    return stmt.all(userId);
  } else {
    stmt = db.prepare('SELECT * FROM settings WHERE user_id IS NULL');
    return stmt.all();
  }
}

export function deleteSetting(id: string) {
  const stmt = db.prepare('DELETE FROM settings WHERE id = ?');
  return stmt.run(id);
}

// Export the database instance
export { db };
