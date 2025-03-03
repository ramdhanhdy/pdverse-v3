# api.py
import os
import tempfile
import shutil
import traceback
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from db import get_db_session, Document, DocumentChunk, DocumentPage, DocumentEntity, DocumentRelationship, Session, store_data
from pdf_processing import ingest_pdf
from llm_helper import query_llm, build_context, generate_response_with_context, generate_response, format_search_results, generate_advanced_analysis
from search import fulltext_search, vector_search, hybrid_search
from config import logger, CONFIG
from file_storage import save_uploaded_file, delete_file, get_file_path
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UploadRequest(BaseModel):
    file_path: str

# Update the QueryRequest class to include api_key
class QueryRequest(BaseModel):
    query: str
    document_id: Optional[str] = None
    api_key: Optional[str] = None
    chat_mode: Optional[str] = "document"

class SearchRequest(BaseModel):
    query: str
    document_id: Optional[str] = None
    limit: int = 10
    offset: int = 0
    search_type: str = "hybrid"
    vector_weight: float = 0.65
    text_weight: float = 0.35
    filters: dict = {}

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(..., description="PDF file to upload"),
    title: Optional[str] = Form(None, alias="docTitle"),
    author: Optional[str] = Form(None, alias="docAuthor")
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    file_path = None
    file_id = None
    
    try:
        logger.info(f"Saving uploaded file: {file.filename}")
        file_path, file_id = save_uploaded_file(file)
        logger.info(f"File saved successfully at: {file_path}")
        
        logger.info(f"Processing PDF: {file_path}")
        metadata, chunks, pages, entities, relationships = ingest_pdf(file_path)
        logger.info(f"PDF processed successfully: {len(chunks)} chunks, {len(pages)} pages")
        
        # Check for existing document
        with get_db_session() as session:
            existing_doc = session.query(Document).filter(Document.id == metadata["id"]).first()
            if existing_doc:
                logger.info(f"Document with ID {metadata['id']} already exists, skipping storage")
                delete_file(file_id)
                return {
                    "id": str(existing_doc.id),
                    "status": "exists",
                    "filename": file.filename,
                    "title": existing_doc.title,
                    "page_count": existing_doc.page_count,
                    "chunk_count": session.query(DocumentChunk).filter(DocumentChunk.document_id == existing_doc.id).count()
                }
        
        # Override metadata if provided
        if title:
            metadata["title"] = title
        if author:
            metadata["author"] = author
                
        # Store in database
        logger.info("Storing document in database")
        with get_db_session() as session:
            doc = Document(**metadata)
            chunk_objects = [DocumentChunk(**chunk) for chunk in chunks]
            page_objects = [DocumentPage(**page) for page in pages]
            
            # Correctly map entity fields
            entity_objects = [
                DocumentEntity(
                    id=entity["id"],  # Use provided UUID
                    document_id=metadata["id"],
                    type=entity["type"],
                    name=entity["name"],
                    normalized_name=entity["normalized_name"],
                    occurrences=entity["occurrences"],
                    importance=entity.get("importance", 0.0),
                    description=entity.get("description", "")
                ) for entity in entities
            ]
            
            # Correctly map relationship fields
            relationship_objects = [
                DocumentRelationship(
                    id=rel["id"],  # Use provided UUID
                    document_id=metadata["id"],
                    source_entity_id=rel["source_entity_id"],  # Corrected from "source_id"
                    target_entity_id=rel["target_entity_id"],  # Corrected from "target_id"
                    type=rel["type"],
                    confidence=rel.get("confidence", 0.0),
                    description=rel.get("description", ""),
                    chunk_ids=rel.get("chunk_ids", [])
                ) for rel in relationships
            ]
            
            store_data(session, [doc] + chunk_objects + page_objects + entity_objects + relationship_objects)
        
        logger.info(f"Document stored successfully with ID: {metadata['id']}")
        return {
            "id": str(metadata["id"]),
            "status": "success",
            "filename": file.filename,
            "title": metadata["title"],
            "page_count": metadata["page_count"],
            "chunk_count": len(chunks)
        }
    except Exception as e:
        logger.error(f"Error processing PDF: {e}")
        logger.debug(traceback.format_exc())
        
        if file_id:
            try:
                delete_file(file_id)
                logger.info(f"Deleted file {file_id} due to processing error")
            except Exception as del_error:
                logger.error(f"Failed to delete file after processing error: {del_error}")
        
        raise HTTPException(status_code=500, detail=f"PDF processing failed: {str(e)}")
    finally:
        pass

@app.get("/document/{document_id}")
async def get_document(document_id: str):
    try:
        with get_db_session() as session:
            # Add validation for UUID format
            try:
                doc_id = uuid.UUID(document_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid document ID format")
            
            document = session.query(Document).filter(Document.id == doc_id).first()
            
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")
            
            # Get related entities and relationships
            entities = session.query(DocumentEntity).filter(
                DocumentEntity.document_id == doc_id
            ).all()
            
            relationships = session.query(DocumentRelationship).filter(
                DocumentRelationship.document_id == doc_id
            ).all()
            
            # Extract metadata from document and related entities
            metadata = {
                "summary": document.summary,
                "document_type": document.document_type,
                "topics": [entity.name for entity in entities 
                          if entity.type == "topic"],
                "entities": {
                    "people": [entity.name for entity in entities 
                              if entity.type == "person"],
                    "organizations": [entity.name for entity in entities 
                                    if entity.type == "organization"],
                    "locations": [entity.name for entity in entities 
                                if entity.type == "location"]
                },
                "relationships": [
                    {
                        "source": session.get(DocumentEntity, rel.source_entity_id).name,
                        "target": session.get(DocumentEntity, rel.target_entity_id).name,
                        "type": rel.type
                    } for rel in relationships
                ]
            }
            
            return {
                "id": str(document.id),
                "filename": document.filename,
                "title": document.title,
                "author": document.author or "Unknown",
                "page_count": document.page_count or 0,
                "creation_date": document.creation_date.isoformat() if document.creation_date else None,
                "modification_date": document.modification_date.isoformat() if document.modification_date else None,
                "document_type": document.document_type or "Uncategorized",
                "topics": document.topics if document.topics else []
            }
    except Exception as e:
        logger.error(f"Document retrieval failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/documents")
async def list_documents():
    try:
        with get_db_session() as session:
            documents = session.query(Document).order_by(Document.creation_date.desc()).all()
            return [
                {
                    "id": str(doc.id),
                    "filename": doc.filename,
                    "title": doc.title,
                    "author": doc.author,
                    "page_count": doc.page_count,
                    "creation_date": doc.creation_date.isoformat() if doc.creation_date else None
                }
                for doc in documents
            ]
    except Exception as e:
        logger.error(f"Document list failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/document/{document_id}")
async def delete_document(document_id: str):
    try:
        with get_db_session() as session:
            # Delete related chunks and pages first
            session.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
            session.query(DocumentPage).filter(DocumentPage.document_id == document_id).delete()
            
            # Delete main document
            document = session.query(Document).filter(Document.id == uuid.UUID(document_id)).first()
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")
                
            session.delete(document)
            session.commit()
            
            return {"status": "success"}
            
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID format")
    except Exception as e:
        session.rollback()
        logger.error(f"Document deletion failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/search")
async def search_documents(request: SearchRequest):
    try:
        search_type = request.search_type.lower()
        valid_types = ["fulltext", "vector", "hybrid"]
        
        if search_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid search type. Valid options: {', '.join(valid_types)}"
            )

        search_func = {
            "fulltext": fulltext_search,
            "vector": vector_search,
            "hybrid": hybrid_search
        }[search_type]

        logger.info(f"Performing {search_type} search with query: '{request.query}'")

        result = search_func(
            query=request.query,
            document_id=request.document_id,
            limit=request.limit,
            offset=request.offset,
            vector_weight=request.vector_weight,
            text_weight=request.text_weight,
            **request.filters
        )

        if "error" in result:
            logger.error(f"Search error: {result['error']}")
            raise HTTPException(status_code=500, detail=result["error"])

        return result

    except ValueError as e:
        logger.error(f"Search value error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
async def query_document(request: Request):
    data = await request.json()
    query = data.get("query", "")
    document_id = data.get("document_id")
    chat_mode = data.get("chat_mode", "document")  # Default to document mode
    api_key = data.get("api_key")  # Get API key from request
    
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    try:
        logger.info(f"Processing query in {chat_mode} mode: '{query[:50]}...' with document_id: {document_id}")
        
        # Different handling based on chat mode
        if chat_mode == "document":
            # Existing document chat logic
            try:
                search_results = hybrid_search(query, limit=5, document_id=document_id)
                chunks = search_results.get("results", [])
                logger.info(f"Found {len(chunks)} chunks for document query")
                context = build_context(chunks, query)
            except Exception as search_error:
                logger.error(f"Search error in document mode: {search_error}")
                context = "Error retrieving document context. Proceeding with general response."
                chunks = []
            
            # Call LLM with document context and API key
            response = await generate_response_with_context(query, context, api_key)
            
        elif chat_mode == "general":
            # General chat without document context
            response = await generate_response(query, api_key)
            context = ""
            
        elif chat_mode == "search":
            # Search mode
            try:
                search_results = hybrid_search(query, limit=10)
                chunks = search_results.get("results", [])
                logger.info(f"Found {len(chunks)} chunks for search query")
                context = build_context(chunks, query)
                response = format_search_results(chunks, query)
            except Exception as search_error:
                logger.error(f"Search error in search mode: {search_error}")
                response = "Sorry, I encountered an error while searching the documents."
                context = ""
                chunks = []
            
        elif chat_mode == "advanced":
            # Advanced document analysis
            try:
                search_results = hybrid_search(query, limit=8, document_id=document_id)
                chunks = search_results.get("results", [])
                logger.info(f"Found {len(chunks)} chunks for advanced analysis")
                context = build_context(chunks, query)
            except Exception as search_error:
                logger.error(f"Search error in advanced mode: {search_error}")
                context = "Error retrieving document context. Proceeding with general response."
                chunks = []
            
            # Call LLM with advanced analysis prompt and API key
            response = await generate_advanced_analysis(query, context, api_key)
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported chat mode: {chat_mode}")
        
        logger.info(f"Successfully generated response for query in {chat_mode} mode")
        return {
            "response": response,
            "context": context,
            "mode": chat_mode
        }
    except Exception as e:
        logger.error(f"Query failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)