import psycopg2
from config import CONFIG, logger

def initialize_database():
    """Initialize the database with the pgvector extension."""
    conn_string = CONFIG["DB_CONNECTION"]
    
    try:
        # Connect to the database
        logger.info("Connecting to database...")
        conn = psycopg2.connect(conn_string)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Create the pgvector extension
        logger.info("Creating pgvector extension...")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        
        # Verify the extension was created
        cursor.execute("SELECT extname FROM pg_extension WHERE extname = 'vector';")
        result = cursor.fetchone()
        
        if result and result[0] == 'vector':
            logger.info("pgvector extension successfully installed")
        else:
            logger.error("Failed to install pgvector extension")
            
        # Close the connection
        cursor.close()
        conn.close()
        logger.info("Database initialization completed")
        
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

if __name__ == "__main__":
    initialize_database()
