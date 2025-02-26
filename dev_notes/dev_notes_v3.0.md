# PDVerse 3.0

## Upload and Processing Mechanism 

### 1. File Upload Process
- **User Interface:**
  - Upload page at `/dashboard/files/upload`
  - Drag and drop or file browser for PDF uploads
  - Progress indicators and error handling
  - Multiple file upload support
- **Upload Handling:**
  - FormData POST request to `/api/upload`
  - Frontend progress tracking
  - Redirect to files dashboard after upload
- **Server-side Processing:**
  - PDF validation in `/api/upload/route.ts`
  - UUID-based filenames
  - Physical storage in `/uploads` directory
  - Basic metadata saved to SQLite database

### 2. PDF Metadata Extraction
- **Extraction Process:**
  - Uses `pdf-lib` for metadata extraction
  - Extracts: Title, Author, Subject, Keywords, Creator, Producer, Page count
  - Saves to `pdf_metadata` table
  - Minimal metadata saved on extraction failure
- **Error Handling:**
  - Robust error handling
  - Failures don't prevent upload completion
  - Errors logged without disrupting user experience

### 3. File Viewing and Management
- **PDF Viewer (`react-pdf`):**
  - Page navigation
  - Zoom controls
  - Document outline/table of contents
  - Full-screen mode
  - Text search
- **File Management:**
  - Files dashboard for viewing uploads
  - Tagging and organization features
  - SQLite database for file metadata storage

### 4. AI Integration
- **Chat Interface:**
  - PDF interaction through chat
  - OpenAI API integration (default: GPT-4o)
  - Configurable AI model selection
- **Document Reference:**
  - PDF attachment to chat sessions
  - AI informed about attached documents
  - No direct text extraction or content embedding

### 5. Current Limitations
- **Text Extraction:**
  - No full text extraction or indexing
  - Lack of vector database or semantic search
  - AI can't directly access PDF content
- **Processing Pipeline:**
  - Limited to metadata extraction
  - No background job system for large documents
  - Absence of OCR capabilities
- **Integration Gaps:**
  - AI lacks direct access to PDF content
  - No content retrieval or analysis mechanism

### 6. Storage and Database
- **Storage System:**
  - Direct filesystem storage in `/uploads`
  - API endpoint for storage usage tracking
- **Database Structure:**
  - SQLite via Better-SQLite3
  - Tables: files, PDF metadata, tags, chat sessions, messages
  - Maintained relationships between files and chat sessions

## Metadata Structure

### Optimal Metadata Structure for Full-Text Search and RAG

To implement full-text search and Retrieval-Augmented Generation (RAG) in PDVerse, a comprehensive metadata structure is necessary to capture both document content and context. Here's the ideal metadata structure to support these features:

### Core Metadata Structure

1. **Document-Level Metadata**
   ```typescript
   interface DocumentMetadata {
     id: string;                    // Unique document identifier
     title: string;                 // Document title
     author: string;                // Author information
     creationDate: Date;            // When the document was created
     modificationDate: Date;        // When the document was last modified
     pageCount: number;             // Total number of pages
     fileSize: number;              // File size in bytes
     keywords: string[];            // Keywords/tags from document properties
     language: string;              // Document primary language
     summary: string;               // AI-generated document summary
     documentType: string;          // Academic, report, manual, etc.
     topics: string[];              // Main topics covered (AI-extracted)
   }
   ```

2. **Content Chunking Structure**
   ```typescript
   interface DocumentChunk {
     id: string;                    // Unique chunk identifier
     documentId: string;            // Reference to parent document
     pageNumber: number;            // Page number(s) this chunk appears on
     chunkIndex: number;            // Sequential index within document
     content: string;               // Raw text content
     contentType: 'text'|'table'|'figure'|'code'|'equation'; // Content type
     sectionPath: string[];         // Hierarchical section path
     embedding: number[];           // Vector embedding for semantic search
     tokenCount: number;            // Number of tokens in this chunk
     importance: number;            // AI-determined importance score (0-1)
   }
   ```

3. **Structural Metadata**
   ```typescript
   interface DocumentStructure {
     id: string;                    // Unique structure identifier
     documentId: string;            // Reference to parent document
     type: 'heading'|'toc'|'section'|'footnote'|'reference'|'appendix';
     level: number;                 // Heading/section level (1=highest)
     title: string;                 // Section title
     pageNumber: number;            // Page number where this structure appears
     parentId: string|null;         // Parent structure (for hierarchical structures)
     childrenIds: string[];         // Child structures
     startChunkId: string;          // First chunk in this section
     endChunkId: string;            // Last chunk in this section
   }
   ```

4. **Entity Metadata**
   ```typescript
   interface DocumentEntity {
     id: string;                    // Unique entity identifier
     documentId: string;            // Reference to parent document
     type: 'person'|'organization'|'location'|'date'|'term'|'concept';
     name: string;                  // Entity name/value
     normalizedName: string;        // Standardized form of the name
     occurrences: {                 // Where this entity appears
       chunkId: string;
       pageNumber: number;
       charOffset: number;
     }[];
     importance: number;            // Entity importance score (0-1)
     description: string;           // AI-generated entity description
   }
   ```

5. **Relationship Metadata**
   ```typescript
   interface DocumentRelationship {
     id: string;                    // Unique relationship identifier
     documentId: string;            // Reference to parent document
     sourceEntityId: string;        // Source entity
     targetEntityId: string;        // Target entity
     type: string;                  // Relationship type (e.g., "cites", "contains", "contradicts")
     confidence: number;            // Confidence score (0-1)
     description: string;           // Relationship description
     chunkIds: string[];            // Chunks where this relationship is evident
   }
   ```

### Database Schema Implementation

When implementing in PostgreSQL, structure tables as follows:
- `documents`: Store document-level metadata
- `document_chunks`: Store content chunks with a GIN index on content for full-text search
- `document_structures`: Store structural elements with parent-child relationships
- `document_entities`: Store extracted entities with a GIN index on names
- `document_relationships`: Store relationships between entities
- `document_embeddings`: Store vector embeddings (using pgvector extension)

### Special Considerations for RAG

To ensure effective RAG implementation, consider the following:

#### Embedding Storage:
- Use the pgvector extension in PostgreSQL to store and query vector embeddings
- Create embeddings at the chunk level for granular retrieval

#### Chunk Optimization:
- Store chunks with appropriate overlap (15-20%)
- Include contextual information with each chunk (e.g., section title)
- Balance chunk size for retrieval effectiveness (typically 256-512 tokens)

#### Metadata Enrichment:
- Store bidirectional links between related chunks
- Include confidence scores for extracted metadata
- Maintain provenance information (which extraction method produced each piece of metadata)

#### Query Support:
- Create specialized indexes for hybrid retrieval (combining keyword and semantic search)
- Store pre-computed similarity scores between chunks
- Include chunk quality metrics to prioritize high-quality content

## Implementation Approach

### Extraction Pipeline:
1. Text extraction from PDFs (using `pdf.js` or `PyPDF`)
2. Structure recognition (headings, sections, etc.)
3. Entity extraction (using NER models)
4. Chunk creation with overlap
5. Embedding generation (using models like OpenAI's `text-embedding-3-small`)

### Storage Strategy:
- Store raw text and basic metadata in PostgreSQL
- Store embeddings in PostgreSQL with pgvector
- Consider hybrid storage with PostgreSQL + vector database if scale demands

### Retrieval Mechanisms:
Implement hybrid retrieval combining:
- Full-text search for keyword matching
- Vector similarity search for semantic matching
- Structural awareness (e.g., prioritize headings)
- Entity-based filtering

