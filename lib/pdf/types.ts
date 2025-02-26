// lib/pdf/types.ts
export interface PdfMetadataExtraction {
    title: string;
    author: string;
    subject: string;
    keywords: string;
    creator: string;
    producer: string;
    pageCount: number;
    creationDate: string;
    modificationDate: string;
    
    // Additional fields
    summary: string;
    documentType: string;
    topics: string[];
    
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