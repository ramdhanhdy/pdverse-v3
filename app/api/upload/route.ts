import { NextRequest, NextResponse } from "next/server";
import { createFile, savePdfMetadata, FileRecord } from "@/lib/db";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { isValidPdf } from "@/lib/utils";
import { PDFDocument } from 'pdf-lib';

// Import the new processor
import { processPdf } from '@/lib/pdf/processor';
import { addEnhancedMetadataFields } from '../../../lib/db/migrations/add_enhanced_metadata';

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file is a PDF
    if (!isValidPdf(file)) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Create a unique filename
    const uniqueId = uuidv4();
    const fileExtension = path.extname(file.name);
    const filename = `${uniqueId}${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    // Convert file to ArrayBuffer
    const buffer = await file.arrayBuffer();
    
    // Write file to disk
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // Ensure the database has the required fields
    addEnhancedMetadataFields();
    
    // Save file metadata to database
    const savedFile = createFile({
      filename,
      originalFilename: file.name,
      size: file.size,
      path: `/api/uploads/${filename}`,
      mimetype: file.type,
    }) as FileRecord;
    
    // Process the PDF with our new processor
    try {
      console.log(`Starting PDF processing for file: ${savedFile.id}`);
      const metadata = await processPdf(savedFile.id, filePath);
      console.log(`PDF processing completed successfully for file: ${savedFile.id}`);
      
      return NextResponse.json({ 
        success: true, 
        file: savedFile,
        metadata: {
          title: metadata.title || file.name,
          author: metadata.author,
          pageCount: metadata.pageCount,
          summary: metadata.summary,
          documentType: metadata.documentType,
          topics: metadata.topics,
          aiEnhanced: metadata.aiEnhanced,
          needsReview: metadata.needsReview
        }
      });
    } catch (processingError) {
      console.error('Error in PDF processing:', processingError);
      
      // Still return success since the file was uploaded, but indicate processing error
      return NextResponse.json({ 
        success: true, 
        file: savedFile,
        processingError: 'Failed to extract metadata from PDF. The file was uploaded successfully, but metadata extraction failed.'
      });
    }
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
