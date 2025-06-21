# app.py
from fastapi import FastAPI
from api import app as api_app
from config import CONFIG, logger
from db import get_db_session
from sqlalchemy import text

app = FastAPI(
    title="Simple PDF Backend with LLM",
    description="Basic backend for PDF processing and LLM queries",
    version="1.0.0"
)

app.mount("", api_app)

@app.on_event("startup")
async def startup_event():
    try:
        # Check database connection
        logger.info("Checking database connection...")
        with get_db_session() as session:
            session.execute(text("SELECT 1"))
            logger.info("Database connection successful")
        
        logger.info(f"Starting server on port {CONFIG['API_PORT']}")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=CONFIG["API_PORT"])