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
    
    # Get document info from the first chunk
    document_info = {}
    if chunks and isinstance(chunks[0], dict):
        # Try to get document info from the first chunk
        if 'document_info' in chunks[0]:
            document_info = chunks[0]['document_info']
        
        # If we have a document title, use it
        document_title = chunks[0].get('document_title', 
                         chunks[0].get('document_info', {}).get('title', 'Document'))
        
        # Format document info
        doc_info_str = f"Document Title: {document_title}\n"
        if document_info.get('author'):
            doc_info_str += f"Author: {document_info.get('author')}\n"
        if document_info.get('document_type'):
            doc_info_str += f"Document Type: {document_info.get('document_type')}\n"
    else:
        doc_info_str = "Document information not available.\n"
    
    # Format chunks into a context string
    context = f"Here is information about the document:\n\n{doc_info_str}\n"
    context += "Relevant sections from the document:\n\n"
    
    for i, chunk in enumerate(chunks):
        content = chunk.get("content", "")
        document_title = chunk.get("document_title", chunk.get('document_info', {}).get('title', "Document"))
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
    """Generate a response with document context."""
    # Check if this is a document overview question
    overview_patterns = [
        "what is this document about", 
        "what is this file about", 
        "what's this document about",
        "what's this file about",
        "summarize this document",
        "summarize this file",
        "give me an overview",
        "tell me about this document",
        "tell me about this file"
    ]
    
    is_overview_question = any(pattern in query.lower() for pattern in overview_patterns)
    
    if is_overview_question:
        system_prompt = """You are a helpful assistant that provides information about documents.
When asked about what a document is about, provide a comprehensive overview based on the document information and content provided.
Focus on explaining the main topics, purpose, and key information from the document.
If the document appears to be a specific type (report, analysis, etc.), mention that in your response.
"""
    else:
        system_prompt = """You are a helpful assistant that answers questions based on document content.
Use the provided document context to answer the user's question accurately and thoroughly.
If the answer is not in the provided context, say so clearly rather than making up information.
"""
    
    prompt = f"{system_prompt}\n\nContext:\n{context}\n\nQuestion: {query}\n\nAnswer:"
    
    try:
        response = await query_llm(prompt, api_key)
        return response
    except Exception as e:
        print(f"Error generating response with context: {e}")
        return "I'm sorry, I encountered an error while generating a response based on the document."

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