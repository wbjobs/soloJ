import os
import json
import uuid
import asyncio
from pathlib import Path
from typing import List, Dict, Any, AsyncGenerator
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from config import get_settings
from rag_engine import rag_engine

settings = get_settings()

app = FastAPI(
    title="RAG 本地知识库问答系统",
    description="基于 LangChain + FAISS + Ollama 的本地知识库问答系统",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]


class DocumentInfo(BaseModel):
    filename: str
    chunks: int
    raw_pages: int


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "vectorstore_size": rag_engine.get_document_count()}


@app.get("/api/documents")
async def list_documents():
    files = rag_engine.list_uploaded_files()
    return {"documents": files, "total_chunks": rag_engine.get_document_count()}


@app.post("/api/upload", response_model=DocumentInfo)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in [".pdf", ".txt"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Only .pdf and .txt are supported.",
        )

    upload_dir = Path(settings.UPLOAD_PATH)
    upload_dir.mkdir(parents=True, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = upload_dir / unique_name

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        chunks, raw_pages, filename = rag_engine.ingest_file(str(file_path))

        return DocumentInfo(filename=file.filename, chunks=chunks, raw_pages=raw_pages)
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        answer, sources = rag_engine.chat(request.question)
        return ChatResponse(answer=answer, sources=sources)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating answer: {str(e)}")


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for event in rag_engine.chat_stream(request.question):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except asyncio.CancelledError:
            yield f"data: {json.dumps({'type': 'error', 'data': '连接已中断'}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/clear")
async def clear_vectorstore():
    try:
        rag_engine.clear_vectorstore()
        return {"message": "Vector store cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing vector store: {str(e)}")


@app.get("/api/document/{filename}")
async def get_document_content(filename: str):
    try:
        content = rag_engine.get_document_full_text(filename)
        return {"filename": filename, "pages": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading document: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
