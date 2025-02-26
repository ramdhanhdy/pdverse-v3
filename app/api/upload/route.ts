import { NextRequest, NextResponse } from "next/server";
import { createFile, savePdfMetadata, FileRecord } from "@/lib/db";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { isValidPdf } from "@/lib/utils";
import { PDFDocument } from 'pdf-lib';

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

    // Save file metadata to database without waiting for PDF extraction
    const savedFile = createFile({
      filename,
      originalFilename: file.name,
      size: file.size,
      path: `/api/uploads/${filename}`,
      mimetype: file.type,
    }) as FileRecord;

    // Attempt to extract PDF metadata using pdf-lib
    try {
      console.log("Attempting to extract PDF metadata with pdf-lib...");
      
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(buffer);
      
      // Get basic info
      const pageCount = pdfDoc.getPageCount();
      console.log(`PDF has ${pageCount} pages`);
      
      // Get the document info dictionary if available
      const info = pdfDoc.getTitle() || pdfDoc.getAuthor() || pdfDoc.getSubject() || 
                  pdfDoc.getKeywords() || pdfDoc.getCreator() || pdfDoc.getProducer() ? {
        Title: pdfDoc.getTitle(),
        Author: pdfDoc.getAuthor(),
        Subject: pdfDoc.getSubject(),
        Keywords: pdfDoc.getKeywords(),
        Creator: pdfDoc.getCreator(),
        Producer: pdfDoc.getProducer(),
      } : null;
      
      console.log("PDF metadata extracted:", info);
      
      // Save PDF metadata to database
      savePdfMetadata({
        fileId: savedFile.id,
        title: info?.Title || undefined,
        author: info?.Author || undefined,
        subject: info?.Subject || undefined,
        keywords: info?.Keywords || undefined,
        creator: info?.Creator || undefined,
        producer: info?.Producer || undefined,
        pageCount: pageCount || 0,
      });
      
      console.log("Successfully extracted and saved PDF metadata");
    } catch (metadataError) {
      console.error("Error extracting PDF metadata:", metadataError);
      
      // Save minimal metadata with just the file ID
      try {
        savePdfMetadata({
          fileId: savedFile.id,
          pageCount: 0  // Unknown page count due to extraction failure
        });
        console.log("Saved minimal metadata after extraction failure");
      } catch (saveError) {
        console.error("Error saving minimal metadata:", saveError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      file: savedFile 
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
