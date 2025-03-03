# search.py
import time
import numpy as np
from sqlalchemy import func, literal, text
from pgvector.sqlalchemy import Vector
from db import get_db_session, Document, DocumentChunk
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