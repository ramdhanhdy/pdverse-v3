# test_pdf_processing.py
import os
from fastapi import UploadFile
from file_storage import save_uploaded_file
from pdf_processing import ingest_pdf
from db import get_db_session, Document, DocumentChunk, DocumentPage
from config import logger

def test_pdf_processing(pdf_path: str):
    try:
        logger.info(f"Testing PDF processing pipeline with file: {pdf_path}")
        
        # Step 1: Simulate file upload
        logger.info("Step 1: Simulating file upload...")
        with open(pdf_path, 'rb') as f:
            upload_file = UploadFile(filename=os.path.basename(pdf_path), file=f)
            stored_path, file_id = save_uploaded_file(upload_file)
            logger.info(f"File saved to: {stored_path}")

        # Step 2: Process the PDF
        logger.info("Step 2: Processing PDF...")
        metadata, chunks, pages = ingest_pdf(stored_path)
        
        logger.info(f"Extracted metadata: Title='{metadata['title']}', "
                   f"Author='{metadata['author']}', Pages={metadata['page_count']}")
        logger.info(f"Generated {len(chunks)} chunks and {len(pages)} pages")

        # Step 3: Store in database
        logger.info("Step 3: Storing in database...")
        session = get_db_session()
        
        try:
            # Check for NUL characters in metadata
            for key, value in metadata.items():
                if isinstance(value, str) and '\x00' in value:
                    logger.warning(f"NUL character found in metadata.{key}: {repr(value)}")
            
            # Check chunks
            for chunk in chunks:
                if '\x00' in chunk['content']:
                    logger.warning(f"NUL character found in chunk {chunk['chunk_index']} (page {chunk['page_number']}): {repr(chunk['content'])}")
            
            # Check pages (unlikely, but for completeness)
            for page in pages:
                for key, value in page.items():
                    if isinstance(value, str) and '\x00' in value:
                        logger.warning(f"NUL character found in page {page['page_number']}.{key}: {repr(value)}")

            # Create and store objects
            doc = Document(**metadata)
            session.add(doc)
            session.flush()
            
            for page in pages:
                page['document_id'] = doc.id
                page_obj = DocumentPage(**page)
                session.add(page_obj)
            
            for chunk in chunks:
                chunk['document_id'] = doc.id
                chunk_obj = DocumentChunk(**chunk)
                session.add(chunk_obj)
            
            session.commit()
            logger.info("Successfully stored document in database")
            
            # Verify storage
            stored_doc = session.query(Document).filter(Document.id == doc.id).first()
            stored_chunks = session.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
            stored_pages = session.query(DocumentPage).filter(DocumentPage.document_id == doc.id).all()
            
            logger.info("\nStorage verification:")
            logger.info(f"Document stored: {stored_doc.title}")
            logger.info(f"Chunks stored: {len(stored_chunks)}")
            logger.info(f"Pages stored: {len(stored_pages)}")
            
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    except Exception as e:
        logger.error(f"Test failed: {e}")
        raise

if __name__ == "__main__":
    test_pdf = r"C:\Users\ASUS TUF\Downloads\mimin,+49_agus.pdf"  # Adjust path as needed
    test_pdf_processing(test_pdf)