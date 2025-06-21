# api.py
import os
import tempfile
import shutil
import traceback
import asyncio
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from db import get_db_session, Document, DocumentChunk, DocumentPage, DocumentEntity, DocumentRelationship, Session, store_data
from pdf_processing import ingest_pdf
from llm_helper import query_llm, build_context, generate_response_with_context, generate_response, format_search_results, generate_advanced_analysis, generate_response_from_messages, build_document_chat_context, generate_document_chat_response
from search import fulltext_search, vector_search, hybrid_search, document_chat_search
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
    """
    Query a document with LLM assistance.
    
    This endpoint supports different chat modes:
    - document: Enhanced document chat with multi-layer retrieval
    - search: Simple search results
    - advanced: Advanced document analysis
    """
    try:
        data = await request.json()
        query = data.get("query")
        document_id = data.get("document_id")
        chat_mode = data.get("chat_mode", "document")
        api_key = data.get("api_key")
        stream = data.get("stream", False)
        
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
        
        logger.info(f"Query received: {query[:50]}... (mode: {chat_mode})")
        
        # Document chat mode with multi-layer retrieval
        if chat_mode == "document":
            if not document_id:
                raise HTTPException(status_code=400, detail="Document ID is required for document chat mode")
            
            # Handle both single document ID and list of document IDs
            if isinstance(document_id, list):
                if not document_id:  # Empty list
                    raise HTTPException(status_code=400, detail="At least one document ID is required")
                document_ids = document_id
                logger.info(f"Processing multiple documents: {len(document_ids)} documents")
            else:
                document_ids = [document_id]
                logger.info(f"Processing single document: {document_id}")
            
            # Use our new document chat search function
            search_results = document_chat_search(query, document_ids)
            
            if "error" in search_results:
                raise HTTPException(status_code=500, detail=f"Search failed: {search_results['error']}")
            
            # Build enhanced context for document chat
            context = build_document_chat_context(
                search_results["results"], 
                query,
                search_results.get("documents_metadata"),
                search_results.get("entities_found")
            )
            
            # Generate streaming response if requested
            if stream:
                async def generate_stream():
                    # Get the full response with enhanced document context
                    response_text = await generate_document_chat_response(
                        query, 
                        context, 
                        search_results.get("documents_metadata"),
                        api_key
                    )
                    
                    # Stream the response
                    for chunk in response_text.split():
                        yield f"{chunk} "
                        await asyncio.sleep(0.01)  # Simulate streaming
                
                return StreamingResponse(generate_stream(), media_type="text/plain")
            
            # Generate non-streaming response
            response_text = await generate_document_chat_response(
                query, 
                context,
                search_results.get("documents_metadata"),
                api_key
            )
            
            return {
                "response": response_text,
                "context": context,
                "mode": "document",
                "search_results": search_results
            }
        
        # Search mode - return formatted search results
        elif chat_mode == "search":
            search_results = hybrid_search(query, document_id=document_id, limit=5)
            
            if stream:
                async def generate_stream():
                    # Format search results
                    response_text = format_search_results(search_results["results"], query)
                    
                    # Stream the response
                    for chunk in response_text.split():
                        yield f"{chunk} "
                        await asyncio.sleep(0.01)  # Simulate streaming
                
                return StreamingResponse(generate_stream(), media_type="text/plain")
            
            response_text = format_search_results(search_results["results"], query)
            
            return {
                "response": response_text,
                "mode": "search",
                "search_results": search_results
            }
        
        # Advanced analysis mode
        elif chat_mode == "advanced":
            search_results = hybrid_search(query, document_id=document_id, limit=10)
            context = build_context(search_results["results"], query)
            
            if stream:
                async def generate_stream():
                    # Get the full response with advanced analysis
                    response_text = await generate_advanced_analysis(query, context, api_key)
                    
                    # Stream the response
                    for chunk in response_text.split():
                        yield f"{chunk} "
                        await asyncio.sleep(0.01)  # Simulate streaming
                
                return StreamingResponse(generate_stream(), media_type="text/plain")
            
            response_text = await generate_advanced_analysis(query, context, api_key)
            
            return {
                "response": response_text,
                "context": context,
                "mode": "advanced",
                "search_results": search_results
            }
        
        # General chat mode - no document context
        else:
            if stream:
                async def generate_stream():
                    # Get the full response
                    response_text = await generate_response(query, api_key)
                    
                    # Stream the response
                    for chunk in response_text.split():
                        yield f"{chunk} "
                        await asyncio.sleep(0.01)  # Simulate streaming
                
                return StreamingResponse(generate_stream(), media_type="text/plain")
            
            response_text = await generate_response(query, api_key)
            
            return {
                "response": response_text,
                "mode": "general"
            }
            
    except Exception as e:
        logger.error(f"Error in query_document: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/generate_document_queries")
async def generate_document_queries(request: Request):
    """
    Generate document-specific queries for multiple documents.
    
    This endpoint takes an original query and a list of document IDs,
    and generates a tailored query for each document based on its content.
    """
    try:
        data = await request.json()
        original_query = data.get("original_query")
        document_ids = data.get("document_ids")
        api_key = data.get("api_key")
        
        if not original_query:
            raise HTTPException(status_code=400, detail="Original query is required")
        
        if not document_ids or not isinstance(document_ids, list) or len(document_ids) == 0:
            raise HTTPException(status_code=400, detail="At least one document ID is required")
        
        logger.info(f"Generating document-specific queries for {len(document_ids)} documents")
        
        session = get_db_session()
        document_queries = []
        document_metadata = []
        
        # Get metadata for each document
        for doc_id in document_ids:
            try:
                document = session.query(Document).filter(Document.id == uuid.UUID(doc_id)).first()
                if not document:
                    logger.warning(f"Document not found: {doc_id}")
                    document_queries.append(original_query)  # Use original query as fallback
                    document_metadata.append(None)
                    continue
                
                # Add document metadata
                doc_meta = {
                    'id': str(document.id),
                    'title': document.title,
                    'author': document.author,
                    'document_type': document.document_type,
                    'topics': document.topics,
                    'page_count': document.page_count
                }
                document_metadata.append(doc_meta)
                
                # Get a sample of chunks to understand document content
                sample_chunks = session.query(DocumentChunk).filter(
                    DocumentChunk.document_id == document.id
                ).order_by(DocumentChunk.importance.desc()).limit(5).all()
                
                sample_content = "\n".join([chunk.content for chunk in sample_chunks])
                
                # Generate document-specific query using LLM
                system_prompt = """You are an expert query reformulation system. Your task is to reformulate the original query to be more specific to the document content provided.
                Focus on adapting the query to extract the most relevant information from this specific document.
                Return ONLY the reformulated query without any explanation or additional text."""
                
                user_prompt = f"""Original query: {original_query}
                
                Document information:
                Title: {document.title}
                Author: {document.author}
                Topics: {', '.join(document.topics) if document.topics else 'Not specified'}
                
                Sample content from document:
                {sample_content}
                
                Generate a specific query for this document that will help extract the most relevant information related to the original query."""
                
                # Use the API key if provided
                if api_key:
                    os.environ["OPENAI_API_KEY"] = api_key
                
                # Generate the document-specific query
                doc_specific_query = await generate_response(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=0.3,
                    max_tokens=100
                )
                
                # Clean up the response
                doc_specific_query = doc_specific_query.strip()
                
                # Add to results
                document_queries.append(doc_specific_query)
                logger.info(f"Generated query for document {doc_id}: {doc_specific_query}")
                
            except Exception as e:
                logger.error(f"Error generating query for document {doc_id}: {e}")
                document_queries.append(original_query)  # Use original query as fallback
                document_metadata.append(None)
        
        return {
            "original_query": original_query,
            "document_queries": document_queries,
            "document_metadata": document_metadata
        }
        
    except Exception as e:
        logger.error(f"Error generating document queries: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/combine_document_responses")
async def combine_document_responses(request: Request):
    """
    Combine responses from multiple documents into a unified response.
    
    This endpoint takes the original query and the responses from multiple documents,
    and generates a unified response that combines the information from all documents.
    """
    try:
        data = await request.json()
        original_query = data.get("original_query")
        document_responses = data.get("document_responses")
        api_key = data.get("api_key")
        
        if not original_query:
            raise HTTPException(status_code=400, detail="Original query is required")
        
        if not document_responses or not isinstance(document_responses, list) or len(document_responses) == 0:
            raise HTTPException(status_code=400, detail="At least one document response is required")
        
        logger.info(f"Combining responses from {len(document_responses)} documents")
        
        # Extract responses and contexts from each document
        combined_context = ""
        for i, doc_response in enumerate(document_responses):
            if not doc_response:
                continue
                
            response = doc_response.get("response", "")
            context = doc_response.get("context", "")
            
            # Add document information to the context
            combined_context += f"\n\n--- DOCUMENT {i+1} INFORMATION ---\n"
            combined_context += f"Response: {response}\n\n"
            combined_context += f"Context: {context}\n"
        
        # Generate a unified response using LLM
        system_prompt = """You are an expert document analysis system. Your task is to create a comprehensive response that combines information from multiple documents.
        
        Follow these guidelines:
        1. Synthesize information from all documents to provide a complete answer
        2. Highlight differences or contradictions between documents
        3. Cite the specific document when presenting information from it
        4. Organize the response in a logical structure
        5. Be concise but comprehensive"""
        
        user_prompt = f"""Original query: {original_query}
        
        Information from multiple documents:
        {combined_context}
        
        Please provide a comprehensive response that combines information from all documents to answer the original query."""
        
        # Use the API key if provided
        if api_key:
            os.environ["OPENAI_API_KEY"] = api_key
        
        # Generate the combined response
        combined_response = await generate_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.5,
            max_tokens=1500
        )
        
        return {
            "response": combined_response,
            "context": combined_context,
            "mode": "multi_document"
        }
        
    except Exception as e:
        logger.error(f"Error combining document responses: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query/stream")
async def query_document_stream(request: Request):
    """
    Streaming version of the query endpoint.
    """
    try:
        data = await request.json()
        query = data.get("query")
        document_id = data.get("document_id")
        chat_mode = data.get("chat_mode", "document")
        api_key = data.get("api_key")
        
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
        
        logger.info(f"Streaming query received: {query[:50]}... (mode: {chat_mode})")
        
        # Document chat mode with multi-layer retrieval
        if chat_mode == "document":
            if not document_id:
                raise HTTPException(status_code=400, detail="Document ID is required for document chat mode")
            
            # Handle both single document ID and list of document IDs
            if isinstance(document_id, list):
                if not document_id:  # Empty list
                    raise HTTPException(status_code=400, detail="At least one document ID is required")
                document_ids = document_id
                logger.info(f"Processing multiple documents: {len(document_ids)} documents")
            else:
                document_ids = [document_id]
                logger.info(f"Processing single document: {document_id}")
            
            # Use our document chat search function
            search_results = document_chat_search(query, document_ids)
            
            if "error" in search_results:
                raise HTTPException(status_code=500, detail=f"Search failed: {search_results['error']}")
            
            # Build enhanced context for document chat
            context = build_document_chat_context(
                search_results["results"], 
                query,
                search_results.get("documents_metadata"),
                search_results.get("entities_found")
            )
            
            # Set API key if provided
            if api_key:
                os.environ["OPENAI_API_KEY"] = api_key
            
            # Return streaming response
            return StreamingResponse(
                generate_document_chat_response(
                    context=context,
                    query=query,
                    stream=True
                ),
                media_type="text/plain"
            )
        
        # Other chat modes (search, advanced, general)
        # ... (implement other modes as needed)
        
        raise HTTPException(status_code=400, detail=f"Unsupported chat mode: {chat_mode}")
        
    except Exception as e:
        logger.error(f"Streaming query failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)