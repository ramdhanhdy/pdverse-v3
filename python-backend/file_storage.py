# file_storage.py
import os
import shutil
import uuid
import traceback
from typing import Optional, Tuple
from fastapi import UploadFile
from config import CONFIG, logger

# Define storage directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_uploaded_file(file: UploadFile, document_id: Optional[str] = None) -> Tuple[str, str]:
    """
    Save an uploaded file to the storage directory.
    
    Args:
        file: The uploaded file
        document_id: Optional document ID to use in filename
        
    Returns:
        Tuple of (file_path, file_id)
    """
    try:
        # Generate a unique ID for the file if not provided
        file_id = document_id or str(uuid.uuid4())
        
        # Get file extension
        _, ext = os.path.splitext(file.filename)
        if not ext:
            ext = ".pdf"  # Default to PDF extension
            
        # Create filename
        filename = f"{file_id}{ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Read the file content into memory first to avoid partial writes
        file.file.seek(0)
        content = file.file.read()
        
        # Check if it's a valid PDF (simple header check)
        if ext.lower() == '.pdf':
            if not content.startswith(b'%PDF-'):
                logger.warning(f"File does not start with PDF header: {file.filename}")
                # We'll still save it, but log the warning
            
            # Additional validation could be added here
            
        # Save the file
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        logger.info(f"File saved successfully: {file_path} ({len(content)} bytes)")
        return file_path, file_id
    except Exception as e:
        logger.error(f"Error saving file: {e}")
        logger.debug(traceback.format_exc())
        raise

def delete_file(document_id: str) -> bool:
    """
    Delete a file from storage.
    
    Args:
        document_id: The document ID
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Look for files with this document ID
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(document_id):
                file_path = os.path.join(UPLOAD_DIR, filename)
                os.remove(file_path)
                logger.info(f"Deleted file: {file_path}")
                return True
        
        logger.warning(f"No file found for document ID: {document_id}")
        return False
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        return False

def get_file_path(document_id: str) -> Optional[str]:
    """
    Get the file path for a document ID.
    
    Args:
        document_id: The document ID
        
    Returns:
        The file path if found, None otherwise
    """
    try:
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(document_id):
                return os.path.join(UPLOAD_DIR, filename)
        
        return None
    except Exception as e:
        logger.error(f"Failed to get file path: {e}")
        return None