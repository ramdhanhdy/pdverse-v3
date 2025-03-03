# llm_helper.py
import aiohttp
import json
from config import CONFIG, logger

async def query_llm(prompt, api_key=None):
    """Query the LLM with a prompt and return the response."""
    try:
        # Use provided API key or fall back to config
        key_to_use = api_key or CONFIG.get('OPENAI_API_KEY') or CONFIG.get('LLM_API_KEY')
        
        if not key_to_use or key_to_use in ["", "your-llm-key"]:
            logger.warning("No valid API key provided for LLM query")
            return "Error: No valid API key provided. Please configure your API key in settings."
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key_to_use}"
        }
        
        payload = {
            "model": "gpt-4o",  # Updated to use GPT-4o by default
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that answers questions about PDF documents."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        }
        
        logger.info(f"Sending request to OpenAI API with prompt length: {len(prompt)}")
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post("https://api.openai.com/v1/chat/completions", 
                                       headers=headers, 
                                       json=payload,
                                       timeout=60) as response:  # Increased timeout
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"OpenAI API error: Status {response.status}, {error_text}")
                        return f"I'm sorry, I couldn't process your request due to an API error (Status {response.status})."
                    
                    data = await response.json()
                    return data["choices"][0]["message"]["content"]
            except aiohttp.ClientError as ce:
                logger.error(f"Connection error with OpenAI API: {ce}")
                return "I'm sorry, I encountered a connection error while processing your request. Please try again later."
    except Exception as e:
        logger.error(f"Error querying OpenAI: {e}")
        logger.error(traceback.format_exc())
        return "I'm sorry, I encountered an error while processing your request."

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

# Add the missing functions referenced in query_document

# Update these functions to accept api_key parameter

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