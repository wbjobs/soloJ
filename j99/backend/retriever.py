from typing import Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from backend.config import (
    LLM_PROVIDER,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    RETRIEVAL_K,
)
from backend.indexer import search_chunks

QA_PROMPT = ChatPromptTemplate.from_template(
    """你是一个专业的代码分析助手。请根据以下代码片段和调用链信息来回答用户的问题。

要求：
1. 用中文回答
2. 引用相关代码时，注明来源文件路径
3. 如果代码片段不足以回答问题，请如实说明
4. 尽量给出具体、有用的解释，包括函数名、变量名等关键信息
5. 按相关性从高到低组织回答
6. 利用调用链信息，帮助用户理解完整的执行流程
7. 对于复杂逻辑问题，画出函数调用关系

### 相关代码片段（按相关性排序）：
{context}

### 用户问题：
{question}

### 回答："""
)


def _get_llm():
    if LLM_PROVIDER == "openai":
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=OPENAI_MODEL,
            api_key=OPENAI_API_KEY,
            temperature=0,
        )
    elif LLM_PROVIDER == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=OLLAMA_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=0,
        )
    else:
        raise ValueError(f"Unsupported LLM_PROVIDER: {LLM_PROVIDER}")


def _format_chunks(chunks):
    formatted = []
    for i, chunk in enumerate(chunks, 1):
        source = chunk["metadata"].get("source", "unknown")
        lang = chunk["metadata"].get("language", "text")
        distance = chunk.get("distance", 0)
        relevance = max(0, round((1 - distance) * 100))

        boost_score = chunk.get("boost_score", 0)
        func_name = chunk["metadata"].get("func_name", "")
        calls = chunk["metadata"].get("calls", "")
        called_by = chunk["metadata"].get("called_by", "")

        header_parts = [
            f"[片段 {i}]",
            f"文件: {source}",
            f"语言: {lang}",
            f"相关度: {relevance}%",
        ]

        if boost_score > 0:
            header_parts.append(f"调用链增强: {round(boost_score * 100)}%")
        if func_name:
            header_parts.append(f"函数: {func_name}")
        if calls:
            header_parts.append(f"调用: {calls}")
        if called_by:
            header_parts.append(f"被调用: {called_by}")

        header = " | ".join(header_parts)
        formatted.append(f"{header}\n```\n{chunk['content']}\n```")
    return "\n\n".join(formatted)


def query(question: str, k: Optional[int] = None):
    chunks = search_chunks(question, k=k or RETRIEVAL_K)

    if not chunks:
        return {
            "answer": "未找到与您问题相关的代码片段。请尝试：\n1. 先建立索引\n2. 换个关键词搜索\n3. 检查代码目录是否正确",
            "sources": [],
            "num_chunks": 0,
        }

    context = _format_chunks(chunks)

    llm = _get_llm()
    chain = QA_PROMPT | llm | StrOutputParser()

    answer = chain.invoke({"context": context, "question": question})

    sources = []
    seen = set()
    for chunk in chunks:
        src = chunk["metadata"].get("source", "unknown")
        if src not in seen:
            seen.add(src)
            sources.append(src)

    return {
        "answer": answer,
        "sources": sources,
        "num_chunks": len(chunks),
    }


def search_only(question: str, k: Optional[int] = None):
    chunks = search_chunks(question, k=k or RETRIEVAL_K)
    results = []
    for chunk in chunks:
        results.append({
            "source": chunk["metadata"].get("source", "unknown"),
            "language": chunk["metadata"].get("language", "text"),
            "content": chunk["content"],
            "distance": chunk.get("distance", 0),
            "raw_distance": chunk.get("raw_distance", chunk.get("distance", 0)),
            "relevance": max(0, round((1 - chunk.get("distance", 0)) * 100)),
            "boost_score": chunk.get("boost_score", 0),
            "func_name": chunk["metadata"].get("func_name", ""),
            "calls": chunk["metadata"].get("calls", ""),
            "called_by": chunk["metadata"].get("called_by", ""),
        })
    return results
