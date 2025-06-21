import { NextRequest, NextResponse } from "next/server";
import { 
  getDocumentDetailsAndMetadataFromPythonBackend, 
  updateDocumentMetadataInPythonBackend 
} from "@/lib/python-backend";
import { enhanceMetadataWithGemini } from "@/lib/ai/gemini";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    console.log("Enhance metadata API called");
    const data = await request.json();
    const { fileId } = data;
    console.log("File ID (Backend Document ID):", fileId);

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    // Get current metadata and file details from Python backend
    const backendData = await getDocumentDetailsAndMetadataFromPythonBackend(fileId);
    console.log("Retrieved backend data:", backendData ? "Found" : "Not found");
    
    if (!backendData || !backendData.metadata || !backendData.fileDetails) {
         return NextResponse.json(
        { error: "Document details or metadata not found from backend for this file ID" },
        { status: 404 }
      );
    }

    const metadata = backendData.metadata;
    const fileDetails = backendData.fileDetails;

    // Use filename from backend data
    const filename = fileDetails.filename; 
    if (!filename) {
         return NextResponse.json(
        { error: "Filename not found in backend data" },
        { status: 404 }
      );
    }

    // Get file path to extract text
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, filename);
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

    // Convert backend metadata to the format expected by enhanceMetadataWithGemini
    const metadataForEnhancement = {
      title: metadata.title || "",
      author: metadata.author || "",
      subject: metadata.subject || "",
      keywords: metadata.keywords || "",
      creator: metadata.creator || "",
      producer: metadata.producer || "",
      pageCount: metadata.page_count || metadata.pageCount || 0,
      creationDate: metadata.creation_date || metadata.creationDate || "",
      modificationDate: metadata.modification_date || metadata.modificationDate || "",
      summary: metadata.summary || "",
      documentType: metadata.document_type || metadata.documentType || "",
      topics: Array.isArray(metadata.topics) ? metadata.topics : (metadata.topics?.split(",").map((t: string) => t.trim()) || []),
      aiEnhanced: Boolean(metadata.ai_enhanced || metadata.aiEnhanced),
      needsReview: Boolean(metadata.needs_review || metadata.needsReview)
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

    // Save enhanced metadata back via Python backend
    console.log("Saving enhanced metadata via Python backend");
    
    // Prepare metadata for the backend PUT/POST request
    const metadataToSave = {
        title: String(enhancedMetadata.title || ''),
        author: String(enhancedMetadata.author || ''),
        subject: String(enhancedMetadata.subject || ''),
        keywords: Array.isArray(enhancedMetadata.keywords) ? enhancedMetadata.keywords.join(", ") : String(enhancedMetadata.keywords || ''),
        creator: String(enhancedMetadata.creator || ''),
        producer: String(enhancedMetadata.producer || ''),
        page_count: Number(enhancedMetadata.pageCount || 0),
        creation_date: String(enhancedMetadata.creationDate || ''),
        modification_date: String(enhancedMetadata.modificationDate || ''),
        summary: String(enhancedMetadata.summary || ''),
        document_type: String(enhancedMetadata.documentType || ''),
        topics: Array.isArray(enhancedMetadata.topics) ? enhancedMetadata.topics.join(", ") : String(enhancedMetadata.topics || ''),
        ai_enhanced: Boolean(enhancedMetadata.aiEnhanced),
        needs_review: Boolean(enhancedMetadata.needsReview)
    };
    
    console.log("Metadata to save:", JSON.stringify(metadataToSave, null, 2));
    // Call the backend update function
    const updatedMetadataResult = await updateDocumentMetadataInPythonBackend(fileId, metadataToSave); 
    console.log("Metadata successfully enhanced and saved via backend");
    
    // Return the result from the backend update call, adapting as needed
    return NextResponse.json({ 
      success: true, 
      metadata: updatedMetadataResult
    });
  } catch (error) {
    console.error("Error enhancing metadata:", error);
    return NextResponse.json(
      { error: "Failed to enhance metadata: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
