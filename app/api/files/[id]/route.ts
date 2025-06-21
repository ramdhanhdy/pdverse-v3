import { NextRequest, NextResponse } from "next/server";
// import { getFileById } from "@/lib/db"; // Remove SQLite import
import { getDocumentDetailsFromPythonBackend } from "@/lib/python-backend"; // Import Python backend helper

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id; // Assuming fileId is the correct ID for the Python backend document
    // const file = getFileById(id); // Remove SQLite call
    const fileDetails = await getDocumentDetailsFromPythonBackend(fileId);

    if (!fileDetails) {
      return NextResponse.json(
        { error: "File details not found from backend" },
        { status: 404 }
      );
    }

    return NextResponse.json(fileDetails); // Return details fetched from backend
  } catch (error) {
    console.error("Error fetching file details from backend:", error);
    return NextResponse.json(
      { error: "Failed to fetch file details from backend" },
      { status: 500 }
    );
  }
}
