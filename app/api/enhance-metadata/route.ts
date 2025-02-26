import { NextRequest, NextResponse } from "next/server";
import { getPdfMetadata, savePdfMetadata, getFileById } from "@/lib/db";
import { enhanceMetadataWithGemini } from "@/lib/ai/gemini";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    console.log("Enhance metadata API called");
    const data = await request.json();
    const { fileId } = data;
    console.log("File ID:", fileId);

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    // Get current metadata
    const metadata = getPdfMetadata(fileId);
    console.log("Retrieved metadata:", metadata ? "Found" : "Not found");
    if (!metadata) {
      return NextResponse.json(
        { error: "Metadata not found for this file" },
        { status: 404 }
      );
    }

    // Get the file record to get the actual filename
    const fileRecord = getFileById(fileId);
    console.log("File record:", fileRecord ? "Found" : "Not found", fileRecord);
    if (!fileRecord) {
      return NextResponse.json(
        { error: "File record not found" },
        { status: 404 }
      );
    }

    // Get file path to extract text
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, fileRecord.filename);
    console.log("File path:", filePath);

    if (!fs.existsSync(filePath)) {
      console.log("PDF file not found at path:", filePath);
      return NextResponse.json(
        { error: "PDF file not found" },
        { status: 404 }
      );
    }

    // Read file content
    const fileBuffer = fs.readFileSync(filePath);
    const fileData = new Uint8Array(fileBuffer);

    // Extract text from PDF
    const { extractPdfMetadata } = await import("@/lib/pdf/mupdf-parser.mjs");
    console.log("Extracting PDF text...");
    const extractionResult = await extractPdfMetadata(filePath);
    console.log("Text extraction complete, text length:", extractionResult.fullText.length);
    const { fullText } = extractionResult;

    // Convert DB metadata to the format expected by enhanceMetadataWithGemini
    const metadataForEnhancement = {
      title: metadata.title || "",
      author: metadata.author || "",
      subject: metadata.subject || "",
      keywords: metadata.keywords || "",
      creator: metadata.creator || "",
      producer: metadata.producer || "",
      pageCount: metadata.page_count || 0,
      creationDate: metadata.creation_date || "",
      modificationDate: metadata.modification_date || "",
      summary: metadata.summary || "",
      documentType: metadata.document_type || "",
      topics: metadata.topics ? metadata.topics.split(",").map(t => t.trim()) : [],
      aiEnhanced: Boolean(metadata.ai_enhanced),
      needsReview: Boolean(metadata.needs_review)
    };

    // Enhance metadata with Gemini
    console.log("Calling Gemini API...");
    const enhancedMetadata = await enhanceMetadataWithGemini(
      metadataForEnhancement,
      fullText,
      filePath
    );
    console.log("Gemini API response received");
    console.log("Enhanced metadata from Gemini:", JSON.stringify(enhancedMetadata, null, 2));

    // Save enhanced metadata back to database
    console.log("Saving enhanced metadata to database");
    
    // Ensure all values are of the correct type for SQLite
    const sanitizedMetadata = {
      fileId,
      title: String(enhancedMetadata.title || ''),
      author: String(enhancedMetadata.author || ''),
      subject: String(enhancedMetadata.subject || ''),
      keywords: String(enhancedMetadata.keywords || ''),
      creator: String(enhancedMetadata.creator || ''),
      producer: String(enhancedMetadata.producer || ''),
      pageCount: Number(enhancedMetadata.pageCount || 0),
      creationDate: String(enhancedMetadata.creationDate || ''),
      modificationDate: String(enhancedMetadata.modificationDate || ''),
      summary: String(enhancedMetadata.summary || ''),
      documentType: String(enhancedMetadata.documentType || ''),
      // Convert topics array to string
      topics: Array.isArray(enhancedMetadata.topics) 
        ? enhancedMetadata.topics.join(", ") 
        : String(enhancedMetadata.topics || ''),
      // Keep as boolean values - the savePdfMetadata function will handle conversion to SQLite integers
      aiEnhanced: Boolean(enhancedMetadata.aiEnhanced),
      needsReview: Boolean(enhancedMetadata.needsReview)
    };
    
    console.log("Sanitized metadata:", JSON.stringify(sanitizedMetadata, null, 2));
    const updatedMetadata = await savePdfMetadata(sanitizedMetadata);
    console.log("Metadata successfully enhanced and saved");
    return NextResponse.json({ 
      success: true, 
      metadata: updatedMetadata 
    });
  } catch (error) {
    console.error("Error enhancing metadata:", error);
    return NextResponse.json(
      { error: "Failed to enhance metadata: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
