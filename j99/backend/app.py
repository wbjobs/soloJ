import os
import shutil
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.config import CODE_DIR, CHROMA_PERSIST_DIR
from backend.indexer import index_code
from backend.retriever import query, search_only

app = FastAPI(title="Code RAG Q&A System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


class IndexRequest(BaseModel):
    code_dir: str | None = None


class QueryRequest(BaseModel):
    question: str
    k: int | None = None


class SearchRequest(BaseModel):
    question: str
    k: int | None = None


@app.post("/api/index")
def api_index(req: IndexRequest):
    try:
        code_dir = req.code_dir or str(CODE_DIR)
        if not Path(code_dir).exists():
            raise FileNotFoundError(f"Directory not found: {code_dir}")
        num_chunks = index_code(code_dir)
        return {"status": "ok", "chunks": num_chunks, "code_dir": code_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/query")
def api_query(req: QueryRequest):
    try:
        result = query(req.question, req.k)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/search")
def api_search(req: SearchRequest):
    try:
        results = search_only(req.question, req.k)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/status")
def api_status():
    indexed = Path(CHROMA_PERSIST_DIR).exists()
    code_dir = str(CODE_DIR)
    code_dir_exists = Path(code_dir).exists()
    file_count = 0
    if code_dir_exists:
        for _ in Path(code_dir).rglob("*"):
            if _.is_file():
                file_count += 1
    return {
        "indexed": indexed,
        "code_dir": code_dir,
        "code_dir_exists": code_dir_exists,
        "file_count": file_count,
        "chroma_dir": CHROMA_PERSIST_DIR,
    }


@app.delete("/api/index")
def api_clear_index():
    try:
        if Path(CHROMA_PERSIST_DIR).exists():
            shutil.rmtree(CHROMA_PERSIST_DIR)
        return {"status": "ok", "message": "Index cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def serve_frontend():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Code RAG Q&A System API", "docs": "/docs"}
