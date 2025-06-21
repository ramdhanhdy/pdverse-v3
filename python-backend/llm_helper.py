# llm_helper.py
import aiohttp
import json
from config import CONFIG, logger

async def query_llm(prompt, api_key=None):
    """Query the LLM with a prompt and return the response."""
    try:
        # Get API key from parameter or environment config
        key_to_use = api_key or CONFIG.get('OPENAI_API_KEY')
        logger.info(f"Using API key: {key_to_use[:8]}...")  # Log the key being used
        
        # Validate API key format
        if not key_to_use or not key_to_use.startswith('sk-'):
            logger.error("Invalid or missing OpenAI API key")
            raise ValueError("Invalid API key format or missing key")
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key_to_use}"
        }
        
        payload = {
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that answers questions about PDF documents."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=60
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"OpenAI API error: {error_text}")
                    raise ValueError(f"API request failed: {error_text}")
                
                data = await response.json()
                return data["choices"][0]["message"]["content"]
                
    except Exception as e:
        logger.error(f"Error in query_llm: {str(e)}")
        raise

def build_context(chunks, query):
    """Build context from document chunks for the LLM."""
    if not chunks:
        return "No relevant information found in the document."
    
    # Format chunks into a context string
    context = "Here are the relevant sections from the document:\n\n"
    
    for i, chunk in enumerate(chunks):
        content = chunk.get("content", "")
        document_title = chunk.get("document_title", "Document")
        page_number = chunk.get("page_number", "Unknown")
        
        context += f"[Section {i+1} from {document_title}, Page {page_number}]\n{content}\n\n"
    
    return context

async def generate_response_from_messages(messages, api_key=None):
  """Generate a response based on a conversation history."""
  prompt = "You are a helpful assistant. Answer based on the conversation:\n\n"
  for msg in messages:
    prompt += f"{msg['role'].capitalize()}: {msg['content']}\n"
  prompt += "\nAssistant:"
  return await query_llm(prompt, api_key)

async def generate_response_with_context(query, context, api_key=None):
    """Generate a response using the LLM with document context."""
    prompt = f"""Please answer the following question based on the provided document context. 
If the answer cannot be found in the context, please say so.

Context:
{context}

Question: {query}

Answer:"""
    
    return await query_llm(prompt, api_key)

async def generate_response(system_prompt=None, user_prompt=None, query=None, api_key=None, temperature=0.7, max_tokens=1000, stream=False):
    """
    Generate a response using the LLM.
    
    Args:
        system_prompt: The system prompt to use
        user_prompt: The user prompt to use
        query: The query to use (legacy parameter, use user_prompt instead)
        api_key: Optional API key
        temperature: Temperature for response generation
        max_tokens: Maximum tokens for the response
        stream: Whether to stream the response
        
    Returns:
        The LLM response or a streaming response
    """
    # Handle legacy parameter
    if query and not user_prompt:
        user_prompt = f"""Please answer the following question to the best of your ability:

Question: {query}

Answer:"""
    
    # Use default system prompt if not provided
    if not system_prompt:
        system_prompt = "You are a helpful assistant that provides accurate and informative responses."
    
    # Use the provided prompts directly with the LLM
    if stream:
        return stream_llm_response_with_prompts(system_prompt, user_prompt, api_key, temperature, max_tokens)
    else:
        return await query_llm_with_prompts(system_prompt, user_prompt, api_key, temperature, max_tokens)

async def query_llm_with_prompts(system_prompt, user_prompt, api_key=None, temperature=0.7, max_tokens=1000):
    """Query the LLM with system and user prompts and return the response."""
    try:
        # Get API key from parameter or environment config
        key_to_use = api_key or CONFIG.get('OPENAI_API_KEY')
        logger.info(f"Using API key: {key_to_use[:8]}...")
        
        # Validate API key format
        if not key_to_use or not key_to_use.startswith('sk-'):
            logger.error("Invalid or missing OpenAI API key")
            raise ValueError("Invalid API key format or missing key")
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key_to_use}"
        }
        
        payload = {
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=60
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"OpenAI API error: {error_text}")
                    raise ValueError(f"API request failed: {error_text}")
                
                data = await response.json()
                return data["choices"][0]["message"]["content"]
                
    except Exception as e:
        logger.error(f"Error in query_llm_with_prompts: {str(e)}")
        raise

async def stream_llm_response_with_prompts(system_prompt, user_prompt, api_key=None, temperature=0.7, max_tokens=1000):
    """
    Stream the LLM response for given system and user prompts.
    
    Args:
        system_prompt: The system prompt
        user_prompt: The user prompt
        api_key: Optional API key
        temperature: Temperature for response generation
        max_tokens: Maximum tokens for the response
        
    Yields:
        Chunks of the LLM response as they are generated
    """
    try:
        # Get API key from parameter or environment config
        key_to_use = api_key or CONFIG.get('OPENAI_API_KEY')
        logger.info(f"Using API key for streaming: {key_to_use[:8]}...")
        
        # Validate API key format
        if not key_to_use or not key_to_use.startswith('sk-'):
            logger.error("Invalid or missing OpenAI API key for streaming")
            raise ValueError("Invalid API key format or missing key")
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key_to_use}"
        }
        
        payload = {
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=120
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"OpenAI API streaming error: {error_text}")
                        raise ValueError(f"API streaming request failed: {error_text}")
                    
                    # Process the streaming response
                    async for line in response.content:
                        line = line.decode('utf-8').strip()
                        if line:
                            # Skip empty lines and "data: [DONE]"
                            if line == "data: [DONE]":
                                break
                            
                            # Remove "data: " prefix if present
                            if line.startswith("data: "):
                                line = line[6:]
                            
                            try:
                                # Parse JSON data
                                data = json.loads(line)
                                
                                # Extract content delta if available
                                if "choices" in data and len(data["choices"]) > 0:
                                    choice = data["choices"][0]
                                    if "delta" in choice and "content" in choice["delta"]:
                                        content = choice["delta"]["content"]
                                        yield content
                            except json.JSONDecodeError:
                                # Skip lines that aren't valid JSON
                                continue
            except Exception as e:
                logger.error(f"Error in session.post: {str(e)}")
                yield f"Error in API request: {str(e)}"
                
    except Exception as e:
        logger.error(f"Error in stream_llm_response_with_prompts: {str(e)}")
        yield f"Error generating response: {str(e)}"

async def generate_advanced_analysis(query, context, api_key=None):
    """Generate an advanced analysis of document content."""
    prompt = f"""Please provide a detailed analysis of the document based on the following question.
Include key insights, patterns, and relevant information from the document context.

Context:
{context}

Question for analysis: {query}

Detailed Analysis:"""
    
    return await query_llm(prompt, api_key)

def format_search_results(chunks, query):
    """Format search results for display in the chat."""
    if not chunks:
        return "No results found for your query."
    
    response = f"### Search Results for: '{query}'\n\n"
    
    for i, chunk in enumerate(chunks):
        content = chunk.get("content", "")
        document_title = chunk.get("document_title", "Document")
        page_number = chunk.get("page_number", "Unknown")
        score = chunk.get("score", 0)
        
        # Truncate content if it's too long
        if len(content) > 300:
            content = content[:300] + "..."
        
        response += f"**Result {i+1}** (from {document_title}, Page {page_number})\n"
        response += f"{content}\n\n"
    
    response += f"Found {len(chunks)} results. Ask follow-up questions to learn more about specific results."
    
    return response

def build_document_chat_context(chunks, query, documents_metadata=None, entities_found=None):
    """
    Build an enhanced context for document chat mode using the multi-layer retrieval results.
    
    This function creates a rich context that includes:
    1. Document metadata and overview
    2. Relevant chunks with their structural context
    3. Entity information and relationships
    4. Contextual importance indicators
    
    Args:
        chunks: Results from document_chat_search
        query: The user's query
        documents_metadata: List of metadata for all documents
        entities_found: List of entities found in the query
        
    Returns:
        A formatted context string for the LLM
    """
    if not chunks:
        return "No relevant information found in the document(s)."
    
    # Start with document overview
    context = "# Documents Overview\n"
    
    # Add document metadata if available
    if documents_metadata:
        # Group chunks by document to understand which documents are most relevant
        document_chunks = {}
        for chunk in chunks:
            doc_id = chunk.get("document_id")
            if doc_id not in document_chunks:
                document_chunks[doc_id] = []
            document_chunks[doc_id].append(chunk)
        
        # Sort documents by number of relevant chunks (most relevant first)
        sorted_doc_ids = sorted(document_chunks.keys(), key=lambda x: len(document_chunks[x]), reverse=True)
        
        # Add metadata for each document
        for doc_id in sorted_doc_ids:
            doc_meta = next((doc for doc in documents_metadata if doc.get("id") == doc_id), None)
            if not doc_meta:
                continue
                
            title = doc_meta.get('title', 'Untitled Document')
            author = doc_meta.get('author', 'Unknown Author')
            doc_type = doc_meta.get('document_type', 'Document')
            page_count = doc_meta.get('page_count', 'Unknown')
            topics = doc_meta.get('topics', [])
            
            context += f"## {title}\n"
            context += f"Author: {author}\n"
            context += f"Type: {doc_type}\n"
            context += f"Pages: {page_count}\n"
            
            if topics:
                context += f"Topics: {', '.join(topics)}\n"
            
            context += f"Relevant chunks: {len(document_chunks[doc_id])}\n\n"
    
    # Add entity information if available
    if entities_found:
        context += "# Relevant Entities\n"
        for entity in entities_found:
            context += f"- {entity}\n"
        context += "\n"
    
    # Format chunks into a context string with structural information
    context += "# Relevant Document Sections\n\n"
    
    for i, chunk in enumerate(chunks):
        content = chunk.get("content", "")
        page_number = chunk.get("page_number", "Unknown")
        section_path = chunk.get("section_path", [])
        content_type = chunk.get("content_type", "text")
        
        # Get document info
        doc_info = chunk.get("document_info", {})
        doc_title = doc_info.get("title", "Unknown Document")
        
        # Format section path for better context
        section_info = " > ".join(section_path) if section_path else "Main Content"
        
        # Add structural indicators
        if content_type == "table":
            content_type_label = "TABLE"
        elif content_type == "figure":
            content_type_label = "FIGURE"
        elif content_type == "list":
            content_type_label = "LIST"
        else:
            content_type_label = "TEXT"
        
        # Add relevance scores for debugging/transparency
        semantic_score = chunk.get("semantic_similarity", 0)
        entity_score = chunk.get("entity_relevance", 0)
        structural_score = chunk.get("structural_relevance", 0)
        
        # Format the chunk header with document title
        context += f"## Section {i+1}: {doc_title} - {section_info} (Page {page_number}, {content_type_label})\n"
        
        # Add the content
        context += f"{content}\n\n"
        
        # Add relevance information (optional - can be removed in production)
        # context += f"Relevance: Semantic: {semantic_score:.2f}, Entity: {entity_score:.2f}, Structural: {structural_score:.2f}\n\n"
    
    return context

async def generate_document_chat_response(context, query, documents_metadata=None, api_key=None, stream=False):
    """
    Generate a response specifically for document chat mode with enhanced context.
    
    Args:
        context: The enhanced document context from build_document_chat_context
        query: The user's query
        documents_metadata: Metadata for all documents
        api_key: Optional API key
        stream: Whether to stream the response
        
    Returns:
        The LLM response or a streaming response
    """
    # Create document-specific system prompt
    if documents_metadata and len(documents_metadata) > 0:
        # Multiple documents
        if len(documents_metadata) > 1:
            doc_titles = [doc.get('title', 'Untitled') for doc in documents_metadata]
            titles_str = ", ".join(doc_titles[:-1]) + " and " + doc_titles[-1] if len(doc_titles) > 1 else doc_titles[0]
            system_prompt = f"""You are an AI assistant specialized in answering questions about documents.
You are currently helping with questions about multiple documents: {titles_str}.
Answer the user's question based ONLY on the information provided in the context below.
If the answer cannot be found in the context, acknowledge this limitation and suggest what information might be needed.
Provide specific document titles, page numbers, and section references when possible to help the user locate information.
"""
        # Single document
        else:
            title = documents_metadata[0].get('title', 'the document')
            system_prompt = f"""You are an AI assistant specialized in answering questions about documents.
You are currently helping with questions about the document titled "{title}".
Answer the user's question based ONLY on the information provided in the context below.
If the answer cannot be found in the context, acknowledge this limitation and suggest what information might be needed.
Provide specific page numbers and section references when possible to help the user locate information in the document.
"""
    else:
        # Generic prompt if no metadata
        system_prompt = """You are an AI assistant specialized in answering questions about documents.
Answer the user's question based ONLY on the information provided in the context below.
If the answer cannot be found in the context, acknowledge this limitation and suggest what information might be needed.
Provide specific document titles, page numbers, and section references when possible to help the user locate information.
"""

    # Combine system prompt with context and query
    prompt = f"""{system_prompt}

Context:
{context}

Question: {query}

Answer:"""
    
    if stream:
        return stream_llm_response(prompt, api_key)
    else:
        return await query_llm(prompt, api_key)

async def stream_llm_response(prompt, api_key=None):
    """
    Stream the LLM response for a given prompt.
    
    Args:
        prompt: The prompt to send to the LLM
        api_key: Optional API key
        
    Yields:
        Chunks of the LLM response as they are generated
    """
    try:
        # Get API key from parameter or environment config
        key_to_use = api_key or CONFIG.get('OPENAI_API_KEY')
        logger.info(f"Using API key for streaming: {key_to_use[:8]}...")
        
        # Validate API key format
        if not key_to_use or not key_to_use.startswith('sk-'):
            logger.error("Invalid or missing OpenAI API key for streaming")
            raise ValueError("Invalid API key format or missing key")
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key_to_use}"
        }
        
        payload = {
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that answers questions about PDF documents."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1500,
            "stream": True
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=120
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"OpenAI API streaming error: {error_text}")
                        raise ValueError(f"API streaming request failed: {error_text}")
                    
                    # Process the streaming response
                    async for line in response.content:
                        line = line.decode('utf-8').strip()
                        if line:
                            # Skip empty lines and "data: [DONE]"
                            if line == "data: [DONE]":
                                break
                            
                            # Remove "data: " prefix if present
                            if line.startswith("data: "):
                                line = line[6:]
                            
                            try:
                                # Parse JSON data
                                data = json.loads(line)
                                
                                # Extract content delta if available
                                if "choices" in data and len(data["choices"]) > 0:
                                    choice = data["choices"][0]
                                    if "delta" in choice and "content" in choice["delta"]:
                                        content = choice["delta"]["content"]
                                        yield content
                            except json.JSONDecodeError:
                                # Skip lines that aren't valid JSON
                                continue
            except Exception as e:
                logger.error(f"Error in session.post: {str(e)}")
                yield f"Error in API request: {str(e)}"
                
    except Exception as e:
        logger.error(f"Error in stream_llm_response: {str(e)}")
        yield f"Error generating response: {str(e)}"