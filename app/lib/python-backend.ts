// lib/python-backend.ts
export async function searchDocumentsInPythonBackend(
  query: string,
  options?: {
    document_id?: string;
    limit?: number;
    offset?: number;
    search_type?: 'fulltext' | 'vector' | 'hybrid';
    vector_weight?: number;
    text_weight?: number;
    filters?: Record<string, any>;
  }
): Promise<{
  results: any[];
  total: number;
  query: string;
}> {
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        document_id: options?.document_id,
        limit: options?.limit || 10,
        offset: options?.offset || 0,
        search_type: options?.search_type || 'hybrid',
        vector_weight: options?.vector_weight || 0.65,
        text_weight: options?.text_weight || 0.35,
        filters: options?.filters || {},
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Search failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
      results: data.results || [],
      total: data.total || 0,
      query: data.query || query,
    };
  } catch (error) {
    console.error('Search operation failed:', error);
    throw error;
  }
}

export async function getDocumentsFromPythonBackend(id?: string) {
  try {
    const baseUrl = '/api/python-backend?endpoint=documents';
    const url = id ? `${baseUrl}/${id}` : baseUrl;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch documents: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }
}

export async function queryDocumentWithLLM(
  query: string,
  document_id?: string | string[],
  chat_mode: string = 'document',
  stream: boolean = false
): Promise<{
  response: string;
  context: string;
  mode: string;
  search_results?: any;
} | Response> {
  const PYTHON_BACKEND_URL = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://localhost:8000';

  console.log('queryDocumentWithLLM called with:', { 
    query, 
    document_id: Array.isArray(document_id) ? `${document_id.length} documents` : document_id, 
    chat_mode, 
    stream 
  });

  const response = await fetch(`${PYTHON_BACKEND_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      document_id,
      chat_mode, // Ensure this is snake_case for Python backend compatibility
      stream,    // Add streaming option
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to query document with LLM');
  }

  // If streaming is enabled, return the response directly
  if (stream) {
    console.log('Returning streaming response from Python backend for document mode');
    // Return the response with text/plain content type for compatibility with streamProtocol: 'text'
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  const result = await response.json();
  
  // Log the enhanced search results if available
  if (result.search_results && chat_mode === 'document') {
    console.log('Enhanced document chat search results:', {
      total: result.search_results.total,
      entities_found: result.search_results.entities_found,
      execution_time: result.search_results.execution_time,
      document_count: Array.isArray(result.search_results.document_ids) ? result.search_results.document_ids.length : 1
    });
  }
  
  return result;
}

export async function getDocumentFromPythonBackend(documentId: string) {
  try {
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    
    const response = await fetch(`${pythonBackendUrl}/document/${documentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch document: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('getDocumentFromPythonBackend error:', error);
    throw error;
  }
}

/**
 * General chat with the Python backend without document context
 * Uses server-side API key configuration
 */
export async function generalChat(
  messages: any[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  } = {}
): Promise<{
  response: string;
} | Response> {
  const PYTHON_BACKEND_URL = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://localhost:8000';
  const { model = 'gpt-4o', temperature = 0.7, maxTokens = 4096, stream = false } = options;

  console.log('generalChat called with:', { messages, model, temperature, maxTokens, stream });

  const response = await fetch(`${PYTHON_BACKEND_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      model,
      temperature,
      max_tokens: maxTokens,
      stream,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('General chat error:', error);
    throw new Error(error.detail || 'Failed to process general chat');
  }

  // If streaming is enabled, return the response directly
  if (stream) {
    console.log('Returning streaming response from Python backend');
    // Return the response with text/plain content type for compatibility with streamProtocol: 'text'
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // Otherwise, parse the JSON response
  const result = await response.json();
  console.log('generalChat response:', result); // Added debug log
  return result; // Should return { response: string }
}