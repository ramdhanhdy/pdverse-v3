# pdf_processing.py
import fitz
import uuid
import os
import datetime
import tiktoken
from sentence_transformers import SentenceTransformer
from config import CONFIG, logger
from utils import parse_pdf_date
import pymupdf4llm
from PyPDF2 import PdfReader
import io
import traceback
import re
import spacy
from collections import Counter
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import google.generativeai as genai
from typing import Dict, Any, Tuple
import json
import time
from db import get_db_session, Document, DocumentChunk, DocumentPage
from collections import defaultdict
from sqlalchemy import Table, Column, Integer, String, Float, ForeignKey, text

# Initialize tokenizers and models
tokenizer = tiktoken.get_encoding("cl100k_base")
embedder = SentenceTransformer(CONFIG["EMBEDDING_MODEL"], trust_remote_code=True)
nlp = spacy.load("xx_ent_wiki_sm")
summarizer = pipeline("summarization", model="Falconsai/text_summarization")

llm_tokenizer = AutoTokenizer.from_pretrained("nlpaueb/legal-bert-small-uncased")
llm_model = AutoModelForSequenceClassification.from_pretrained(
    "nlpaueb/legal-bert-small-uncased",
    num_labels=3
)
llm_classifier = pipeline("text-classification", model=llm_model, tokenizer=llm_tokenizer, device=-1)

def extract_title_author_with_llm(text) -> Tuple[str, str, float, float]:
    try:
        candidates = [line.strip() for line in text.split('\n') if line.strip()]
        if not candidates:
            return "Unknown", "Unknown", 0.0, 0.0

        title = "Unknown"
        author = "Unknown"
        max_title_score = 0.0
        max_author_score = 0.0

        for candidate in candidates[:20]:
            if len(candidate) > 500:
                candidate = candidate[:500]
            result = llm_classifier(candidate)[0]
            label = result["label"]
            score = result["score"]

            if label == "LABEL_0":  # Title
                if score > max_title_score and len(candidate) > 5:
                    title = candidate
                    max_title_score = score
            elif label == "LABEL_1":  # Author
                if score > max_author_score and len(candidate) > 3:
                    author = candidate
                    max_author_score = score

        title = title.replace('\x00', '').strip()
        author = author.replace('\x00', '').strip()
        logger.info(f"LLM extracted - Title: '{title}' (score: {max_title_score:.2f}), Author: '{author}' (score: {max_author_score:.2f})")
        return title, author, max_title_score, max_author_score
    except Exception as e:
        logger.warning(f"LLM title/author extraction failed: {e}")
        return "Unknown", "Unknown", 0.0, 0.0

def enhance_metadata_gemini(doc: Dict[str, Any], pages_text: str, title_score: float, author_score: float) -> Dict[str, Any]:
    try:
        use_gemini = CONFIG.get("USE_GEMINI_ENHANCEMENT", False)
        if not use_gemini or (title_score >= 0.5 and author_score >= 0.5):
            logger.info(f"Skipping Gemini enhancement: USE_GEMINI_ENHANCEMENT={use_gemini}, title_score={title_score:.2f}, author_score={author_score:.2f}")
            return doc

        if not CONFIG.get("GEMINI_API_KEY"):
            logger.warning("Gemini API key missing in config")
            return doc
        
        genai.configure(api_key=CONFIG["GEMINI_API_KEY"])
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        pages_text = pages_text[:4000]
        prompt = f"""Analyze this document structure and content to enhance metadata. Focus on:
        1. Title: Suggest a concise, descriptive title (12 words max)
        2. Author: Extract from headers/footers/signatures
        3. Summary: 3-5 key points in bullet format
        4. Topics: 5-7 specific keywords/tags

        Return ONLY valid JSON format:
        {{
            "title": string,
            "author": string,
            "summary": string[],
            "topics": string[]
        }}

        Document excerpts:
        {pages_text}

        Current metadata (verify/improve):
        - Title: {doc.get('title')}
        - Author: {doc.get('author')}
        """
        
        for attempt in range(3):
            try:
                response = model.generate_content(prompt)
                raw_response = response.text.strip()
                logger.debug(f"Gemini raw response (attempt {attempt+1}): {raw_response[:500]}...")

                if not raw_response:
                    logger.warning(f"Gemini returned empty response on attempt {attempt+1}")
                    time.sleep(2)
                    continue
                
                if raw_response.startswith('```json'):
                    raw_response = raw_response[7:-3].strip()
                
                enhanced = json.loads(raw_response)
                
                doc["title"] = enhanced.get("title", doc["title"])
                doc["author"] = enhanced.get("author", doc["author"])
                doc["summary"] = " ".join(enhanced.get("summary", []))
                doc["topics"] = list(set(doc["topics"] + enhanced.get("topics", [])))
                
                logger.info(f"Gemini enhanced metadata: {enhanced}")
                return doc
            except json.JSONDecodeError as e:
                logger.warning(f"Gemini returned invalid JSON on attempt {attempt+1}: {e}. Raw response: {raw_response if 'raw_response' in locals() else 'No response'}")
                time.sleep(2)
            except Exception as e:
                logger.warning(f"Gemini attempt {attempt+1} failed: {e}")
                time.sleep(2)
        logger.error("All Gemini attempts failed")
        return doc
    except Exception as e:
        logger.warning(f"Gemini enhancement failed: {e}")
        return doc

def analyze_structure(elements):
    structures = []
    for elem in elements:
        if elem.get("type") != "text":
            continue
        text = elem.get("text", "").strip()
        font_size = elem.get("font_size", 0)
        page_number = elem.get("page_number", 1)
        if font_size > 14:
            structure = {
                "id": str(uuid.uuid4()),
                "type": "heading",
                "level": 1 if font_size > 18 else 2,
                "title": text,
                "page_number": page_number
            }
            structures.append(structure)
    return structures

def extract_entities(chunks):
    try:
        entity_groups = defaultdict(lambda: {"occurrences": [], "importance": 0})
        relationships = []

        # Process each chunk and collect entity occurrences
        for chunk in chunks:
            if chunk.get("content_type") != "text":
                continue
            text = chunk.get("content", "")
            chunk_id = chunk["id"]
            doc = nlp(text)
            chunk_entities = []

            for ent in doc.ents:
                normalized_name = ent.text.lower()
                entity_type = ent.label_
                key = (normalized_name, entity_type)
                if key not in entity_groups:
                    entity_groups[key] = {
                        "id": uuid.uuid4(),
                        "type": entity_type,
                        "name": ent.text,
                        "normalized_name": normalized_name,
                        "occurrences": [],
                        "importance": 0,
                        "description": ""
                    }
                entity_groups[key]["occurrences"].append({
                    "chunk_id": str(chunk_id),
                    "start": ent.start_char,
                    "end": ent.end_char
                })
                entity_groups[key]["importance"] += 1  # Increment importance per occurrence
                chunk_entities.append(entity_groups[key]["id"])

            # Create relationships between entities in the same chunk
            if len(chunk_entities) > 1:
                for i in range(len(chunk_entities) - 1):
                    for j in range(i + 1, len(chunk_entities)):
                        rel = {
                            "id": uuid.uuid4(),
                            "source_entity_id": chunk_entities[i],
                            "target_entity_id": chunk_entities[j],
                            "type": "co-occurrence",
                            "confidence": 0.5,
                            "description": "Entities appear in the same chunk",
                            "chunk_ids": [str(chunk_id)]
                        }
                        relationships.append(rel)

        # Convert grouped entities to list
        entities = list(entity_groups.values())

        # Normalize importance scores to a 0-1 range
        max_importance = max((entity["importance"] for entity in entities), default=1)  # Avoid ZeroDivisionError
        for entity in entities:
            entity["importance"] = entity["importance"] / max_importance if max_importance > 0 else 0

        logger.info(f"Extracted {len(entities)} unique entities and {len(relationships)} relationships.")
        return entities, relationships
    except Exception as e:
        logger.error(f"Error in entity extraction: {e}")
        raise

def aggregate_metadata(metadata, chunks, structures, entities):
    try:
        summary = ""
        if chunks:
            combined_text = ' '.join([chunk['content'][:1000] for chunk in chunks[:3]]).replace('\x00', '')
            input_length = len(tokenizer.encode(combined_text))
            summary_result = summarizer(
                combined_text,
                max_length=min(300, input_length),
                min_length=max(30, int(input_length * 0.2)),
                do_sample=False
            )
            summary = summary_result[0]["summary_text"].replace('\x00', '')
        entity_types = [e["type"] for e in entities]
        topics = [t[0] for t in Counter(entity_types).most_common(5)]
        metadata["summary"] = summary
        metadata["topics"] = topics
        logger.info(f"Aggregated metadata: summary length {len(summary)}, {len(topics)} topics.")
        return metadata
    except Exception as e:
        logger.error(f"Error in metadata aggregation: {e}")
        raise

def ingest_pdf(file_path):
    """Ingest a PDF, process it, and return results without immediate database storage."""
    try:
        pdf_reader = None
        try:
            pdf_reader = PdfReader(file_path)
            page_count_pypdf2 = len(pdf_reader.pages)
            info = pdf_reader.metadata or {}
            pypdf2_title = info.get('/Title', 'Unknown') or 'Unknown'
            pypdf2_author = info.get('/Author', 'Unknown') or 'Unknown'
        except Exception as e:
            logger.warning(f"PyPDF2 validation failed: {e}")
            pypdf2_title = "Unknown"
            pypdf2_author = "Unknown"
            page_count_pypdf2 = 0

        doc = fitz.open(file_path)
        file_stats = os.stat(file_path)

        llm_text = ""
        for page_num in range(min(2, doc.page_count)):
            page = doc[page_num]
            text_blocks = page.get_text("dict")["blocks"]
            for block in text_blocks:
                if "lines" in block:
                    for line in block["lines"]:
                        text = " ".join([span["text"] for span in line.get("spans", [])]).strip()
                        if text:
                            llm_text += text + "\n"
        llm_title, llm_author, title_score, author_score = extract_title_author_with_llm(llm_text)

        metadata = {
            "id": str(uuid.uuid4()),  # Convert UUID to string for JSON compatibility
            "filename": os.path.basename(file_path),
            "title": llm_title if llm_title != "Unknown" else doc.metadata.get("title", pypdf2_title) or pypdf2_title,
            "author": llm_author if llm_author != "Unknown" else doc.metadata.get("author", pypdf2_author) or pypdf2_author,
            "creation_date": parse_pdf_date(doc.metadata.get("creationDate")),
            "modification_date": parse_pdf_date(doc.metadata.get("modDate")),
            "file_creation_date": datetime.datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
            "file_modification_date": datetime.datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
            "page_count": doc.page_count,
            "file_size": file_stats.st_size,
            "language": "en",
            "document_type": "pdf",
            "table_count": 0,
            "summary": "",
            "topics": []
        }

        elements = []
        chunks = []
        pages = []
        table_count = 0
        chunk_size = CONFIG.get("CHUNK_SIZE", 500)

        md_text = None
        try:
            md_text = pymupdf4llm.to_markdown(file_path)
            logger.info(f"Converted to markdown for table detection: {len(md_text)} characters")
        except Exception as e:
            logger.warning(f"Markdown conversion failed: {e}")

        for page_num in range(doc.page_count):
            page = doc[page_num]
            page_text = ""
            has_table = False

            try:
                text_blocks = page.get_text("dict")["blocks"]
                for block in text_blocks:
                    if "lines" in block:
                        for line in block["lines"]:
                            text = " ".join([span["text"] for span in line.get("spans", [])]).strip()
                            if text:
                                text = text.replace('\x00', '')
                                page_text += text + " "
                                font_size = max([span["size"] for span in line.get("spans", [])], default=0)
                                elements.append({
                                    "type": "text",
                                    "text": text,
                                    "page_number": page_num + 1,
                                    "bbox": [block["bbox"][0], block["bbox"][1], block["bbox"][2], block["bbox"][3]],
                                    "font_size": font_size
                                })
            except Exception as e:
                logger.warning(f"PyMuPDF dict extraction failed for page {page_num + 1}: {e}")

            if not page_text and pdf_reader and page_num < len(pdf_reader.pages):
                try:
                    page_text = (pdf_reader.pages[page_num].extract_text() or "").replace('\x00', '')
                    if page_text:
                        elements.append({
                            "type": "text",
                            "text": page_text,
                            "page_number": page_num + 1,
                            "bbox": [0, 0, 612, 792],
                            "font_size": 0
                        })
                except Exception as e:
                    logger.warning(f"PyPDF2 extraction failed for page {page_num + 1}: {e}")

            if md_text:
                page_markers = [f"# Page {page_num+1}", f"## Page {page_num+1}"]
                next_page_markers = [f"# Page {page_num+2}", f"## Page {page_num+2}"]
                page_start = -1
                for marker in page_markers:
                    if marker in md_text:
                        page_start = md_text.find(marker)
                        break
                page_end = len(md_text)
                for marker in next_page_markers:
                    if marker in md_text:
                        page_end = md_text.find(marker)
                        break
                if page_start >= 0:
                    md_page_text = md_text[page_start:page_end].strip()
                    has_table = "| --- |" in md_page_text
            if not has_table:
                try:
                    tables = page.find_tables()
                    has_table = any(len(t.rows) >= 3 and (t.col_count >= 3 if hasattr(t, 'col_count') else len(t.cells[0]) >= 3 if t.cells else False) for t in tables.tables)
                except Exception as e:
                    logger.warning(f"Table detection failed for page {page_num + 1}: {e}")

            if has_table:
                table_count += 1

            pages.append({
                "document_id": metadata["id"],
                "page_number": page_num + 1,
                "has_table": has_table
            })

            if page_text:
                current_chunk = []
                current_token_count = 0
                chunk_index = len(chunks)
                section_path = [f"Page {page_num + 1}"]
                text_blocks = page_text.split()
                for word in text_blocks:
                    tokens = tokenizer.encode(word)
                    if current_token_count + len(tokens) > chunk_size:
                        if current_chunk:
                            chunk_text = " ".join(current_chunk).replace('\x00', '')
                            chunk_id = str(uuid.uuid4())  # Convert to string
                            embedding = embedder.encode(chunk_text)
                            chunks.append({
                                "id": chunk_id,
                                "document_id": metadata["id"],
                                "page_number": page_num + 1,
                                "chunk_index": chunk_index,
                                "content": chunk_text,
                                "content_type": "text",
                                "section_path": section_path[:],
                                "embedding": embedding.tolist(),
                                "token_count": current_token_count,
                                "importance": 1.2 if page_num == 0 else 1.0
                            })
                            chunk_index += 1
                            current_chunk = []
                            current_token_count = 0
                    current_chunk.append(word)
                    current_token_count += len(tokens)
                if current_chunk:
                    chunk_text = " ".join(current_chunk).replace('\x00', '')
                    chunk_id = str(uuid.uuid4())  # Convert to string
                    embedding = embedder.encode(chunk_text)
                    chunks.append({
                        "id": chunk_id,
                        "document_id": metadata["id"],
                        "page_number": page_num + 1,
                        "chunk_index": chunk_index,
                        "content": chunk_text,
                        "content_type": "text",
                        "section_path": section_path[:],
                        "embedding": embedding.tolist(),
                        "token_count": current_token_count,
                        "importance": 1.2 if page_num == 0 else 1.0
                    })

            if not any(c["page_number"] == page_num + 1 for c in chunks):
                logger.warning(f"No chunks for page {page_num + 1}; adding fallback")
                chunk_id = str(uuid.uuid4())  # Convert to string
                chunks.append({
                    "id": chunk_id,
                    "document_id": metadata["id"],
                    "page_number": page_num + 1,
                    "chunk_index": len(chunks),
                    "content": "No text could be extracted from this page",
                    "content_type": "text",
                    "section_path": [f"Page {page_num + 1}"],
                    "embedding": embedder.encode("No text").tolist(),
                    "token_count": 5,
                    "importance": 0.5
                })

        metadata["table_count"] = table_count
        structures = analyze_structure(elements)
        entities, relationships = extract_entities(chunks)
        metadata = aggregate_metadata(metadata, chunks, structures, entities)

       
        strategic_pages = []
        strategic_pages.extend([0, 1] if doc.page_count > 1 else [0])
        mid = doc.page_count // 2
        strategic_pages.extend([mid-1, mid] if doc.page_count > 3 else [mid])
        strategic_pages.extend([-2, -1] if doc.page_count > 2 else [])
        
        gemini_text = ""
        for p in sorted(set(strategic_pages)):
            if 0 <= p < doc.page_count:
                gemini_text += doc[p].get_text()[:2000] + "\n\n"
        
        metadata = enhance_metadata_gemini(metadata, gemini_text, title_score, author_score)

        for key in ["title", "author", "filename", "summary"]:
            if isinstance(metadata[key], str):
                metadata[key] = metadata[key].replace('\x00', '')

        doc.close()
        logger.info(f"Processed PDF: {len(chunks)} chunks, {table_count} tables, {len(structures)} structures, {len(entities)} entities")
        return metadata, chunks, pages, entities, relationships

    except Exception as e:
        logger.error(f"PDF ingestion failed: {e}")
        logger.debug(traceback.format_exc())
        metadata = {
            "id": str(uuid.uuid4()),
            "filename": os.path.basename(file_path),
            "title": "Error Processing PDF",
            "author": "Unknown",
            "creation_date": datetime.datetime.now().isoformat(),
            "modification_date": datetime.datetime.now().isoformat(),
            "file_creation_date": datetime.datetime.now().isoformat(),
            "file_modification_date": datetime.datetime.now().isoformat(),
            "page_count": 1,
            "file_size": os.path.getsize(file_path),
            "language": "en",
            "document_type": "pdf",
            "table_count": 0,
            "summary": f"Error processing this document: {str(e)}",
            "topics": []
        }
        chunks = [{
            "id": str(uuid.uuid4()),
            "document_id": metadata["id"],
            "page_number": 1,
            "chunk_index": 0,
            "content": f"Error processing PDF: {str(e)}".replace('\x00', ''),
            "content_type": "text",
            "section_path": ["Error"],
            "embedding": [0.0] * 768,
            "token_count": 5,
            "importance": 0.5
        }]
        pages = [{
            "document_id": metadata["id"],
            "page_number": 1,
            "has_table": False
        }]
        return metadata, chunks, pages, [], []

if __name__ == "__main__":
    test_file = r"C:\Users\ASUS TUF\Downloads\sample_docs\Buku_Statsitik_Konsumsi_Pangan_2023.pdf"
    metadata, chunks, pages,  entities, relationships = ingest_pdf(test_file)
    print(f"Title: {metadata['title']}, Author: {metadata['author']}")