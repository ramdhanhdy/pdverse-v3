# db.py
import uuid
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, ForeignKey, JSON, ARRAY, text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
import logging
import datetime
from config import CONFIG, logger
from utils import parse_pdf_date

Base = declarative_base()

# Define database models
class Document(Base):
    __tablename__ = 'documents'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String)
    title = Column(String)
    author = Column(String)
    creation_date = Column(DateTime)
    modification_date = Column(DateTime)
    file_creation_date = Column(DateTime)
    file_modification_date = Column(DateTime)
    page_count = Column(Integer)
    file_size = Column(Integer)
    language = Column(String)
    summary = Column(String)
    document_type = Column(String)
    topics = Column(ARRAY(String))
    table_count = Column(Integer)

class DocumentPage(Base):
    __tablename__ = 'document_pages'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey('documents.id'))
    page_number = Column(Integer)
    has_table = Column(Boolean)

class DocumentChunk(Base):
    __tablename__ = 'document_chunks'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey('documents.id'))
    page_number = Column(Integer)
    chunk_index = Column(Integer)
    content = Column(String)
    content_type = Column(String)
    section_path = Column(ARRAY(String))
    embedding = Column(Vector(768))
    token_count = Column(Integer)
    importance = Column(Float)

class DocumentEntity(Base):
    __tablename__ = 'document_entities'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey('documents.id'))
    type = Column(String)
    name = Column(String)
    normalized_name = Column(String)
    occurrences = Column(JSON)
    importance = Column(Float)
    description = Column(String)

class DocumentRelationship(Base):
    __tablename__ = 'document_relationships'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey('documents.id'))
    source_entity_id = Column(UUID(as_uuid=True))
    target_entity_id = Column(UUID(as_uuid=True))
    type = Column(String)
    confidence = Column(Float)
    description = Column(String)
    chunk_ids = Column(ARRAY(String))

engine = create_engine(CONFIG["DB_CONNECTION"])
try:
    # Create tables if they don't exist
    Base.metadata.create_all(engine)
    logger.info("Database tables created successfully")
except Exception as e:
    logger.error(f"Error creating database tables: {e}")
    raise

Session = sessionmaker(bind=engine)

def get_db_session():
    try:
        session = Session()
        return session
    except Exception as e:
        logger.error(f"Error creating database session: {e}")
        raise

def store_data(session, items):
    try:
        for item in items:
            if isinstance(item, Document):
                if isinstance(item.creation_date, str) and item.creation_date.startswith('D:'):
                    item.creation_date = parse_pdf_date(item.creation_date)
                if isinstance(item.modification_date, str) and item.modification_date.startswith('D:'):
                    item.modification_date = parse_pdf_date(item.modification_date)
            session.add(item)
        session.commit()
        logger.info("Data stored successfully")
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to store data: {e}")
        raise

__all__ = [
    'get_db_session', 
    'Document', 
    'DocumentChunk', 
    'DocumentPage',
    'DocumentEntity',
    'DocumentRelationship',
    'Session'
]