# api.py
import os
import tempfile
import shutil
import traceback
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from db import get_db_session, Document, DocumentChunk, DocumentPage, DocumentEntity, DocumentRelationship, Session, store_data
from pdf_processing import ingest_pdf
from llm_helper import query_llm, build_context, generate_response_with_context, generate_response, format_search_results, generate_advanced_analysis, generate_response_from_messages
from search import fulltext_search, vector_search, hybrid_search
from config import logger, CONFIG
from file_storage import save_uploaded_file, delete_file, get_file_path
import uuid
import json
import time
from fastapi.responses import StreamingResponse

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

class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]
    model: Optional[str] = "gpt-4o"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 4096
    stream: Optional[bool] = True
    api_key: Optional[str] = None

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
    stream = data.get("stream", False)  # Get streaming option
    
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    try:
        # Log the full request data for debugging
        logger.info(f"Query endpoint received: {json.dumps(data)}")
        logger.info(f"Processing query in {chat_mode} mode: '{query}' with document_id: {document_id}, stream: {stream}")
        
        # Different handling based on chat mode
        if chat_mode == "document":
            # Document chat logic - only use chunks from the specific document
            try:
                # Get document chunks directly from the database instead of using hybrid search
                from database import get_db_session
                from db import DocumentChunk, Document
                from sqlalchemy import func
                
                session = get_db_session()
                
                # Verify the document exists
                if not document_id:
                    raise ValueError("Document ID is required for document mode")
                
                logger.info(f"Fetching chunks for document: {document_id}")
                
                # First get the document info
                document = session.query(Document).filter(Document.id == document_id).first()
                if not document:
                    raise ValueError(f"Document with ID {document_id} not found")
                
                document_title = document.title or "Untitled Document"
                logger.info(f"Found document: {document_title} (ID: {document_id})")
                
                # Get chunks from the specific document
                chunks_query = session.query(DocumentChunk).filter(
                    DocumentChunk.document_id == document_id
                ).order_by(
                    DocumentChunk.page_number,
                    DocumentChunk.importance.desc()
                ).limit(10).all()
                
                logger.info(f"Retrieved {len(chunks_query)} chunks from document {document_id}")
                
                # Convert to the same format as search results
                chunks = []
                for chunk in chunks_query:
                    chunks.append({
                        'chunk_id': str(chunk.id),
                        'document_id': str(chunk.document_id),
                        'page_number': chunk.page_number,
                        'content': chunk.content,
                        'section_path': chunk.section_path,
                        'importance': float(chunk.importance),
                        'document_title': document_title,
                        'document_info': {
                            'title': document_title,
                            'author': document.author if document.author else 'Unknown',
                            'document_type': document.document_type if document.document_type else 'Unknown'
                        }
                    })
                
                logger.info(f"Found {len(chunks)} chunks for document {document_id}")
                context = build_context(chunks, query)
                logger.info(f"Built context with {len(context)} characters")
            except Exception as doc_error:
                logger.error(f"Error in document mode: {doc_error}")
                logger.error(traceback.format_exc())
                
                # Provide more specific error messages
                if "Document with ID" in str(doc_error) and "not found" in str(doc_error):
                    context = f"Error: The document with ID {document_id} could not be found. Please check if the document exists or try uploading it again."
                elif not document_id:
                    context = "Error: No document ID was provided. Please select a document to chat with."
                else:
                    context = f"Error retrieving document context: {str(doc_error)}. Please try again or select a different document."
                
                chunks = []
        
        elif chat_mode == "search":
            # Search mode - use hybrid search across all documents or filtered by document_id
            try:
                search_results = hybrid_search(query, limit=10, document_id=document_id)
                chunks = search_results.get("results", [])
                logger.info(f"Found {len(chunks)} chunks for search query")
                context = build_context(chunks, query)
            except Exception as search_error:
                logger.error(f"Search error in search mode: {search_error}")
                context = f"Error performing search: {str(search_error)}. Proceeding with general response."
                chunks = []
        
        elif chat_mode == "general":
            # General chat without document context
            if stream:
                logger.info("Streaming response requested for general mode")
                
                # Create a streaming response
                async def generate_stream():
                    # Get the full response
                    response = await generate_response(query, api_key)
                    
                    # Send the content directly as plain text
                    yield response
                    
                return StreamingResponse(
                    generate_stream(),
                    media_type="text/plain",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive"
                    }
                )
            
            # Non-streaming response
            response = await generate_response(query, api_key)
            context = ""
        
        elif chat_mode == "advanced":
            # Advanced document analysis
            try:
                search_results = hybrid_search(query, limit=8)
                chunks = search_results.get("results", [])
                logger.info(f"Found {len(chunks)} chunks for advanced analysis")
                context = build_context(chunks, query)
                
                if stream:
                    logger.info("Streaming response requested for advanced mode")
                    
                    # Create a streaming response
                    async def generate_stream():
                        # Get the full response with advanced analysis
                        response = await generate_advanced_analysis(query, context, api_key)
                        
                        # Send the content directly as plain text
                        yield response
                        
                    return StreamingResponse(
                        generate_stream(),
                        media_type="text/plain",
                        headers={
                            "Cache-Control": "no-cache",
                            "Connection": "keep-alive"
                        }
                    )
                
                response = await generate_advanced_analysis(query, context, api_key)
            except Exception as advanced_error:
                logger.error(f"Advanced analysis error: {advanced_error}")
                response = "Sorry, I encountered an error while performing advanced analysis."
                context = ""
                chunks = []
            
        else:
            raise HTTPException(status_code=400, detail=f"Invalid chat mode: {chat_mode}")
        
        # Handle streaming for document and search modes
        if chat_mode in ["document", "search"]:
            # Check if streaming is requested
            if stream:
                logger.info(f"Streaming response requested for {chat_mode} mode")
                
                # Create a streaming response
                async def generate_stream():
                    # Get the appropriate response based on mode
                    if chat_mode == "document":
                        response = await generate_response_with_context(query, context, api_key)
                    elif chat_mode == "search":
                        response = format_search_results(chunks, query)
                    
                    # Send the content directly as plain text without any JSON formatting
                    # This will be compatible with streamProtocol: 'text' in the frontend
                    yield response
                    
                return StreamingResponse(
                    generate_stream(),
                    media_type="text/plain",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive"
                    }
                )
            
            # Non-streaming response
            if chat_mode == "document":
                response = await generate_response_with_context(query, context, api_key)
            elif chat_mode == "search":
                response = format_search_results(chunks, query)
        
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

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        logger.info(f"Chat request received with {len(request.messages)} messages")
        
        # Log the full messages for debugging
        logger.info(f"Chat messages: {json.dumps(request.messages)}")
        
        # Check if streaming is requested
        if request.stream:
            logger.info("Streaming response requested")
            
            # Create a streaming response
            async def generate_stream():
                # Get the full response using all messages
                response = await generate_response_from_messages(
                    messages=request.messages,
                    api_key=request.api_key
                )
                
                # Send the content directly as plain text without any JSON formatting
                # This will be compatible with streamProtocol: 'text' in the frontend
                yield response
                
            return StreamingResponse(
                generate_stream(),
                media_type="text/plain",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive"
                }
            )
        
        # Non-streaming response
        response = await generate_response_from_messages(
            messages=request.messages,
            api_key=request.api_key
        )
        
        logger.info("Chat response generated successfully")
        
        # Return the response
        return {"response": response}

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)