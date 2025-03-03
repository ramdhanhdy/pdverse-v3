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

### 2. `build_document_chat_context` Function

Located in `llm_helper.py`, this function formats the retrieved information into a rich context:

```python
def build_document_chat_context(chunks, query, document_metadata=None):
    # Context building implementation
    # ...
```

Key features:
- Document metadata overview
- Entity information
- Structural context (section paths)
- Content type indicators (table, figure, text)

### 3. `generate_document_chat_response` Function

Located in `llm_helper.py`, this function generates the final response:

```python
async def generate_document_chat_response(query, context, document_metadata=None, api_key=None):
    # Response generation implementation
    # ...
```

Key features:
- Document-specific system prompt
- Page and section reference instructions
- Source attribution guidance

### 4. API Integration

The `/query` endpoint in `api.py` has been updated to use the new document chat functionality when `chat_mode` is set to `"document"`.

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

1. Select a document in the UI
2. Enter a query in the chat input
3. The system will:
   - Retrieve relevant chunks using the multi-layer approach
   - Build a rich context with document structure and entities
   - Generate a response that references specific sections and pages

## Benefits

- **Improved Accuracy**: Multi-signal retrieval finds more relevant information
- **Better Context**: Structural awareness provides better document understanding
- **Entity Awareness**: Recognition of named entities improves specific queries
- **Relationship Understanding**: Connections between concepts are preserved
- **Source Attribution**: Responses include page and section references

## Future Improvements

- Implement conversation history awareness for follow-up questions
- Add document comparison capabilities for multi-document queries
- Enhance entity extraction with more sophisticated NER models
- Implement cross-document entity resolution
- Add visual element understanding for figures and charts 