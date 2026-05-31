import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CODE_DIR = Path(os.getenv("CODE_DIR", str(BASE_DIR / "code_repo")))
CHROMA_PERSIST_DIR = str(BASE_DIR / "chroma_db")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
RETRIEVAL_K = int(os.getenv("RETRIEVAL_K", "5"))
SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rs",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
    ".kt", ".scala", ".sh", ".bash", ".sql", ".html", ".css",
    ".scss", ".less", ".vue", ".svelte", ".yaml", ".yml", ".json",
    ".xml", ".toml", ".ini", ".cfg", ".md", ".txt", ".rst",
}
STRIP_COMMENTS = os.getenv("STRIP_COMMENTS", "true").lower() == "true"
MIN_CHUNK_LINES = int(os.getenv("MIN_CHUNK_LINES", "3"))
MAX_COMMENT_RATIO = float(os.getenv("MAX_COMMENT_RATIO", "0.6"))
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "20"))
RETRIEVAL_DISTANCE_THRESHOLD = float(os.getenv("RETRIEVAL_DISTANCE_THRESHOLD", "1.5"))
