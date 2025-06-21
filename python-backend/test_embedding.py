# test_embedder.py
import sys
from pdf_processing import embedder  # Import from your current project's pdf_processing module
import numpy as np

# Configure basic logging to see output
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Test query
query = "simulated"

# Generate embedding
embedding = embedder.encode(query)

# Print details about the embedding
if isinstance(embedding, np.ndarray):
    logger.info(f"Type: {type(embedding)}, Shape: {embedding.shape}, Sample: {embedding[:5]}")
elif isinstance(embedding, list):
    logger.info(f"Type: {type(embedding)}, Length: {len(embedding)}, Sample: {embedding[:5]}")
else:
    logger.info(f"Type: {type(embedding)}, Value: {embedding}")

# Optional: Flatten and validate if necessary
if isinstance(embedding, np.ndarray) and embedding.ndim > 1:
    flattened_embedding = embedding.flatten()
    logger.info(f"Flattened to: Type: {type(flattened_embedding)}, Shape: {flattened_embedding.shape}, Sample: {flattened_embedding[:5]}")
elif isinstance(embedding, list) and len(embedding) > 0 and isinstance(embedding[0], list):
    flattened_embedding = embedding[0]
    logger.info(f"Unwrapped to: Type: {type(flattened_embedding)}, Length: {len(flattened_embedding)}, Sample: {flattened_embedding[:5]}")
