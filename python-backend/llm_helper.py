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

async def generate_response(query, api_key=None):
    """Generate a response for general chat without document context."""
    prompt = f"""Please answer the following question to the best of your ability:

Question: {query}

Answer:"""
    
    return await query_llm(prompt, api_key)

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

def build_document_chat_context(chunks, query, document_metadata=None):
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
        document_metadata: Additional document metadata
        
    Returns:
        A formatted context string for the LLM
    """
    if not chunks:
        return "No relevant information found in the document."
    
    # Start with document overview
    context = "# Document Overview\n"
    
    # Add document metadata if available
    if document_metadata:
        title = document_metadata.get('title', 'Untitled Document')
        author = document_metadata.get('author', 'Unknown Author')
        doc_type = document_metadata.get('document_type', 'Document')
        page_count = document_metadata.get('page_count', 'Unknown')
        topics = document_metadata.get('topics', [])
        
        context += f"Title: {title}\n"
        context += f"Author: {author}\n"
        context += f"Type: {doc_type}\n"
        context += f"Pages: {page_count}\n"
        
        if topics:
            context += f"Topics: {', '.join(topics)}\n"
        
        context += "\n"
    
    # Add entity information if available
    entities_found = document_metadata.get('entities_found', []) if document_metadata else []
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
        
        # Format the chunk header
        context += f"## Section {i+1}: {section_info} (Page {page_number}, {content_type_label})\n"
        
        # Add the content
        context += f"{content}\n\n"
        
        # Add relevance information (optional - can be removed in production)
        # context += f"Relevance: Semantic: {semantic_score:.2f}, Entity: {entity_score:.2f}, Structural: {structural_score:.2f}\n\n"
    
    return context

async def generate_document_chat_response(query, context, document_metadata=None, api_key=None):
    """
    Generate a response specifically for document chat mode with enhanced context.
    
    Args:
        query: The user's query
        context: The enhanced document context from build_document_chat_context
        document_metadata: Additional document metadata
        api_key: Optional API key
        
    Returns:
        The LLM response
    """
    # Create document-specific system prompt
    title = document_metadata.get('title', 'the document') if document_metadata else 'the document'
    
    system_prompt = f"""You are an AI assistant specialized in answering questions about documents.
You are currently helping with questions about the document titled "{title}".
Answer the user's question based ONLY on the information provided in the context below.
If the answer cannot be found in the context, acknowledge this limitation and suggest what information might be needed.
Provide specific page numbers and section references when possible to help the user locate information in the document.
"""

    # Combine system prompt with context and query
    prompt = f"""{system_prompt}

Context:
{context}

Question: {query}

Answer:"""
    
    return await query_llm(prompt, api_key)