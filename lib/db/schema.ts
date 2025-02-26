import { 
  sqliteTable, 
  text, 
  integer, 
  primaryKey, 
  blob 
} from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(Date.now),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(Date.now),
});

// Files table for storing PDF metadata
export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  originalFilename: text('original_filename').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  mimetype: text('mimetype').notNull(),
  userId: text('user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(Date.now),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(Date.now),
});

// Tags table
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  userId: text('user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(Date.now),
});

// File tags junction table
export const fileTags = sqliteTable('file_tags', {
  fileId: text('file_id').references(() => files.id).notNull(),
  tagId: text('tag_id').references(() => tags.id).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(Date.now),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.fileId, table.tagId] }),
  };
});

// Chat sessions table
export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  userId: text('user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(Date.now),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(Date.now),
});

// Chat messages table
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => chatSessions.id).notNull(),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(Date.now),
});

// Chat session files junction table
export const chatSessionFiles = sqliteTable('chat_session_files', {
  sessionId: text('session_id').references(() => chatSessions.id).notNull(),
  fileId: text('file_id').references(() => files.id).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(Date.now),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.sessionId, table.fileId] }),
  };
});

// PDF metadata table
export const pdfMetadata = sqliteTable('pdf_metadata', {
  fileId: text('file_id').references(() => files.id).primaryKey(),
  title: text('title'),
  author: text('author'),
  subject: text('subject'),
  keywords: text('keywords'),
  creator: text('creator'),
  producer: text('producer'),
  pageCount: integer('page_count'),
  creationDate: text('creation_date'),
  modificationDate: text('modification_date'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(Date.now),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(Date.now),
});

// Settings table
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  key: text('key').notNull(),
  value: text('value'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(Date.now),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(Date.now),
});
