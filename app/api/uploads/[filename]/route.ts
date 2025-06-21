import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    console.log(`Serving file: ${filename}`);
    
    // Prevent path traversal attacks
    if (filename.includes('..')) {
      console.error(`Path traversal attempt detected: ${filename}`);
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }
    
    const filePath = path.join(process.cwd(), "uploads", filename);
    console.log(`Full file path: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }
    
    // Check if file is readable
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      console.log(`File is readable: ${filePath}`);
    } catch (err) {
      console.error(`File is not readable: ${filePath}`, err);
      return NextResponse.json(
        { error: "File cannot be read" },
        { status: 403 }
      );
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    console.log(`File size: ${stats.size} bytes`);
    
    // Read file content
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log(`Successfully serving file: ${filename} (${fileBuffer.length} bytes)`);
    
    // Return file with proper content type
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}
