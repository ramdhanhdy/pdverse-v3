// File: app/api/python-backend/route.ts
import { NextRequest, NextResponse } from "next/server";

// Get Python backend URL from environment variable or use default
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

/**
 * Proxy requests to the Python backend
 */
export async function POST(request: NextRequest) {
  try {
    const endpoint = request.nextUrl.searchParams.get("endpoint") || "";
    const url = `${PYTHON_BACKEND_URL}/${endpoint}`;
    
    // Forward the request body
    const body = await request.text();
    
    // Forward the request to the Python backend
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
      },
      body,
    });
    
    // Get the response from the Python backend
    const data = await response.json();
    
    // Return the response
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying to Python backend:", error);
    return NextResponse.json(
      { error: "Failed to communicate with Python backend" },
      { status: 500 }
    );
  }
}

/**
 * Proxy GET requests to the Python backend
 */
export async function GET(request: NextRequest) {
  try {
    const endpoint = request.nextUrl.searchParams.get("endpoint") || "";
    
    // Build the URL with query parameters
    const url = new URL(`${PYTHON_BACKEND_URL}/${endpoint}`);
    
    // Copy all query parameters except 'endpoint'
    for (const [key, value] of Array.from(request.nextUrl.searchParams.entries())) {
      if (key !== 'endpoint') {
        url.searchParams.append(key, value);
      }
    }
    
    // Forward the request to the Python backend
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    // Get the response from the Python backend
    const data = await response.json();
    
    // Return the response
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying to Python backend:", error);
    return NextResponse.json(
      { error: "Failed to communicate with Python backend" },
      { status: 500 }
    );
  }
}

/**
 * Proxy DELETE requests to the Python backend
 */
export async function DELETE(request: NextRequest) {
  try {
    const endpoint = request.nextUrl.searchParams.get("endpoint") || "";
    const url = `${PYTHON_BACKEND_URL}/${endpoint}`;
    
    // Forward the request to the Python backend
    const response = await fetch(url, {
      method: 'DELETE',
    });
    
    // Get the response from the Python backend
    const data = await response.json();
    
    // Return the response
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying to Python backend:", error);
    return NextResponse.json(
      { error: "Failed to communicate with Python backend" },
      { status: 500 }
    );
  }
}