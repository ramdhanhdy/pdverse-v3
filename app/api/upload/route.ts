import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { isValidPdf } from "@/lib/utils";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!isValidPdf(file)) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    const uniqueId = uuidv4();
    const fileExtension = path.extname(file.name);
    const filename = `${uniqueId}${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    const buffer = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // Prepare form data for Python backend
    const backendFormData = new FormData();
    backendFormData.append("file", new Blob([buffer]), filename);
    // Optionally add title and author if present in the original formData
    const title = formData.get("docTitle") as string | null;
    const author = formData.get("docAuthor") as string | null;
    if (title) backendFormData.append("docTitle", title);
    if (author) backendFormData.append("docAuthor", author);

    // Send to Python backend
    const processingResponse = await fetch(`${PYTHON_BACKEND_URL}/upload`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!processingResponse.ok) {
      const errorData = await processingResponse.json();
      throw new Error(errorData.detail || "Failed to process PDF in backend");
    }

    const result = await processingResponse.json();

    return NextResponse.json({
      success: result.status === 'success',
      documentId: result.id,
      filename: result.filename,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}