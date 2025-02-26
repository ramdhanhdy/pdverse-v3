// lib/pdf/mupdf-parser.mjs
import fs from 'fs';
import * as mupdfjs from 'mupdf/mupdfjs';

/**
 * Extracts metadata and text content from a PDF file
 */
export async function extractPdfMetadata(filePath) {
  try {
    // Load the document
    const data = fs.readFileSync(filePath);
    const doc = await mupdfjs.PDFDocument.openDocument(data, 'application/pdf');
    
    // Initialize metadata
    const metadata = {
      title: '',
      author: '',
      subject: '',
      keywords: '',
      creator: '',
      producer: '',
      pageCount: doc.countPages(),
      creationDate: '',
      modificationDate: '',
      
      summary: '',
      documentType: '',
      topics: [],
      
      aiEnhanced: false,
      needsReview: false
    };
    
    // Try to extract metadata from the document
    try {
      // Get metadata using the info: prefix
      metadata.title = doc.getMetaData('info:Title') || '';
      metadata.author = doc.getMetaData('info:Author') || '';
      metadata.subject = doc.getMetaData('info:Subject') || '';
      metadata.keywords = doc.getMetaData('info:Keywords') || '';
      metadata.creator = doc.getMetaData('info:Creator') || '';
      metadata.producer = doc.getMetaData('info:Producer') || '';
      metadata.creationDate = doc.getMetaData('info:CreationDate') || '';
      metadata.modificationDate = doc.getMetaData('info:ModDate') || '';
    } catch (error) {
      console.warn('Error extracting PDF metadata:', error);
    }
    
    // Extract text content
    let fullText = '';
    const pageTexts = [];
    
    try {
      for (let i = 0; i < metadata.pageCount; i++) {
        // Load the page
        const page = await doc.loadPage(i);
        
        // Get the text content using structured text
        const structuredText = page.toStructuredText("preserve-whitespace");
        const textJson = structuredText.asJSON();
        
        // Extract text from the structured JSON
        let pageText = '';
        if (textJson && textJson.blocks) {
          for (const block of textJson.blocks) {
            if (block.type === 'text' && block.lines) {
              for (const line of block.lines) {
                if (line.text) {
                  pageText += line.text + ' ';
                }
              }
            }
          }
        }
        
        pageTexts.push(pageText);
        fullText += pageText + ' ';
        
        // Close the page after we're done with it
        page.close();
      }
    } catch (error) {
      console.warn('Error extracting text content:', error);
    } finally {
      // Make sure to close the document to prevent memory leaks
      try {
        if (doc) {
          doc.close();
        }
      } catch (closeError) {
        console.warn('Error closing document:', closeError);
      }
    }
    
    console.log(`Extracted metadata from PDF with ${metadata.pageCount} pages`);
    
    return { metadata, fullText, pageTexts };
  } catch (error) {
    console.error('Error in extractPdfMetadata:', error);
    // Return empty metadata and text if there's an error
    return { 
      metadata: {
        title: '',
        author: '',
        subject: '',
        keywords: '',
        creator: '',
        producer: '',
        pageCount: 0,
        creationDate: '',
        modificationDate: '',
        summary: '',
        documentType: '',
        topics: [],
        aiEnhanced: false,
        needsReview: true
      }, 
      fullText: '', 
      pageTexts: [] 
    };
  }
}

/**
 * Creates document chunks from PDF content
 */
export async function createDocumentChunks(documentId, pageTexts) {
  const chunks = [];
  
  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i];
    
    // Skip empty pages
    if (!pageText.trim()) continue;
    
    chunks.push({
      documentId,
      pageNumber: i + 1,
      chunkIndex: i,
      content: pageText,
      contentType: 'text',
      tokenCount: Math.ceil(pageText.length / 4) // Simple token count estimate
    });
  }
  
  return chunks;
}