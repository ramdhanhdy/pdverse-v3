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
      
      // Parse PDF date format strings
      const rawCreationDate = doc.getMetaData('info:CreationDate') || '';
      const rawModificationDate = doc.getMetaData('info:ModDate') || '';
      
      metadata.creationDate = parsePdfDate(rawCreationDate);
      metadata.modificationDate = parsePdfDate(rawModificationDate);
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
        // Some versions of MuPDF don't have a page.close() method
        if (page && typeof page.close === 'function') {
          page.close();
        }
      }
    } catch (error) {
      console.warn('Error extracting text content:', error);
    } finally {
      // Make sure to close the document to prevent memory leaks
      try {
        if (doc && typeof doc.close === 'function') {
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
 * Parse PDF date format strings and convert to ISO format
 * PDF dates are in the format: D:YYYYMMDDHHmmSSOHH'mm'
 * Where:
 * - D: is a prefix
 * - YYYY is the year
 * - MM is the month
 * - DD is the day
 * - HH is the hour
 * - mm is the minute
 * - SS is the second
 * - O is the relationship of local time to UTC (+, -, or Z)
 * - HH' is the absolute value of the offset from UTC in hours
 * - mm' is the absolute value of the offset from UTC in minutes
 * @param {string} pdfDate - The PDF date string
 * @returns {string} - The date in ISO format, or the original string if parsing fails
 */
function parsePdfDate(pdfDate) {
  if (!pdfDate || typeof pdfDate !== 'string') {
    return '';
  }
  
  try {
    // Check if it starts with 'D:'
    if (!pdfDate.startsWith('D:')) {
      return pdfDate;
    }
    
    // Remove the 'D:' prefix
    const dateString = pdfDate.substring(2);
    
    // Extract components
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    
    // Check if we have time information
    if (dateString.length >= 14) {
      const hour = dateString.substring(8, 10);
      const minute = dateString.substring(10, 12);
      const second = dateString.substring(12, 14);
      
      // Check if we have timezone information
      let timezone = '';
      if (dateString.length > 14) {
        const tzSign = dateString.substring(14, 15);
        if (tzSign === '+' || tzSign === '-' || tzSign === 'Z') {
          if (tzSign === 'Z') {
            timezone = 'Z';
          } else {
            // Extract timezone hours and minutes
            const tzHours = dateString.substring(15, 17);
            let tzMinutes = '00';
            
            // Check if minutes are specified
            if (dateString.includes("'") && dateString.length >= 20) {
              tzMinutes = dateString.substring(18, 20);
            }
            
            timezone = `${tzSign}${tzHours}:${tzMinutes}`;
          }
        }
      }
      
      // Construct ISO date string
      return `${year}-${month}-${day}T${hour}:${minute}:${second}${timezone}`;
    } else {
      // Date only
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    console.warn('Error parsing PDF date:', error);
    return pdfDate; // Return original if parsing fails
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