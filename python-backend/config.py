# config.py
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

CONFIG = {
    "DB_CONNECTION": os.getenv("DB_CONNECTION", "postgresql://postgres:redknightS3@localhost:5432/pdf_db"),
    "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", "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"),  # Changed from LLM_API_KEY
    "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY", "AIzaSyBYlkT1PSEg42qfAwTcZ7KvUQBScGd8vfw"),
    "LLM_API_URL": os.getenv("LLM_API_URL", "https://api.openai.com/v1"),  # Updated to OpenAI URL
    "CHUNK_SIZE": int(os.getenv("CHUNK_SIZE", 500)),
    "EMBEDDING_MODEL": "nomic-ai/nomic-embed-text-v2-moe",
    "SUMMARIZATION_MODEL": "Falconsai/text_summarization",
    "USE_GEMINI_ENHANCEMENT" : True,  # Default to False, set to True to enable
    "NLP_MODEL": "xx_ent_wiki_sm",
    "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
    "API_PORT": int(os.getenv("API_PORT", 8000))
}

import logging
logging.basicConfig(
    level=getattr(logging, CONFIG["LOG_LEVEL"]),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)