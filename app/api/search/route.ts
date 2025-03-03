import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const { 
      query, 
      documentId, 
      limit = 10, 
      offset = 0, 
      searchType = 'hybrid',
      vectorWeight = 0.65,
      textWeight = 0.35,
      filters = {},
    } = await request.json();

    logger.debug(`Received query: '${query}'`);
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: "Invalid query: must be a non-empty string" }, { status: 400 });
    }

    // Generate vector embedding for the query
    const vectorResponse = await fetch(`${PYTHON_BACKEND_URL}/embed`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ text: query }),
    });
    const vectorQuery = await vectorResponse.json().then(data => data.embedding);

    const response = await fetch(`${PYTHON_BACKEND_URL}/search`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        query,
        document_id: documentId,
        limit,
        offset,
        search_type: searchType,
        vector_query: vectorQuery,
        vector_weight: vectorWeight,
        text_weight: textWeight,
        filters,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Search failed');
    }

    const { results, total } = await response.json();
    return NextResponse.json({ 
      query,
      results: results.map((r: any) => ({
        ...r,
        score: r.score,
        content: r.content,
      })),
      count: total,
    });
  } catch (error) {
    console.error("Error searching documents:", error);
    return NextResponse.json({ error: "Failed to search documents" }, { status: 500 });
  }
}