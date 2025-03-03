# search.py
import time
import numpy as np
from sqlalchemy import func, literal, text, or_, and_
from pgvector.sqlalchemy import Vector
from db import get_db_session, Document, DocumentChunk, DocumentEntity, DocumentRelationship, DocumentPage
from pdf_processing import embedder
import logging
from uuid import UUID
from sqlalchemy.sql.expression import cast
from sentence_transformers import SentenceTransformer  # Direct import

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
print("Using search.py version with literal() and debug logging - 2025-03-01")

def apply_filters(query, filters):
    """Apply additional filters to a search query."""
    if not filters:
        return query

    has_doc_filters = any(f in filters for f in [
        'author', 'creation_date_start', 'creation_date_end',
        'document_type', 'topics', 'language'
    ])

    if has_doc_filters:
        query = query.join(Document, DocumentChunk.document_id == Document.id)

    if 'author' in filters and filters['author']:
        query = query.filter(Document.author.ilike(f"%{filters['author']}%"))
    if 'creation_date_start' in filters and filters['creation_date_start']:
        query = query.filter(Document.creation_date >= filters['creation_date_start'])
    if 'creation_date_end' in filters and filters['creation_date_end']:
        query = query.filter(Document.creation_date <= filters['creation_date_end'])
    if 'document_type' in filters and filters['document_type']:
        query = query.filter(Document.document_type == filters['document_type'])
    if 'language' in filters and filters['language']:
        query = query.filter(Document.language == filters['language'])
    if 'topics' in filters and filters['topics']:
        topics = filters['topics'] if isinstance(filters['topics'], list) else [filters['topics']]
        query = query.filter(Document.topics.overlap(cast(topics, Document.topics.type)))
    if 'min_page' in filters and filters['min_page'] is not None:
        query = query.filter(DocumentChunk.page_number >= filters['min_page'])
    if 'max_page' in filters and filters['max_page'] is not None:
        query = query.filter(DocumentChunk.page_number <= filters['max_page'])

    return query

def fulltext_search(query, limit=10, offset=0, document_id=None, **filters):
    """Perform PostgreSQL full-text search on document chunks."""
    start_time = time.time()
    session = get_db_session()

    search_terms = " | ".join(term for term in query.split() if len(term) > 2) or query

    try:
        rank = func.ts_rank(
            func.to_tsvector('english', DocumentChunk.content),
            func.to_tsquery('english', search_terms)
        ).label('rank')

        base_query = session.query(
            DocumentChunk.id,
            DocumentChunk.document_id,
            DocumentChunk.page_number,
            DocumentChunk.content,
            DocumentChunk.section_path,
            rank
        ).filter(
            func.to_tsvector('english', DocumentChunk.content).op('@@')(
                func.to_tsquery('english', search_terms)
            )
        )

        if document_id:
            document_id = UUID(document_id) if isinstance(document_id, str) else document_id
            base_query = base_query.filter(DocumentChunk.document_id == document_id)

        base_query = apply_filters(base_query, filters)

        count_query = session.query(func.count(DocumentChunk.id)).filter(
            func.to_tsvector('english', DocumentChunk.content).op('@@')(
                func.to_tsquery('english', search_terms)
            )
        )
        if document_id:
            count_query = count_query.filter(DocumentChunk.document_id == document_id)
        count_query = apply_filters(count_query, filters)
        total_count = count_query.scalar() or 0

        results = base_query.order_by(rank.desc()).offset(offset).limit(limit).all()

        formatted_results = []
        for r in results:
            doc = session.query(Document).filter(Document.id == r.document_id).first()
            formatted_results.append({
                'chunk_id': str(r.id),
                'document_id': str(r.document_id),
                'page_number': r.page_number,
                'content': r.content,
                'section_path': r.section_path,
                'score': float(r.rank),
                'document_info': {
                    'title': doc.title if doc else 'Unknown',
                    'author': doc.author if doc else 'Unknown',
                    'document_type': doc.document_type if doc else 'Unknown'
                }
            })

        elapsed_time = time.time() - start_time
        return {
            'results': formatted_results,
            'total': total_count,
            'query': query,
            'limit': limit,
            'offset': offset,
            'search_type': 'fulltext',
            'execution_time': elapsed_time
        }
    except Exception as e:
        print(f"Full-text search failed: {e}")  # Use print for debugging
        return {'results': [], 'total': 0, 'error': str(e)}

def vector_search(query, limit=10, offset=0, document_id=None, **filters):
    """Perform semantic search using vector similarity."""
    start_time = time.time()
    session = get_db_session()

    try:
        print(f"Vector search query: '{query}' (type: {type(query)})")
        if not isinstance(query, str) or not query.strip():
            print(f"Invalid query: must be a non-empty string, got {query}")
            raise ValueError(f"Query must be a non-empty string, got {query}")

        # Generate embedding
        try:
            embedding = embedder.encode(query)
        except Exception as e:
            print(f"Embedding generation failed: {e}")
            raise ValueError(f"Failed to generate embedding for query '{query}': {str(e)}")

        print(f"Raw embedding type: {type(embedding)}, shape: {getattr(embedding, 'shape', 'N/A')}, sample: {embedding[:5] if isinstance(embedding, (np.ndarray, list)) else embedding}")

        # Ensure flat 1D list
        if isinstance(embedding, np.ndarray):
            if embedding.ndim > 1:
                print(f"Flattening NumPy array embedding: {embedding.shape}")
                embedding = embedding.flatten()
            query_embedding = embedding.tolist()
        elif isinstance(embedding, list):
            if len(embedding) > 0 and isinstance(embedding[0], list):
                print(f"Unwrapping nested list embedding: {len(embedding)} sublists")
                query_embedding = embedding[0]
            else:
                query_embedding = embedding
        else:
            query_embedding = embedding

        # Validate embedding
        if not isinstance(query_embedding, list) or len(query_embedding) != 768:
            print(f"Invalid embedding: expected 1D list of 768 elements, got type: {type(query_embedding)}, length: {len(query_embedding) if isinstance(query_embedding, list) else 'N/A'}, value: {query_embedding[:10] if isinstance(query_embedding, list) else query_embedding}")
            raise ValueError(f"Expected 1D embedding of length 768, got type: {type(query_embedding)}, length: {len(query_embedding) if isinstance(query_embedding, list) else 'N/A'}")

        print(f"Processed embedding length: {len(query_embedding)}, sample: {query_embedding[:5]}")

        # Use literal for proper binding
        distance = DocumentChunk.embedding.op('<=>')(literal(query_embedding, type_=Vector(768))).label('distance')
        similarity = (1 - distance).label('similarity')

        columns = [
            DocumentChunk.id,
            DocumentChunk.document_id,
            DocumentChunk.page_number,
            DocumentChunk.content,
            DocumentChunk.section_path,
            DocumentChunk.importance,
            similarity
        ]
        base_query = session.query(*columns)

        if document_id:
            document_id = UUID(document_id) if isinstance(document_id, str) else document_id
            base_query = base_query.filter(DocumentChunk.document_id == document_id)

        base_query = apply_filters(base_query, filters)

        count_query = session.query(func.count(DocumentChunk.id))
        if document_id:
            count_query = count_query.filter(DocumentChunk.document_id == document_id)
        count_query = apply_filters(count_query, filters)
        total_count = count_query.scalar() or 0

        weighted_similarity = (similarity * DocumentChunk.importance).label('weighted_similarity')
        results = base_query.add_columns(weighted_similarity)\
                           .order_by(weighted_similarity.desc())\
                           .offset(offset).limit(limit).all()

        formatted_results = []
        for r in results:
            doc = session.query(Document).filter(Document.id == r.document_id).first()
            formatted_results.append({
                'chunk_id': str(r.id),
                'document_id': str(r.document_id),
                'page_number': r.page_number,
                'content': r.content,
                'section_path': r.section_path,
                'similarity': float(r.similarity),
                'importance': float(r.importance),
                'score': float(r.weighted_similarity),
                'document_info': {
                    'title': doc.title if doc else 'Unknown',
                    'author': doc.author if doc else 'Unknown',
                    'document_type': doc.document_type if doc else 'Unknown'
                }
            })

        elapsed_time = time.time() - start_time
        return {
            'results': formatted_results,
            'total': total_count,
            'query': query,
            'limit': limit,
            'offset': offset,
            'search_type': 'vector',
            'execution_time': elapsed_time
        }
    except Exception as e:
        print(f"Vector search failed: {e}")  # Use print for debugging
        return {'results': [], 'total': 0, 'error': str(e)}

def hybrid_search(query, limit=10, offset=0, document_id=None, vector_weight=0.65, text_weight=0.35, **filters):
    """Perform hybrid search combining vector similarity and text matching."""
    print("Starting hybrid_search function")
    start_time = time.time()
    session = get_db_session()
    
    try:
        print(f"Query received: '{query}' (type: {type(query)})")
        if not isinstance(query, str) or not query.strip():
            print(f"Validation failed: Query must be a non-empty string, got {query}")
            raise ValueError(f"Query must be a non-empty string, got {query}")

        # Initialize embedder per request
        print("Initializing SentenceTransformer embedder")
        embedder = SentenceTransformer("nomic-ai/nomic-embed-text-v2-moe", trust_remote_code=True, device='cpu')
        
        # Generate embedding
        print("Generating embedding with embedder")
        embedding = embedder.encode(query)
        print(f"Raw embedding: type={type(embedding)}, shape={getattr(embedding, 'shape', 'N/A')}, sample={embedding[:5] if isinstance(embedding, (np.ndarray, list)) else embedding}")

        # Ensure flat 1D list
        if isinstance(embedding, np.ndarray):
            if embedding.ndim > 1:
                print(f"Flattening NumPy array: shape={embedding.shape}")
                embedding = embedding.flatten()
            query_embedding = embedding.tolist()
        elif isinstance(embedding, list):
            if len(embedding) > 0 and isinstance(embedding[0], list):
                print(f"Unwrapping nested list: {len(embedding)} sublists")
                query_embedding = embedding[0]
            else:
                query_embedding = embedding
        else:
            query_embedding = embedding

        # Validate embedding
        if not isinstance(query_embedding, list) or len(query_embedding) != 768:
            print(f"Invalid embedding: type={type(query_embedding)}, length={len(query_embedding) if isinstance(query_embedding, list) else 'N/A'}, value={query_embedding[:10] if isinstance(query_embedding, list) else query_embedding}")
            raise ValueError(f"Expected 1D embedding of length 768, got type={type(query_embedding)}, length={len(query_embedding) if isinstance(query_embedding, list) else 'N/A'}")

        print(f"Processed embedding: length={len(query_embedding)}, sample={query_embedding[:5]}")

        # Use raw SQL with join to documents table
        search_terms = " | ".join(term for term in query.split() if len(term) > 2) or query
        query_sql = text("""
            SELECT 
                dc.id AS chunk_id,
                dc.document_id,
                dc.page_number,
                dc.content,
                dc.section_path,
                dc.importance,
                1 - (dc.embedding <=> :query_embedding) AS vector_sim,
                ts_rank(to_tsvector('english', dc.content), to_tsquery('english', :search_terms)) AS text_rank,
                (:vector_weight * (1 - (dc.embedding <=> :query_embedding)) + :text_weight * COALESCE(ts_rank(to_tsvector('english', dc.content), to_tsquery('english', :search_terms)), 0)) AS combined_score,
                d.title AS doc_title,
                d.author AS doc_author,
                d.document_type AS doc_type
            FROM document_chunks dc
            LEFT JOIN documents d ON dc.document_id = d.id
            ORDER BY combined_score DESC
            LIMIT :limit OFFSET :offset
        """)
        
        results = session.execute(
            query_sql,
            {
                "query_embedding": str(query_embedding),
                "search_terms": search_terms,
                "vector_weight": vector_weight,
                "text_weight": text_weight,
                "limit": limit,
                "offset": offset
            }
        ).fetchall()

        total_count = session.query(func.count(DocumentChunk.id)).scalar() or 0

        formatted_results = [
            {
                'chunk_id': str(r.chunk_id),
                'document_id': str(r.document_id),
                'page_number': r.page_number,
                'content': r.content,
                'section_path': r.section_path,
                'vector_similarity': float(r.vector_sim),
                'text_rank': float(r.text_rank) if r.text_rank else 0.0,
                'score': float(r.combined_score),
                'importance': float(r.importance),
                'document_info': {
                    'title': r.doc_title if r.doc_title else 'Unknown',
                    'author': r.doc_author if r.doc_author else 'Unknown',
                    'document_type': r.doc_type if r.doc_type else 'Unknown'
                }
            } for r in results
        ]

        elapsed_time = time.time() - start_time
        print(f"Search completed: {len(formatted_results)} results in {elapsed_time:.2f} seconds")
        return {
            'results': formatted_results,
            'total': total_count,
            'query': query,
            'limit': limit,
            'offset': offset,
            'search_type': 'hybrid',
            'weights': {'vector': vector_weight, 'text': text_weight},
            'execution_time': elapsed_time
        }
    except Exception as e:
        print(f"Hybrid search failed with exception: {e}")
        return {'results': [], 'total': 0, 'error': str(e)}

def document_chat_search(query, document_id, limit=15, importance_weight=0.3, entity_weight=0.3, structural_weight=0.2, recency_weight=0.2):
    """
    Multi-layer retrieval architecture for document chat mode.
    
    This function combines:
    1. Chunk-level semantic search
    2. Entity recognition and relationships
    3. Document structure awareness
    4. Contextual understanding with importance scoring
    
    Args:
        query: The user's query string
        document_id: The ID of the document to search within
        limit: Maximum number of results to return
        importance_weight: Weight for chunk importance scores
        entity_weight: Weight for entity-based relevance
        structural_weight: Weight for structural relevance (sections, tables)
        recency_weight: Weight for temporal relevance
        
    Returns:
        Dictionary with search results and metadata
    """
    start_time = time.time()
    session = get_db_session()
    
    try:
        print(f"Document chat search query: '{query}' for document: {document_id}")
        
        # Validate document_id
        if not document_id:
            raise ValueError("Document ID is required for document chat search")
        
        document_id = UUID(document_id) if isinstance(document_id, str) else document_id
        
        # Get document metadata for context
        document = session.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise ValueError(f"Document with ID {document_id} not found")
            
        # Initialize embedder per request - similar to hybrid_search
        print("Initializing SentenceTransformer embedder")
        embedder = SentenceTransformer("nomic-ai/nomic-embed-text-v2-moe", trust_remote_code=True, device='cpu')
        
        # Generate embedding - adopt the approach from hybrid_search
        print(f"Generating embedding for query: '{query}'")
        embedding = embedder.encode(query)
        print(f"Raw embedding: type={type(embedding)}, shape={getattr(embedding, 'shape', 'N/A')}, sample={embedding[:5] if isinstance(embedding, (np.ndarray, list)) else embedding}")
        
        # Ensure flat 1D list - same processing as in hybrid_search
        if isinstance(embedding, np.ndarray):
            if embedding.ndim > 1:
                print(f"Flattening NumPy array: shape={embedding.shape}")
                embedding = embedding.flatten()
            query_embedding = embedding.tolist()
        elif isinstance(embedding, list):
            if len(embedding) > 0 and isinstance(embedding[0], list):
                print(f"Unwrapping nested list: {len(embedding)} sublists")
                query_embedding = embedding[0]
            else:
                query_embedding = embedding
        else:
            query_embedding = embedding
        
        # Validate embedding
        if not isinstance(query_embedding, list) or len(query_embedding) != 768:
            print(f"Invalid embedding: type={type(query_embedding)}, length={len(query_embedding) if isinstance(query_embedding, list) else 'N/A'}, value={query_embedding[:10] if isinstance(query_embedding, list) else query_embedding}")
            raise ValueError(f"Expected 1D embedding of length 768, got type={type(query_embedding)}, length={len(query_embedding) if isinstance(query_embedding, list) else 'N/A'}")
        
        print(f"Processed embedding: length={len(query_embedding)}, sample={query_embedding[:5]}")
            
        # 1. Chunk-Level Semantic Search using raw SQL
        # Use raw SQL with direct parameter binding like in hybrid_search
        query_sql = text("""
            SELECT 
                dc.id AS chunk_id,
                dc.document_id,
                dc.page_number,
                dc.content,
                dc.section_path,
                dc.importance,
                dc.content_type,
                1 - (dc.embedding <=> :query_embedding) AS semantic_similarity
            FROM document_chunks dc
            WHERE dc.document_id = :document_id
        """)
        
        results = session.execute(
            query_sql,
            {
                "query_embedding": str(query_embedding),
                "document_id": str(document_id)
            }
        ).fetchall()
        
        # 2. Entity Recognition
        # Extract potential entities from the query
        # This is a simple approach - in production, use NER models
        query_terms = query.lower().split()
        potential_entities = []
        
        # Get entities from the document
        entities = session.query(DocumentEntity).filter(
            DocumentEntity.document_id == document_id
        ).all()
        
        # Find entities mentioned in the query
        entity_matches = []
        for entity in entities:
            entity_name = entity.name.lower()
            normalized_name = entity.normalized_name.lower() if entity.normalized_name else entity_name
            
            # Check if entity is mentioned in query
            if (entity_name in query.lower() or 
                normalized_name in query.lower() or
                any(term in entity_name.split() for term in query_terms)):
                entity_matches.append(entity.id)
                potential_entities.append(entity_name)
        
        # 3. Relationship Mapping
        # Find chunks that contain relationships with matched entities
        relationship_chunk_ids = []
        if entity_matches:
            relationships = session.query(DocumentRelationship).filter(
                and_(
                    DocumentRelationship.document_id == document_id,
                    or_(
                        DocumentRelationship.source_entity_id.in_(entity_matches),
                        DocumentRelationship.target_entity_id.in_(entity_matches)
                    )
                )
            ).all()
            
            # Extract chunk IDs from relationships
            for rel in relationships:
                if rel.chunk_ids:
                    relationship_chunk_ids.extend(rel.chunk_ids)
        
        # 4. Structural Awareness
        # Find pages with tables if query suggests tabular data
        table_related_terms = ['table', 'chart', 'graph', 'figure', 'data', 'statistics', 'numbers']
        table_query = any(term in query.lower() for term in table_related_terms)
        
        table_pages = []
        if table_query:
            table_pages = session.query(DocumentPage.page_number).filter(
                and_(
                    DocumentPage.document_id == document_id,
                    DocumentPage.has_table == True
                )
            ).all()
            table_pages = [page.page_number for page in table_pages]
        
        # 5. Process and score results
        processed_results = []
        for r in results:
            # Base score from semantic similarity
            base_score = float(r.semantic_similarity)
            
            # Entity relevance score
            entity_score = 0.0
            if potential_entities:
                content_lower = r.content.lower()
                entity_mentions = sum(1 for entity in potential_entities if entity in content_lower)
                entity_score = min(1.0, entity_mentions / len(potential_entities))
            
            # Relationship relevance score
            relationship_score = 1.0 if str(r.chunk_id) in relationship_chunk_ids else 0.0
            
            # Structural relevance score
            structural_score = 0.0
            if table_query and r.page_number in table_pages:
                structural_score = 1.0
            elif r.content_type == 'table' and table_query:
                structural_score = 1.0
            elif r.section_path and len(r.section_path) > 0:
                # Sections with deeper nesting are more specific
                structural_score = min(1.0, len(r.section_path) / 5)
            
            # Importance score from document processing
            importance_score = float(r.importance)
            
            # Calculate combined score with weights
            combined_score = (
                base_score * (1 - importance_weight - entity_weight - structural_weight - recency_weight) +
                importance_score * importance_weight +
                (entity_score + relationship_score) * entity_weight / 2 +
                structural_score * structural_weight
            )
            
            # Add to processed results
            processed_results.append({
                'chunk_id': str(r.chunk_id),
                'document_id': str(r.document_id),
                'page_number': r.page_number,
                'content': r.content,
                'section_path': r.section_path,
                'content_type': r.content_type,
                'semantic_similarity': base_score,
                'entity_relevance': entity_score,
                'relationship_relevance': relationship_score,
                'structural_relevance': structural_score,
                'importance': importance_score,
                'score': combined_score
            })
        
        # Sort by combined score and limit results
        processed_results.sort(key=lambda x: x['score'], reverse=True)
        limited_results = processed_results[:limit]
        
        # Add document metadata
        for result in limited_results:
            result['document_info'] = {
                'title': document.title,
                'author': document.author,
                'document_type': document.document_type,
                'creation_date': document.creation_date.isoformat() if document.creation_date else None,
                'topics': document.topics
            }
        
        # Calculate execution time
        elapsed_time = time.time() - start_time
        
        return {
            'results': limited_results,
            'total': len(processed_results),
            'query': query,
            'limit': limit,
            'document_id': str(document_id),
            'search_type': 'document_chat',
            'execution_time': elapsed_time,
            'entities_found': potential_entities,
            'document_metadata': {
                'title': document.title,
                'author': document.author,
                'document_type': document.document_type,
                'page_count': document.page_count,
                'topics': document.topics
            }
        }
    except Exception as e:
        print(f"Document chat search failed: {e}")
        return {'results': [], 'total': 0, 'error': str(e)}