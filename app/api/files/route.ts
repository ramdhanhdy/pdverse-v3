import { NextRequest, NextResponse } from "next/server";
import { getDocumentsFromPythonBackend } from "@/lib/python-backend";

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (id) {
      try {
        // Use proper Python backend endpoint
        const response = await fetch(
          `${PYTHON_BACKEND_URL}/document/${id}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const document = await response.json();
        return NextResponse.json(document);
      } catch (error) {
        console.error("Error fetching file:", error);
        return NextResponse.json(
          { error: "File not found or backend error" },
          { status: 404 }
        );
      }
    }
    
    // Get all files from Python backend
    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/documents`);
      if (!response.ok) throw new Error("Failed to fetch documents");
      const documents = await response.json();
      return NextResponse.json({ files: documents });
    } catch (error) {
      console.error("Error fetching files from Python backend:", error);
      return NextResponse.json(
        { error: "Failed to fetch files from Python backend" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in files API route:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const deleteResponse = await fetch(`${PYTHON_BACKEND_URL}/document/${id}`, {
      method: 'DELETE'
    });

    if (!deleteResponse.ok) {
      const error = await deleteResponse.json();
      throw new Error(error.detail || 'Failed to delete document');
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Deletion failed" },
      { status: 500 }
    );
  }
}
