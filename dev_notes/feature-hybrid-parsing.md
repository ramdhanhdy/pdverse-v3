# Hybrid Parsing Strategy
Let's use MuPDF (the JavaScript library) for deterministic extraction and Gemini for enhancement:

## 1. Two-Tier Extraction Process
MuPDF (Primary) → Gemini (Enhancement)

## Implementation Approach

### Step 1: MuPDF Extraction (Deterministic)

```typescript
import * as mupdf from 'mupdf';

async function extractPdfMetadata(filePath: string) {
  await mupdf.ready;
  
  const data = fs.readFileSync(filePath);
  const doc = mupdf.Document.openDocument(data, 'application/pdf');
  
  const metadata = {
    title: '', author: '', subject: '', keywords: '', creator: '', producer: '',
    pageCount: doc.countPages(), creationDate: '', modificationDate: '',
    summary: '', documentType: '', topics: [],
    ai_enhanced: false, needs_review: false
  };
  
  try {
    const info = doc.getMetadata();
    if (info) {
      Object.assign(metadata, {
        title: info.title || '', author: info.author || '',
        subject: info.subject || '', keywords: info.keywords || '',
        creator: info.creator || '', producer: info.producer || '',
        creationDate: info.creationDate || '', modificationDate: info.modDate || ''
      });
    }
  } catch (error) {
    console.warn('Error extracting PDF metadata:', error);
  }
  
  let fullText = '';
  try {
    for (let i = 0; i < metadata.pageCount; i++) {
      fullText += doc.loadPage(i).toText() + ' ';
    }
  } catch (error) {
    console.warn('Error extracting text content:', error);
  }
  
  return { metadata, fullText };
}
```

### Step 2: Selective Gemini Enhancement

```typescript
async function enhanceWithGemini(metadata: any, fullText: string) {
  const needsEnhancement = !metadata.title || !metadata.author || 
                           metadata.summary === '' || metadata.topics.length === 0;
  
  if (!needsEnhancement || !fullText.trim()) return metadata;
  
  const missingFields = ['title', 'author', 'document type', 'summary (max 100 words)', 'main topics (comma-separated list)']
    .filter(field => !metadata[field.split(' ')[0]] || metadata[field.split(' ')[0]].length === 0);
  
  const prompt = `
    Based on the following document text, please provide ONLY the following information:
    ${missingFields.join(', ')}
    
    If you cannot determine any field with high confidence, respond with "UNCERTAIN" for that field.
    
    Document text:
    ${fullText.substring(0, 15000)}
  `;
  
  try {
    const response = await callGeminiApi(prompt);
    const enhancedMetadata = { ...metadata };
    
    ['title', 'author', 'documentType', 'summary', 'topics'].forEach(field => {
      if (!metadata[field] && response[field] && response[field] !== 'UNCERTAIN') {
        enhancedMetadata[field] = field === 'topics' ? response[field].split(',').map((t: string) => t.trim()) : response[field];
        enhancedMetadata.ai_enhanced = true;
      }
    });
    
    enhancedMetadata.needs_review = Object.keys(response).filter(key => 
      response[key] && response[key] !== 'UNCERTAIN').length > 2;
    
    return enhancedMetadata;
  } catch (error) {
    console.error('Gemini enhancement failed:', error);
    return metadata;
  }
}
```

### Step 3: Gemini API Call with Anti-Hallucination Techniques

```typescript
async function callGeminiApi(prompt: string) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1, topK: 40, topP: 0.95, maxOutputTokens: 1024, stopSequences: []
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
      ]
    })
  });

  const data = await response.json();
  
  try {
    const text = data.candidates[0].content.parts[0].text;
    const result: Record<string, any> = {};
    
    text.split('\n').filter(line => line.trim() !== '').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const fieldName = key.trim().toLowerCase();
        const fieldValue = valueParts.join(':').trim();
        
        switch (fieldName) {
          case 'title':
          case 'author':
          case 'document type':
            result[fieldName === 'document type' ? 'documentType' : fieldName] = fieldValue;
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
    });
    
    return result;
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    return {};
  }
}
```

### Step 4: Integrated Processing Function

```typescript
export async function processPdf(fileId: string, filePath: string) {
  try {
    const { metadata, fullText } = await extractPdfMetadata(filePath);
    const enhancedMetadata = await enhanceWithGemini(metadata, fullText);
    
    await savePdfMetadata({
      fileId,
      ...enhancedMetadata,
      topics: JSON.stringify(enhancedMetadata.topics),
      aiEnhanced: enhancedMetadata.ai_enhanced,
      needsReview: enhancedMetadata.needs_review
    });
    
    if (enhancedMetadata.pageCount > 0) {
      await processContentChunks(fileId, filePath, fullText);
    }
    
    return enhancedMetadata;
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
}
```

### Step 5: Content Chunking (Optional)

```typescript
async function processContentChunks(fileId: string, filePath: string, fullText: string) {
  await mupdf.ready;
  
  const data = fs.readFileSync(filePath);
  const doc = mupdf.Document.openDocument(data, 'application/pdf');
  const pageCount = doc.countPages();
  
  for (let i = 0; i < pageCount; i++) {
    try {
      const pageText = doc.loadPage(i).toText();
      
      await saveDocumentChunk({
        documentId: fileId,
        pageNumber: i + 1,
        chunkIndex: i,
        content: pageText,
        contentType: 'text',
        sectionPath: [],
        tokenCount: estimateTokenCount(pageText),
        importance: 0.5
      });
    } catch (error) {
      console.warn(`Error processing page ${i+1}:`, error);
    }
  }
}