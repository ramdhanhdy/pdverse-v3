import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { PdfMetadataExtraction } from '../pdf/types';
import * as fs from 'fs';
import * as mupdfjs from 'mupdf/mupdfjs';

// Initialize the Gemini API
const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
  console.warn('GEMINI_API_KEY is not set in environment variables. Gemini AI features will not work.');
  console.warn('Make sure you have added GEMINI_API_KEY to your .env.local file');
}
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Extracts text from the first N pages of a PDF file
 */
async function extractTextFromFirstPages(pdfPath: string, pageCount: number = 20): Promise<string> {
  try {
    // Load the document
    const data = fs.readFileSync(pdfPath);
    const doc = await mupdfjs.PDFDocument.openDocument(data, 'application/pdf');
    
    // Determine how many pages to extract
    const totalPages = doc.countPages();
    const pagesToExtract = Math.min(totalPages, pageCount);
    
    console.log(`Extracting text from ${pagesToExtract} pages out of ${totalPages} total pages`);
    
    // Extract text from each page
    let extractedText = '';
    
    for (let i = 0; i < pagesToExtract; i++) {
      try {
        // Load the page
        const page = await doc.loadPage(i);
        
        // Try multiple methods to extract text
        let pageText = '';
        
        // Method 1: Use the walk() method which is more reliable
        try {
          const structuredText = page.toStructuredText("preserve-whitespace");
          
          // Use a StringBuilder approach to collect text
          let textBuilder = '';
          
          structuredText.walk({
            onChar: function(utf8) {
              if (utf8) {
                textBuilder += utf8;
              }
            },
            endLine: function() {
              textBuilder += '\n';
            },
            endTextBlock: function() {
              textBuilder += '\n';
            }
          });
          
          pageText = textBuilder;
          console.log(`Page ${i+1}: Extracted ${pageText.length} characters using walk()`);
        } catch (walkError) {
          console.warn(`Error using walk() for page ${i+1}:`, walkError);
          
          // Method 2: Fall back to JSON parsing if walk() fails
          try {
            const structuredText = page.toStructuredText("preserve-whitespace");
            const textJsonString = structuredText.asJSON();
            
            // Parse the JSON string into an object
            const textJson = JSON.parse(textJsonString);
            
            if (textJson && textJson.blocks) {
              for (const block of textJson.blocks) {
                if (block.type === 'text' && block.lines) {
                  for (const line of block.lines) {
                    if (line.text) {
                      pageText += line.text + ' ';
                    }
                  }
                  // Add a newline after each block to preserve paragraph structure
                  pageText += '\n';
                }
              }
            }
            console.log(`Page ${i+1}: Extracted ${pageText.length} characters using JSON parsing`);
          } catch (jsonError) {
            console.warn(`Error parsing JSON for page ${i+1}:`, jsonError);
          }
        }
        
        // Method 3: Try using page.text() if available and other methods failed
        if (!pageText || pageText.length === 0) {
          try {
            if (typeof (page as any).text === 'function') {
              pageText = (page as any).text();
              console.log(`Page ${i+1}: Extracted ${pageText.length} characters using text()`);
            }
          } catch (textError) {
            console.warn(`Error using text() for page ${i+1}:`, textError);
          }
        }
        
        // If we still don't have text, log a warning
        if (!pageText || pageText.length === 0) {
          console.warn(`Warning: Could not extract text from page ${i+1}`);
        }
        
        extractedText += `\n--- Page ${i+1} ---\n${pageText}\n`;
        
        // Clean up page resources if possible
        if (page && typeof (page as any).close === 'function') {
          (page as any).close();
        }
      } catch (pageError) {
        console.warn(`Error extracting text from page ${i}:`, pageError);
      }
    }
    
    // Clean up document resources
    try {
      if (doc && typeof (doc as any).close === 'function') {
        (doc as any).close();
      }
    } catch (closeError) {
      console.warn('Error closing document:', closeError);
    }
    
    return extractedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

/**
 * Enhances PDF metadata using Gemini AI
 */
export async function enhanceMetadataWithGemini(
  metadata: PdfMetadataExtraction, 
  fullText: string,
  pdfPath?: string
): Promise<PdfMetadataExtraction> {
  // Only proceed with Gemini if we need to enhance the metadata
  const needsEnhancement = !metadata.title || !metadata.author || 
                         metadata.summary === '' || metadata.topics.length === 0;
  
  if (!needsEnhancement) {
    return metadata;
  }
  
  // Prepare a prompt that focuses on missing information
  const missingFields = [];
  if (!metadata.title) missingFields.push('title');
  if (!metadata.author) missingFields.push('author');
  if (!metadata.documentType) missingFields.push('document type');
  if (metadata.summary === '') missingFields.push('summary (max 100 words)');
  if (metadata.topics.length === 0) missingFields.push('main topics (comma-separated list)');
  
  try {
    // Get the generative model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });
    
    console.log("Using Gemini 2.0 Flash model for PDF analysis");
    
    let parts: Part[] = [];
    
    // If PDF path is provided, use it directly
    if (pdfPath && fs.existsSync(pdfPath)) {
      console.log(`Reading PDF file from: ${pdfPath}`);
      try {
        // Check file size before reading the entire file
        const stats = fs.statSync(pdfPath);
        const fileSizeInBytes = stats.size;
        const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
        
        // Add text prompt
        parts.push({
          text: `Based on this PDF document, please provide ONLY the following information:
          ${missingFields.join(', ')}
          
          If you cannot determine any field with high confidence, respond with "UNCERTAIN" for that field.
          
          Format your response as a JSON object with these fields.`
        });
        
        // If file is too large, extract text from first pages instead of sending the PDF
        if (fileSizeInMB > 19) {
          console.log(`PDF file is large (${fileSizeInMB.toFixed(2)}MB). Extracting text from first 20 pages instead of sending the full PDF.`);
          const extractedText = await extractTextFromFirstPages(pdfPath, 20);
          
          // Add the extracted text as part of the prompt
          parts[0].text += `\n\nHere is the text extracted from the first 20 pages of the document:\n${extractedText}`;
          
          console.log(`Successfully extracted text from first 20 pages (${extractedText.length} characters)`);
        } else {
          // For smaller files, send the PDF directly
          const pdfData = fs.readFileSync(pdfPath);
          const mimeType = 'application/pdf';
          
          // Add PDF file as a separate part
          parts.push({
            inlineData: {
              data: Buffer.from(pdfData).toString('base64'),
              mimeType
            }
          });
          
          console.log("Successfully added PDF file to the request");
        }
      } catch (error) {
        console.error("Error reading PDF file:", error);
        // Fallback to text-only if file reading fails
        parts = [{ text: createTextOnlyPrompt(missingFields, fullText) }];
      }
    } else {
      // Fallback to text-only approach
      console.log("No PDF path provided or file doesn't exist, using text-only approach");
      parts = [{ text: createTextOnlyPrompt(missingFields, fullText) }];
    }
    
    // Generate content
    console.log("Sending request to Gemini with parts:", parts.length);
    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();
    
    // Log the raw response for debugging
    console.log("Raw Gemini response:", text);
    
    // Parse the response into a structured format
    const parsedResponse = parseGeminiResponse(text);
    console.log("Parsed Gemini response:", parsedResponse);
    
    // Merge the parsed response with the existing metadata
    return {
      ...metadata,
      ...parsedResponse,
      aiEnhanced: true
    };
  } catch (error) {
    console.error('Error enhancing metadata with Gemini:', error);
    return {
      ...metadata,
      needsReview: true
    };
  }
}

/**
 * Creates a text-only prompt for Gemini
 */
function createTextOnlyPrompt(missingFields: string[], fullText: string): string {
  return `
    Based on the following document text, please provide ONLY the following information:
    ${missingFields.join(', ')}
    
    If you cannot determine any field with high confidence, respond with "UNCERTAIN" for that field.
    
    Format your response as a JSON object with these fields.
    
    Document text:
    ${fullText.substring(0, 15000)}  // Limit text length to avoid token limits
  `;
}

/**
 * Parses the Gemini response into a structured format
 */
export function parseGeminiResponse(text: string): Partial<PdfMetadataExtraction> {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                     text.match(/{[\s\S]*}/);
    
    if (jsonMatch) {
      const jsonString = jsonMatch[0].replace(/```json|```/g, '').trim();
      console.log("Extracted JSON string:", jsonString);
      const parsed = JSON.parse(jsonString);
      
      // Map field names from Gemini response to our expected field names
      if (parsed.main_topics && !parsed.topics) {
        parsed.topics = parsed.main_topics;
        delete parsed.main_topics;
      }
      
      // Convert document_type to documentType if needed
      if (parsed.document_type && !parsed.documentType) {
        parsed.documentType = parsed.document_type;
        delete parsed.document_type;
      }
      
      // Convert topics to array if it's a string
      if (typeof parsed.topics === 'string') {
        parsed.topics = parsed.topics
          .split(',')
          .map((t: string) => t.trim())
          .filter((t: string) => t);
      }
      
      return parsed;
    }
    
    // If no JSON found, try to extract information from plain text
    const result: Partial<PdfMetadataExtraction> = {};
    
    // Extract title
    const titleMatch = text.match(/title:?\s*([^\n]+)/i);
    if (titleMatch) result.title = titleMatch[1].trim();
    
    // Extract author
    const authorMatch = text.match(/author:?\s*([^\n]+)/i);
    if (authorMatch) result.author = authorMatch[1].trim();
    
    // Extract document type
    const docTypeMatch = text.match(/document type:?\s*([^\n]+)/i);
    if (docTypeMatch) result.documentType = docTypeMatch[1].trim();
    
    // Extract summary
    const summaryMatch = text.match(/summary:?\s*([^\n]+(\n[^\n]+)*)/i);
    if (summaryMatch) result.summary = summaryMatch[1].trim();
    
    // Extract topics
    const topicsMatch = text.match(/topics:?\s*([^\n]+)/i);
    if (topicsMatch) {
      result.topics = topicsMatch[1]
        .split(',')
        .map(t => t.trim())
        .filter(t => t);
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    return {};
  }
}