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
    
    # Embeddings Config
    OLLAMA_EMBEDDING_MODEL: str = os.getenv("OLLAMA_EMBEDDING_MODEL", "qwen3-embedding:0.6b")
    GEMINI_EMBEDDING_MODEL: str = os.getenv("GEMINI_EMBEDDING_MODEL", "models/embedding-001")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")

    # Vision Model Config
    OLLAMA_VISION_MODEL: str = os.getenv("OLLAMA_VISION_MODEL", "llava")
    GEMINI_VISION_MODEL: str = os.getenv("GEMINI_VISION_MODEL", "gemini-1.5-flash")
    
    # Ingestion & Chunking Config
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", 1000))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", 200))
    IMAGE_OUTPUT_DIR: str = os.getenv("IMAGE_OUTPUT_DIR", "storage/images")

    @property
    def embedding_model(self):
        """
        Abstracts the embedding model initialization.
        Returns Gemini in production, Ollama in development.
        """
        if self.ENVIRONMENT == "production":
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            print("Using Gemini Embeddings (Production Mode)")
            return GoogleGenerativeAIEmbeddings(
                model=self.GEMINI_EMBEDDING_MODEL,
                google_api_key=self.GOOGLE_API_KEY
            )
        else:
            from langchain_ollama import OllamaEmbeddings
            print("Using Ollama Embeddings (Development Mode)")
            return OllamaEmbeddings(
                model=self.OLLAMA_EMBEDDING_MODEL
            )

    @property
    def vision_model(self):
        """
        Abstracts the vision LLM initialization.
        Returns Gemini Flash in production, Ollama (llava) in development.
        """
        if self.ENVIRONMENT == "production":
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=self.GEMINI_VISION_MODEL,
                google_api_key=self.GOOGLE_API_KEY
            )
        else:
            from langchain_ollama import ChatOllama
            return ChatOllama(
                model=self.OLLAMA_VISION_MODEL,
                num_ctx=8192  # Increase context window to fit large base64 images
            )

# Instantiate a global settings object to be imported across the app
settings = Settings()
