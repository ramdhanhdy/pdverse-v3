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

export async function queryDocumentWithLLM(query: string, documentId: string, chatMode: string) {
  try {
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    const apiKey = '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'; // From your working curl
    
    const response = await fetch(`${pythonBackendUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        document_id: documentId,
        chat_mode: chatMode,
        api_key: apiKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('queryDocumentWithLLM error:', errorText);
      throw new Error(`Failed to query document: ${errorText}`);
    }

    const result = await response.json();
    console.log('queryDocumentWithLLM response:', result);
    return result;
  } catch (error) {
    console.error('queryDocumentWithLLM failed:', error);
    throw error;
  }
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