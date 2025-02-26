import { NextRequest, NextResponse } from "next/server";
import { getPdfMetadata } from "@/lib/db";

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
    
    // Get PDF metadata
    const metadata = getPdfMetadata(fileId);
    
    if (!metadata) {
      return NextResponse.json(
        { error: "Metadata not found for this file" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ metadata });
  } catch (error) {
    console.error("Error fetching PDF metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch PDF metadata" },
      { status: 500 }
    );
  }
}
