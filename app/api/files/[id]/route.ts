import { NextRequest, NextResponse } from "next/server";
// import { getFileById } from "@/lib/db"; // Remove SQLite import
import { getDocumentFromPythonBackend, deleteDocumentFromPythonBackend } from "@/lib/python-backend";
import db from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id; // Assuming fileId is the correct ID for the Python backend document
    // const file = getFileById(id); // Remove SQLite call
    const fileDetails = await getDocumentFromPythonBackend(fileId);

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id;

    // First, delete from the database
    await db.query('DELETE FROM files WHERE id = $1', [fileId]);

    // Then, delete from the Python backend
    await deleteDocumentFromPythonBackend(fileId);

    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
