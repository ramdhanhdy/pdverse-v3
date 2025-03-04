import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getDocumentFromPythonBackend } from "@/lib/python-backend";

// Path to the Python backend uploads directory
const PYTHON_BACKEND_UPLOADS_DIR = path.join(process.cwd(), "python-backend", "uploads");

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the document ID from the URL
    const id = params.id;
    
    try {
      // Try to get the document from the Python backend
      const document = await getDocumentFromPythonBackend(id);
      
      if (!document) {
        return new NextResponse("File not found", { status: 404 });
      }
      
      // Verify file exists on disk in the Python backend uploads directory
      const filename = document.filename;
      const filePath = path.join(PYTHON_BACKEND_UPLOADS_DIR, filename);
      
      console.log(`Looking for file at: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`File not found on disk: ${filePath}`);
        return new NextResponse("File not found on disk", { status: 404 });
      }
      
      // Get file stats
      const stats = await fs.promises.stat(filePath);
      
      // Serve the raw PDF file
      const fileStream = fs.createReadStream(filePath);
      
      return new NextResponse(fileStream as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": stats.size.toString(),
          "Content-Disposition": `inline; filename="${encodeURIComponent(document.title || filename)}"`,
          "Cache-Control": "public, max-age=86400", // Cache for 24 hours
        },
      });
    } catch (backendError) {
      console.error("Error fetching document from Python backend:", backendError);
      
      // Fall back to direct file access if Python backend fails
      const filePath = path.join(PYTHON_BACKEND_UPLOADS_DIR, id);
      
      console.log(`Fallback: Looking for file at: ${filePath}`);
      
      if (fs.existsSync(filePath)) {
        const stats = await fs.promises.stat(filePath);
        const fileStream = fs.createReadStream(filePath);
        
        return new NextResponse(fileStream as any, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": stats.size.toString(),
            "Content-Disposition": `inline; filename="${id}"`,
            "Cache-Control": "public, max-age=86400",
          },
        });
      } else {
        console.error(`Fallback file not found: ${filePath}`);
        return new NextResponse("File not found", { status: 404 });
      }
    }
  } catch (error) {
    console.error("Error serving PDF file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 