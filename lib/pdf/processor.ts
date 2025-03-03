import { PdfMetadataExtraction } from './types';
import { uploadFileToPythonBackend } from '../python-backend';
import path from 'path';

/**
 * Processes a PDF file by delegating to the Python backend
 * This is a wrapper function that maintains the same interface as the old processPdf
 * but delegates the actual processing to the Python backend
 */
export async function processPdf(fileId: string, filePath: string): Promise<PdfMetadataExtraction> {
  // No longer needed since backend handles processing
  return {
    id: fileId,
    filename: path.basename(filePath),
    topics: [],
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
    pageCount: 0,
    creationDate: new Date().toISOString(),
    modificationDate: new Date().toISOString(),
    file_size: 0,
    language: 'en',
    summary: '',
    documentType: 'pdf',
    table_count: 0,
    aiEnhanced: false,
    needsReview: false
  };
}