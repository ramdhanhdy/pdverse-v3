// File: lib/python-backend.ts
const API_ROUTE = '/api/python-backend';

/**
 * Upload a file to the Python backend
 */
export async function uploadFileToPythonBackend(
  file: File,
  metadata?: { title?: string; author?: string }
): Promise<{
  id: string;
  status: string;
  filename: string;
  title: string;
  page_count: number;
  chunk_count: number;
}> {
  const formData = new FormData();
  formData.append('file', file);
  
  if (metadata?.title) {
    formData.append('title', metadata.title);
  }
  
  if (metadata?.author) {
    formData.append('author', metadata.author);
  }
  
  const response = await fetch(`${API_ROUTE}?endpoint=upload_file`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to upload file to Python backend');
  }
  
  return await response.json();
}

/**
 * Search documents in the Python backend
 */
/**
 * Search documents in the Python backend
 */
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
  const response = await fetch('/api/search', {  // Changed from `${API_ROUTE}/search`
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      documentId: options?.document_id,  // Match /api/search expectation
      limit: options?.limit || 10,
      searchType: options?.search_type || 'hybrid',  // Match /api/search expectation
      // Note: vector_weight, text_weight, offset, and filters aren't supported by /api/search currently
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search documents in Python backend');
  }

  const data = await response.json();
  return {
    results: data.results,
    total: data.count,
    query: data.query,
  };
}
/**
 * Query documents with LLM in the Python backend
 */
// Add this function to pass the API key to the backend
export async function queryDocumentWithLLM(
  query: string,
  document_id?: string,
  chat_mode: string = 'document'
): Promise<{
  response: string;
  context: string;
  mode: string;
}> {
  // Get API key from localStorage
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem("openai_api_key") : null;
  
  const PYTHON_BACKEND_URL = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://localhost:8000';
  
  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        document_id,
        chat_mode,
        api_key: apiKey, // Pass the API key with the request
      }),
      // Add a timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to query document with LLM');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error querying document with LLM:", error);
    throw error;
  }
}

/**
 * List documents from the Python backend
 */
export async function listDocumentsFromPythonBackend(
  options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }
): Promise<{
  total: number;
  documents: {
    id: string;
    title: string;
    author: string;
    creation_date: string | null;
    page_count: number;
    file_size: number;
    document_type: string;
    filename: string;
  }[];
}> {
  const searchParams = new URLSearchParams();
  searchParams.append('endpoint', 'documents');
  
  if (options?.limit) {
    searchParams.append('limit', options.limit.toString());
  }
  
  if (options?.offset) {
    searchParams.append('offset', options.offset.toString());
  }
  
  if (options?.search) {
    searchParams.append('search', options.search);
  }
  const response = await fetch(`${API_ROUTE}?${searchParams.toString()}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to list documents from Python backend');
  }
  
  return await response.json();
}

/**
 * Get documents from the Python backend
 */
export async function getDocumentsFromPythonBackend(id?: string) {
  try {
    // Base URL for the Python backend API
    const baseUrl = "/api/python-backend";
    
    // If an ID is provided, get a specific document
    if (id) {
      const response = await fetch(`${baseUrl}?endpoint=documents/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }
      
      return await response.json();
    }
    
    // Otherwise, get all documents
    const response = await fetch(`${baseUrl}?endpoint=documents`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch documents: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error in Python backend utility:", error);
    throw error;
  }
}
  /**
   * Get document details from the Python backend
   */
  export async function getDocumentFromPythonBackend(
    document_id: string
  ): Promise<{
    id: string;
    title: string;
    author: string;
    creation_date: string | null;
    modification_date: string | null;
    page_count: number;
    file_size: number;
    document_type: string;
    filename: string;
    language: string;
    chunk_count: number;
    table_count: number;
    topics: string[];
  }> {
    const searchParams = new URLSearchParams();
    searchParams.append('endpoint', `document/${document_id}`);
    
    const response = await fetch(`${API_ROUTE}?${searchParams.toString()}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get document from Python backend');
    }
    
    return await response.json();
  }
  
  /**
   * Delete a document from the Python backend
   */
  export async function deleteDocumentFromPythonBackend(documentId: string) {
    const PYTHON_BACKEND_URL = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://localhost:8000';
    
    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/document/${documentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete document');
      }
      
      return true;
    } catch (error) {
      console.error("Error deleting document:", error);
      throw error;
    }
  }

export async function searchDocuments(query: string, searchType: string) {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ query, searchType })
  });
  return await response.json();
}