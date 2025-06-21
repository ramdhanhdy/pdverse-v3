// lib/pdf/types.ts
export interface PdfMetadataExtraction {
    id?: string;
    filename?: string;
    title: string;
    author: string;
    subject: string;
    keywords: string;
    creator: string;
    producer: string;
    pageCount: number;
    creationDate: string;
    modificationDate: string;
    file_creation_date?: string | Date;
    file_modification_date?: string | Date;
    file_size?: number;
    language?: string;
    
    // Additional fields
    summary: string;
    documentType: string;
    topics: string[];
    table_count?: number;
    
    // Tracking fields
    aiEnhanced: boolean;
    needsReview: boolean;
  }
  
  export interface PdfExtractionResult {
    metadata: PdfMetadataExtraction;
    fullText: string;
    pageTexts: string[];
  }
  
  export interface DocumentChunk {
    documentId: string;
    pageNumber: number;
    chunkIndex: number;
    content: string;
    contentType: string;
    tokenCount: number;
  }