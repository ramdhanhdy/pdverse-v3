import { GoogleGenerativeAI } from '@google/generative-ai';
import { PdfMetadataExtraction } from '../pdf/types';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Enhances PDF metadata using Gemini AI
 */
export async function enhanceMetadataWithGemini(
  metadata: PdfMetadataExtraction, 
  fullText: string
): Promise<PdfMetadataExtraction> {
  // Only proceed with Gemini if we need to enhance the metadata
  const needsEnhancement = !metadata.title || !metadata.author || 
                          metadata.summary === '' || metadata.topics.length === 0;
  
  if (!needsEnhancement || !fullText.trim()) {
    return metadata;
  }
  
  // Prepare a prompt that focuses on missing information
  const missingFields = [];
  if (!metadata.title) missingFields.push('title');
  if (!metadata.author) missingFields.push('author');
  if (!metadata.documentType) missingFields.push('document type');
  if (metadata.summary === '') missingFields.push('summary (max 100 words)');
  if (metadata.topics.length === 0) missingFields.push('main topics (comma-separated list)');
  
  // Create a targeted prompt
  const prompt = `
    Based on the following document text, please provide ONLY the following information:
    ${missingFields.join(', ')}
    
    If you cannot determine any field with high confidence, respond with "UNCERTAIN" for that field.
    
    Document text:
    ${fullText.substring(0, 15000)}  // Limit text length to avoid token limits
  `;
  
  try {
    // Get the generative model
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });
    
    // Generate content
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Parse the response into a structured format
    const parsedResponse = parseGeminiResponse(text);
    
    // Update metadata with AI-generated content
    const enhancedMetadata = { ...metadata };
    
    if (!metadata.title && parsedResponse.title && parsedResponse.title !== 'UNCERTAIN') {
      enhancedMetadata.title = parsedResponse.title;
      enhancedMetadata.aiEnhanced = true;
    }
    
    if (!metadata.author && parsedResponse.author && parsedResponse.author !== 'UNCERTAIN') {
      enhancedMetadata.author = parsedResponse.author;
      enhancedMetadata.aiEnhanced = true;
    }
    
    if (!metadata.documentType && parsedResponse.documentType && parsedResponse.documentType !== 'UNCERTAIN') {
      enhancedMetadata.documentType = parsedResponse.documentType;
      enhancedMetadata.aiEnhanced = true;
    }
    
    if (metadata.summary === '' && parsedResponse.summary && parsedResponse.summary !== 'UNCERTAIN') {
      enhancedMetadata.summary = parsedResponse.summary;
      enhancedMetadata.aiEnhanced = true;
    }
    
    if (metadata.topics.length === 0 && parsedResponse.topics && parsedResponse.topics !== 'UNCERTAIN') {
      enhancedMetadata.topics = Array.isArray(parsedResponse.topics) 
        ? parsedResponse.topics 
        : parsedResponse.topics.split(',').map((t: string) => t.trim());
      enhancedMetadata.aiEnhanced = true;
    }
    
    // Flag for review if AI significantly changed the metadata
    const significantChanges = Object.keys(parsedResponse).filter(key => 
      parsedResponse[key] && parsedResponse[key] !== 'UNCERTAIN').length > 2;
      
    enhancedMetadata.needsReview = significantChanges;
    
    return enhancedMetadata;
  } catch (error) {
    console.error('Gemini enhancement failed:', error);
    return metadata; // Return original metadata if enhancement fails
  }
}

/**
 * Parses the response from Gemini into a structured format
 */
function parseGeminiResponse(text: string): Record<string, any> {
  const result: Record<string, any> = {};
  
  const lines = text.split('\n').filter(line => line.trim() !== '');
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const fieldName = key.trim().toLowerCase();
      const fieldValue = valueParts.join(':').trim();
      
      switch (fieldName) {
        case 'title':
          result.title = fieldValue;
          break;
        case 'author':
        case 'authors':
          result.author = fieldValue;
          break;
        case 'document type':
          result.documentType = fieldValue;
          break;
        case 'summary':
          result.summary = fieldValue;
          break;
        case 'main topics':
        case 'topics':
          result.topics = fieldValue.split(',').map((t: string) => t.trim());
          break;
      }
    }
  }
  
  return result;
}