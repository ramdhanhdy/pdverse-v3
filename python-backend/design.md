# Document Chat Mode Design

## Overview

The Document Chat Mode is a specialized chat interface that allows users to have intelligent conversations about specific documents. Unlike general search, this mode provides contextually aware responses that leverage the document's structure, entities, relationships, and importance scores to deliver more accurate and helpful answers.

## Architecture

The Document Chat Mode implements a multi-layer retrieval architecture that combines several information retrieval techniques:

1. **Chunk-Level Semantic Search**: Uses vector embeddings to find semantically relevant content
2. **Entity Recognition**: Identifies named entities in both the query and document
3. **Relationship Mapping**: Leverages entity relationships to understand connections between concepts
4. **Structural Awareness**: Utilizes document structure (sections, tables, etc.) for better context
5. **Contextual Understanding**: Combines multiple relevance signals for improved ranking
6. **Multi-Document Support**: Handles queries across multiple documents simultaneously

## Components

### 1. `document_chat_search` Function

Located in `search.py`, this function implements the core retrieval logic:

```python
def document_chat_search(query, document_id, limit=15, importance_weight=0.3, 
                         entity_weight=0.3, structural_weight=0.2, recency_weight=0.2):
    # Multi-layer retrieval implementation
    # ...
```

Key features:
- Semantic similarity using vector embeddings
- Entity matching between query and document entities
- Relationship-based retrieval using DocumentRelationship
- Structure-aware retrieval (tables, sections)
- Weighted scoring combining multiple relevance signals
- Robust embedding processing to handle various embedding formats
- Support for multiple document IDs

### 2. `build_document_chat_context` Function

Located in `llm_helper.py`, this function formats the retrieved information into a rich context:

```python
def build_document_chat_context(chunks, query, documents_metadata=None):
    # Context building implementation
    # ...
```

Key features:
- Document metadata overview for multiple documents
- Entity information
- Structural context (section paths)
- Content type indicators (table, figure, text)
- Document attribution for each chunk

### 3. `generate_document_chat_response` Function

Located in `llm_helper.py`, this function generates the final response:

```python
async def generate_document_chat_response(query, context, documents_metadata=None, api_key=None):
    # Response generation implementation
    # ...
```

Key features:
- Document-specific system prompt
- Multi-document awareness
- Page and section reference instructions
- Source attribution guidance

### 4. API Integration

The `/query` endpoint in `api.py` has been updated to use the new document chat functionality when `chat_mode` is set to `"document"` and supports both single and multiple document IDs.

## Multi-Document Support

The document chat mode now supports querying across multiple documents simultaneously:

```python
# Handle both single document ID and list of document IDs
if isinstance(document_id, list):
    document_ids = document_id
else:
    document_ids = [document_id]

# Search across all documents
search_results = document_chat_search(query, document_ids)
```

The context building process organizes information by document:

```python
# Group chunks by document
document_chunks = {}
for chunk in chunks:
    doc_id = chunk.get("document_id")
    if doc_id not in document_chunks:
        document_chunks[doc_id] = []
    document_chunks[doc_id].append(chunk)

# Sort documents by relevance
sorted_doc_ids = sorted(document_chunks.keys(), 
                        key=lambda x: len(document_chunks[x]), 
                        reverse=True)
```

The response generation adapts to the number of documents:

```python
if len(documents_metadata) > 1:
    # Multiple documents prompt
    doc_titles = [doc.get('title', 'Untitled') for doc in documents_metadata]
    titles_str = ", ".join(doc_titles[:-1]) + " and " + doc_titles[-1]
    system_prompt = f"...helping with questions about multiple documents: {titles_str}..."
else:
    # Single document prompt
    title = documents_metadata[0].get('title', 'the document')
    system_prompt = f"...helping with questions about the document titled '{title}'..."
```

## Embedding Processing

The document chat search uses a robust embedding processing approach to handle various embedding formats:

```python
# Initialize embedder per request
embedder = SentenceTransformer("nomic-ai/nomic-embed-text-v2-moe", trust_remote_code=True, device='cpu')

# Generate embedding
embedding = embedder.encode(query)

# Ensure flat 1D list
if isinstance(embedding, np.ndarray):
    if embedding.ndim > 1:
        embedding = embedding.flatten()
    query_embedding = embedding.tolist()
elif isinstance(embedding, list):
    if len(embedding) > 0 and isinstance(embedding[0], list):
        query_embedding = embedding[0]
    else:
        query_embedding = embedding
else:
    query_embedding = embedding

# Validate embedding
if not isinstance(query_embedding, list) or len(query_embedding) != 768:
    raise ValueError(f"Expected 1D embedding of length 768...")
```

This approach ensures compatibility with different embedding formats and provides detailed error messages for troubleshooting.

## Scoring Mechanism

The document chat search uses a weighted scoring approach:

```python
combined_score = (
    base_score * (1 - importance_weight - entity_weight - structural_weight - recency_weight) +
    importance_score * importance_weight +
    (entity_score + relationship_score) * entity_weight / 2 +
    structural_score * structural_weight
)
```

Where:
- `base_score`: Semantic similarity between query and chunk
- `importance_score`: Pre-computed importance of the chunk
- `entity_score`: Relevance based on entity mentions
- `relationship_score`: Relevance based on entity relationships
- `structural_score`: Relevance based on document structure

## Usage

To use the Document Chat Mode:

1. Select one or more documents in the UI
2. Enter a query in the chat input
3. The system will:
   - Retrieve relevant chunks from all selected documents using the multi-layer approach
   - Build a rich context with document structure and entities
   - Generate a response that references specific documents, sections, and pages

## Benefits

- **Improved Accuracy**: Multi-signal retrieval finds more relevant information
- **Better Context**: Structural awareness provides better document understanding
- **Entity Awareness**: Recognition of named entities improves specific queries
- **Relationship Understanding**: Connections between concepts are preserved
- **Source Attribution**: Responses include document titles, page and section references
- **Multi-Document Analysis**: Compare and contrast information across documents

## Future Improvements

- Implement conversation history awareness for follow-up questions
- Add document comparison capabilities for multi-document queries
- Enhance entity extraction with more sophisticated NER models
- Implement cross-document entity resolution
- Add visual element understanding for figures and charts 