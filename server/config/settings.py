import os
from dotenv import load_dotenv

# Load variables from the .env file into the system environment
load_dotenv()

class Settings:
    """
    Global configuration object.
    You can override any of these by setting environment variables in a .env file.
    """
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Vector DB Config
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "my_chroma_db")

    # Redis Config
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # MySQL Database Config
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT", 3306))
    MYSQL_USER: str = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DB: str = os.getenv("MYSQL_DB", "collage_db")
    MYSQL_URL: str = os.getenv(
        "MYSQL_URL", 
        f"mysql+pymysql://{os.getenv('MYSQL_USER', 'root')}:{os.getenv('MYSQL_PASSWORD', '')}@{os.getenv('MYSQL_HOST', 'localhost')}:{os.getenv('MYSQL_PORT', 3306)}/{os.getenv('MYSQL_DB', 'collage_db')}"
    )

    # JWT Config
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "super_secret_collage_key_change_in_production_123!")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_DAYS: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_DAYS", 7))
    
    # Embeddings Config
    OLLAMA_EMBEDDING_MODEL: str = os.getenv("OLLAMA_EMBEDDING_MODEL", "qwen3-embedding:0.6b")
    GEMINI_EMBEDDING_MODEL: str = os.getenv("GEMINI_EMBEDDING_MODEL", "models/embedding-001")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")

    # Generation LLM Config
    OLLAMA_LLM_MODEL: str = os.getenv("OLLAMA_LLM_MODEL", "llama3.2")
    GEMINI_LLM_MODEL: str = os.getenv("GEMINI_LLM_MODEL", "gemini-1.5-flash")
    
    # Storage & Path Config
    SERVER_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    PROJECT_ROOT: str = os.path.abspath(os.path.join(SERVER_DIR, ".."))
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", os.path.join(PROJECT_ROOT, "storage"))
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", os.path.join(STORAGE_DIR, "uploads"))
    IMAGE_OUTPUT_DIR: str = os.getenv("IMAGE_OUTPUT_DIR", os.path.join(STORAGE_DIR, "images"))

    # Ingestion & Chunking Config
    # CHUNK_SIZE is passed as max_tokens to HybridChunker.
    # BAAI/bge-small-en-v1.5 (our HybridChunker tokenizer) has a 512-token context window,
    # so chunks must stay at or below 512 tokens to avoid truncation during embedding.
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", 512))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", 100))

    # LangSmith Tracing & Debugging Config
    LANGCHAIN_TRACING_V2: str = os.getenv("LANGCHAIN_TRACING_V2", "false")
    LANGCHAIN_API_KEY: str = os.getenv("LANGCHAIN_API_KEY", "")
    LANGCHAIN_PROJECT: str = os.getenv("LANGCHAIN_PROJECT", "collage-rag")
    LANGCHAIN_ENDPOINT: str = os.getenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")

    @property
    def embedding_model(self):
        """
        Abstracts the embedding model initialization.
        Returns Ollama in both production and development.
        """
        from langchain_ollama import OllamaEmbeddings
        print("Using Ollama Embeddings (Development Mode)")
        return OllamaEmbeddings(
            model=self.OLLAMA_EMBEDDING_MODEL
        )
        # if self.ENVIRONMENT == "production":
        #     from langchain_google_genai import GoogleGenerativeAIEmbeddings
        #     print("Using Gemini Embeddings (Production Mode)")
        #     return GoogleGenerativeAIEmbeddings(
        #         model=self.GEMINI_EMBEDDING_MODEL,
        #         google_api_key=self.GOOGLE_API_KEY
        #     )
        # else:
        #     from langchain_ollama import OllamaEmbeddings
        #     print("Using Ollama Embeddings (Development Mode)")
        #     return OllamaEmbeddings(
        #         model=self.OLLAMA_EMBEDDING_MODEL
        #     )

    @property
    def llm_model(self):
        """
        Abstracts the text generation LLM initialization.
        Returns Gemini in production, Ollama in development.
        """
        if self.ENVIRONMENT == "production":
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=self.GEMINI_LLM_MODEL,
                google_api_key=self.GOOGLE_API_KEY
            )
        else:
            from langchain_ollama import ChatOllama
            return ChatOllama(
                model=self.OLLAMA_LLM_MODEL
            )

# Instantiate a global settings object to be imported across the app
settings = Settings()

# Synchronize LangSmith tracing variables into os.environ for automatic LangChain/LangSmith SDK pickup
if settings.LANGCHAIN_TRACING_V2:
    os.environ["LANGCHAIN_TRACING_V2"] = settings.LANGCHAIN_TRACING_V2
if settings.LANGCHAIN_API_KEY:
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
if settings.LANGCHAIN_PROJECT:
    os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
if settings.LANGCHAIN_ENDPOINT:
    os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGCHAIN_ENDPOINT

