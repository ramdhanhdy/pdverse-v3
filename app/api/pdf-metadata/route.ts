import { NextRequest, NextResponse } from "next/server";
import { getDocumentFromPythonBackend } from "@/lib/python-backend";
import { getFileById } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }
    
    // Bypass SQLite check and use direct Python backend ID
    const pythonBackendId = fileId; // Now using fileId directly as pythonBackendId
    
    try {
      // Get the metadata from the Python backend
      // We need to get the Python backend document ID from the file record
      // This should be stored in the file record's metadata field
      const metadata = await getDocumentFromPythonBackend(pythonBackendId);
      
      return NextResponse.json({ metadata });
    } catch (backendError) {
      console.error("Error fetching metadata from Python backend:", backendError);
      return NextResponse.json(
        { error: "Failed to fetch metadata from Python backend" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error fetching PDF metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch PDF metadata" },
      { status: 500 }
    );
  }
}
