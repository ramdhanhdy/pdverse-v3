import { extractPdfMetadata, createDocumentChunks } from './mupdf-parser.mjs';
import { enhanceMetadataWithGemini } from '../ai/gemini';
import { db, savePdfMetadata, saveDocumentChunk } from '../db';
import { PdfMetadataExtraction } from './types';

/**
 * Processes a PDF file, extracting metadata and content
 */
export async function processPdf(fileId: string, filePath: string) {
  try {
    console.log(`Processing PDF: ${filePath}`);
    
    // Step 1: Extract metadata and text with MuPDF
    console.log('Step 1: Extracting basic metadata with MuPDF...');
    const { metadata, fullText, pageTexts } = await extractPdfMetadata(filePath) as {
      metadata: PdfMetadataExtraction;
      fullText: string;
      pageTexts: string[];
    };
    console.log(`Extracted basic metadata and ${pageTexts.length} pages of text`);
    
    // Step 2: Enhance with Gemini if needed
    console.log('Step 2: Enhancing metadata with Gemini AI...');
    const enhancedMetadata = await enhanceMetadataWithGemini(metadata, fullText, filePath);
    
    if (enhancedMetadata.aiEnhanced) {
      console.log('Metadata was enhanced by Gemini AI with the following fields:');
      if (metadata.title !== enhancedMetadata.title) console.log('- Title');
      if (metadata.author !== enhancedMetadata.author) console.log('- Author');
      if (metadata.documentType !== enhancedMetadata.documentType) console.log('- Document Type');
      if (metadata.summary !== enhancedMetadata.summary) console.log('- Summary');
      if (JSON.stringify(metadata.topics) !== JSON.stringify(enhancedMetadata.topics)) console.log('- Topics');
      
      if (enhancedMetadata.needsReview) {
        console.log('NOTE: AI-enhanced metadata needs human review');
      }
    } else {
      console.log('No AI enhancement was needed for this document');
    }
    
    // Step 3: Save to database
    console.log('Step 3: Saving metadata to database...');
    try {
      // Ensure all metadata fields are primitive types (string, number, boolean, or null)
      // This prevents SQLite binding errors
      const sanitizedMetadata = {
        fileId,
        title: String(enhancedMetadata.title || ''),
        author: String(enhancedMetadata.author || ''),
        subject: String(enhancedMetadata.subject || ''),
        keywords: String(enhancedMetadata.keywords || ''),
        creator: String(enhancedMetadata.creator || ''),
        producer: String(enhancedMetadata.producer || ''),
        pageCount: Number(enhancedMetadata.pageCount || 0),
        creationDate: String(enhancedMetadata.creationDate || ''),
        modificationDate: String(enhancedMetadata.modificationDate || ''),
        
        // Additional fields
        summary: String(enhancedMetadata.summary || ''),
        documentType: String(enhancedMetadata.documentType || ''),
        
        // Convert topics array to string
        topics: Array.isArray(enhancedMetadata.topics) 
          ? JSON.stringify(enhancedMetadata.topics) 
          : (typeof enhancedMetadata.topics === 'string' 
              ? enhancedMetadata.topics 
              : JSON.stringify(enhancedMetadata.topics || [])),
        
        // Convert boolean values to integers for SQLite compatibility
        aiEnhanced: enhancedMetadata.aiEnhanced ? 1 : 0,
        needsReview: enhancedMetadata.needsReview ? 1 : 0
      };

      // Log sanitized data for debugging
      console.log('Sanitized metadata for database:', 
        Object.keys(sanitizedMetadata).reduce<Record<string, string>>((acc, key) => {
          // Use type assertion to tell TypeScript this is safe
          acc[key] = typeof sanitizedMetadata[key as keyof typeof sanitizedMetadata];
          return acc;
        }, {}));
      
      // Additional debugging - log actual values
      console.log('Sanitized metadata values:', JSON.stringify({
        ...sanitizedMetadata,
        // Truncate potentially long fields for readability
        summary: sanitizedMetadata.summary?.substring(0, 50) + '...',
        topics: sanitizedMetadata.topics?.substring(0, 50) + '...'
      }, null, 2));

      try {
        // Try saving each field individually to isolate the problematic field
        const { fileId, ...fieldsToBeSaved } = sanitizedMetadata;
        
        const problematicFields = [];
        
        // Test each field individually
        for (const [key, value] of Object.entries(fieldsToBeSaved)) {
          try {
            const testObj: any = { 
              fileId: sanitizedMetadata.fileId,
              [key]: value 
            };
            await savePdfMetadata(testObj);
            console.log(`Field '${key}' saved successfully`);
          } catch (e) {
            problematicFields.push({ key, value, type: typeof value });
            console.error(`Problem with field '${key}': ${e}`);
          }
        }
        
        if (problematicFields.length > 0) {
          console.error('Problematic fields:', problematicFields);
          throw new Error(`Found ${problematicFields.length} problematic fields`);
        }
        
        // If no individual fields are problematic, try saving all together
        await savePdfMetadata(sanitizedMetadata);
      } catch (innerError) {
        console.error('Error during field testing:', innerError);
        throw innerError;
      }
    } catch (dbError) {
      console.error('Error saving metadata to database:', dbError);
      // Handle unknown type error by checking if it's an Error object or has a message property
      const errorMessage = dbError instanceof Error 
        ? dbError.message 
        : String(dbError);
      throw new Error(`Database error: ${errorMessage}`);
    }
    
    // Step 4: Process content chunks
    if (pageTexts.length > 0) {
      console.log('Step 4: Creating document chunks...');
      try {
        const chunks = await createDocumentChunks(fileId, pageTexts);
        
        console.log(`Created ${chunks.length} document chunks`);
        let savedChunks = 0;
        for (const chunk of chunks) {
          await saveDocumentChunk(chunk);
          savedChunks++;
        }
        console.log(`Successfully saved ${savedChunks} document chunks`);
      } catch (chunkError) {
        console.error('Error processing document chunks:', chunkError);
        // Continue despite chunk errors - we still have the metadata
      }
    }
    
    console.log('PDF processing complete');
    return enhancedMetadata;
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
}