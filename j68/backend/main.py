import os
import sys
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional, Dict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vector_store import vector_store
from text_processor import save_uploaded_file, allowed_file, clean_text

app = FastAPI(title="本地文档语义搜索助手", description="基于 sentence-transformers 和 FAISS 的语义搜索系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5


class SearchResult(BaseModel):
    file_name: str
    text: str
    similarity: float
    chunk_index: int
    distance: float


class DocumentResponse(BaseModel):
    file_name: str


class CacheStats(BaseModel):
    size: int
    capacity: int
    hits: int
    misses: int
    hit_rate: float


class StatsResponse(BaseModel):
    total_documents: int
    total_chunks: int
    index_size: int
    dimension: int
    cache: Optional[CacheStats] = None


class SearchResponse(BaseModel):
    results: List[SearchResult]
    performance: Dict


@app.get("/", response_class=HTMLResponse)
async def root():
    index_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "index.html")
    with open(index_path, 'r', encoding='utf-8') as f:
        return f.read()


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="请选择文件")

    if not allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="不支持的文件类型，仅支持 .txt 和 .md 文件")

    content = await file.read()
    success, message, text_content = save_uploaded_file(content, file.filename)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    cleaned_text = clean_text(text_content)
    chunk_count = vector_store.add_document(file.filename, cleaned_text)

    return {
        "success": True,
        "message": f"文档上传成功，已向量化 {chunk_count} 个文本块",
        "file_name": file.filename,
        "chunks": chunk_count
    }


@app.post("/api/search")
async def search(request: SearchRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="查询内容不能为空")

    results, perf_stats = vector_store.search(request.query, request.top_k)
    
    perf_stats['encoding_time_ms'] = round(perf_stats['encoding_time'] * 1000, 2)
    perf_stats['search_time_ms'] = round(perf_stats['search_time'] * 1000, 2)
    perf_stats['highlight_time_ms'] = round(perf_stats['highlight_time'] * 1000, 2)
    perf_stats['total_time_ms'] = round(perf_stats['total_time'] * 1000, 2)
    
    return {
        "results": results,
        "performance": perf_stats
    }


@app.get("/api/documents", response_model=List[str])
async def get_documents():
    return vector_store.get_all_documents()


@app.delete("/api/documents/{file_name}")
async def delete_document(file_name: str):
    success = vector_store.delete_document(file_name)
    if not success:
        raise HTTPException(status_code=404, detail=f"文档 {file_name} 不存在")
    
    file_path = os.path.join("uploads", file_name)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    return {"success": True, "message": f"文档 {file_name} 已删除"}


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats():
    return vector_store.get_stats()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
