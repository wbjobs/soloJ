import os
import re
import time
from pathlib import Path
from typing import Optional, List, Tuple, Dict
from dataclasses import dataclass, field
import chromadb
from chromadb.config import Settings as ChromaSettings

from backend.config import (
    CODE_DIR,
    CHROMA_PERSIST_DIR,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    SUPPORTED_EXTENSIONS,
    STRIP_COMMENTS,
    MIN_CHUNK_LINES,
    MAX_COMMENT_RATIO,
    EMBEDDING_BATCH_SIZE,
    RETRIEVAL_DISTANCE_THRESHOLD,
)

try:
    from backend.ast_analyzer import CallGraph, analyze_directory
    AST_ANALYSIS_ENABLED = True
except Exception:
    AST_ANALYSIS_ENABLED = False


@dataclass
class Document:
    page_content: str
    metadata: dict


LANGUAGE_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".jsx": "javascript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".sh": "bash",
    ".bash": "bash",
    ".sql": "sql",
    ".css": "css",
    ".scss": "css",
    ".less": "css",
    ".html": "html",
    ".vue": "html",
    ".svelte": "html",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
    ".xml": "xml",
    ".toml": "toml",
    ".md": "markdown",
    ".txt": "text",
    ".rst": "text",
    ".ini": "ini",
    ".cfg": "ini",
}

HASH_COMMENT_LANGS = {"python", "ruby", "bash", "yaml", "toml", "ini", "rust", "sql", "swift", "kotlin", "scala"}
DOUBLE_SLASH_COMMENT_LANGS = {"javascript", "typescript", "java", "cpp", "c", "csharp", "go", "php", "css", "html"}
NO_COMMENT_LANGS = {"json", "text", "markdown"}


def _strip_single_line_comments(content: str, language: str) -> str:
    if language in NO_COMMENT_LANGS:
        return content

    lines = content.split("\n")
    cleaned = []

    for line in lines:
        stripped = line

        if language in HASH_COMMENT_LANGS:
            match = re.match(r'^(\s*)#', stripped)
            if match and not re.search(r'["\'].*#.*["\']', stripped):
                cleaned.append("")
                continue
            stripped = re.sub(r'\s*#(?!=).*$', '', stripped)
            if re.search(r'["\'].*#.*["\']', line):
                stripped = line

        elif language in DOUBLE_SLASH_COMMENT_LANGS:
            match = re.match(r'^\s*//', stripped)
            if match:
                cleaned.append("")
                continue
            if language == "css":
                stripped = re.sub(r'/\*.*?\*/', '', stripped)
            elif language in ("html",):
                pass
            else:
                stripped = re.sub(r'(?<!:)//(?![/"]).*$', '', stripped)

        elif language == "php":
            if re.match(r'^\s*//', stripped) or re.match(r'^\s*#', stripped):
                cleaned.append("")
                continue

        cleaned.append(stripped)

    return "\n".join(cleaned)


def _strip_block_comments(content: str, language: str) -> str:
    if language in NO_COMMENT_LANGS or language in HASH_COMMENT_LANGS:
        if language == "rust":
            pass
        else:
            return content

    if language == "python" or language == "ruby" or language == "bash":
        docstring_pattern = r'(?:^|\n)\s*(?:"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\')'
        content = re.sub(docstring_pattern, '\n', content)
        return content

    block_pattern = r'/\*[\s\S]*?\*/'
    content = re.sub(block_pattern, '\n', content)

    if language in ("html", "vue", "svelte"):
        html_comment_pattern = r'<!--[\s\S]*?-->'
        content = re.sub(html_comment_pattern, '\n', content)

    return content


def _compress_blank_lines(content: str) -> str:
    content = re.sub(r'\n{3,}', '\n\n', content)
    lines = content.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.rstrip()
        cleaned.append(stripped)
    result = "\n".join(cleaned)
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result.strip()


def _preprocess_code(content: str, language: str) -> str:
    if not STRIP_COMMENTS:
        return _compress_blank_lines(content)

    content = _strip_block_comments(content, language)
    content = _strip_single_line_comments(content, language)
    content = _compress_blank_lines(content)
    return content


def _compute_comment_ratio(content: str, language: str) -> float:
    if not content.strip():
        return 1.0
    lines = content.split("\n")
    non_empty = [l for l in lines if l.strip()]
    if not non_empty:
        return 1.0

    comment_lines = 0
    for line in non_empty:
        s = line.strip()
        if language in HASH_COMMENT_LANGS and s.startswith("#"):
            comment_lines += 1
        elif language in DOUBLE_SLASH_COMMENT_LANGS and (s.startswith("//") or s.startswith("/*") or s.startswith("*")):
            comment_lines += 1
        elif language == "html" and s.startswith("<!--"):
            comment_lines += 1

    return comment_lines / len(non_empty)


def _is_quality_chunk(content: str, language: str) -> Tuple[bool, float]:
    if not content.strip():
        return False, 1.0

    lines = content.split("\n")
    non_empty_lines = [l for l in lines if l.strip()]

    if len(non_empty_lines) < MIN_CHUNK_LINES:
        return False, 0.0

    ratio = _compute_comment_ratio(content, language)
    if ratio > MAX_COMMENT_RATIO:
        return False, ratio

    code_chars = sum(len(l) for l in non_empty_lines)
    total_chars = len(content)
    if total_chars > 0 and code_chars / total_chars < 0.3:
        return False, ratio

    return True, ratio


def _get_chroma_client():
    return chromadb.PersistentClient(
        path=CHROMA_PERSIST_DIR,
        settings=ChromaSettings(
            anonymized_telemetry=False,
            allow_reset=True,
        ),
    )


def _split_by_functions(content: str, language: str) -> List[str]:
    if language == "python":
        pattern = r'(?:^|\n)(?=(?:async\s+)?def\s+\w+\s*\(|class\s+\w+)'
    elif language in ("javascript", "typescript"):
        pattern = r'(?:^|\n)(?=(?:export\s+)?(?:async\s+)?function\s+\w+|(?:export\s+)?const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function)|(?:export\s+)?class\s+\w+)'
    elif language in ("java", "kotlin", "scala"):
        pattern = r'(?:^|\n)(?=(?:public|private|protected|static|\s)+\s+\w+\s+\w+\s*\(|class\s+\w+)'
    elif language == "go":
        pattern = r'(?:^|\n)(?=func\s+\w+|type\s+\w+\s+struct)'
    elif language == "rust":
        pattern = r'(?:^|\n)(?=(?:pub\s+)?(?:async\s+)?fn\s+\w+|struct\s+\w+|impl\s+)'
    elif language in ("c", "cpp", "h", "hpp"):
        pattern = r'(?:^|\n)(?=\w+\s+\w+\s*\(|class\s+\w+)'
    else:
        return [content]

    if not re.search(pattern, content):
        return [content]

    split_positions = [m.start() for m in re.finditer(pattern, content)]
    if len(split_positions) <= 1:
        return [content]

    chunks = []
    for i, start in enumerate(split_positions):
        end = split_positions[i + 1] if i + 1 < len(split_positions) else len(content)
        chunk = content[start:end].strip()
        if chunk:
            chunks.append(chunk)

    return chunks if len(chunks) > 1 else [content]


def _simple_split(content: str, chunk_size: int, overlap: int) -> List[str]:
    if len(content) <= chunk_size:
        return [content]

    chunks = []
    start = 0
    while start < len(content):
        end = min(start + chunk_size, len(content))

        if end < len(content):
            last_newline = content.rfind("\n", start + chunk_size // 2, end)
            if last_newline > start:
                end = last_newline

        chunk = content[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start = end - overlap if end < len(content) else len(content)

    return chunks


def _split_document(
    doc: Document, chunk_size: int, overlap: int, call_graph: Optional[CallGraph] = None
) -> List[Document]:
    content = doc.page_content
    language = doc.metadata.get("language", "text")
    source_file = doc.metadata.get("source", "")
    chunks = []

    func_chunks = _split_by_functions(content, language)
    for func_chunk in func_chunks:
        if len(func_chunk) <= chunk_size:
            sub_chunks = [func_chunk]
        else:
            sub_chunks = _simple_split(func_chunk, chunk_size, overlap)

        for sc in sub_chunks:
            is_quality, ratio = _is_quality_chunk(sc, language)
            if is_quality:
                chunk_meta = doc.metadata.copy()
                chunk_meta["comment_ratio"] = round(ratio, 2)
                chunk_meta["line_count"] = len([l for l in sc.split("\n") if l.strip()])

                if call_graph and language == "python" and source_file:
                    related_funcs = _find_related_functions(call_graph, source_file, sc)
                    if related_funcs:
                        chunk_meta["calls"] = ",".join(related_funcs.get("calls", [])[:5])
                        chunk_meta["called_by"] = ",".join(related_funcs.get("called_by", [])[:5])
                        chunk_meta["func_name"] = related_funcs.get("func_name", "")
                        if related_funcs.get("call_chain"):
                            chunk_meta["call_chain"] = related_funcs["call_chain"]

                chunks.append(Document(page_content=sc, metadata=chunk_meta))

    if not chunks:
        for sc in _simple_split(content, chunk_size, overlap):
            is_quality, ratio = _is_quality_chunk(sc, language)
            if is_quality:
                chunk_meta = doc.metadata.copy()
                chunk_meta["comment_ratio"] = round(ratio, 2)
                chunk_meta["line_count"] = len([l for l in sc.split("\n") if l.strip()])
                chunks.append(Document(page_content=sc, metadata=chunk_meta))

    return chunks


def _find_related_functions(call_graph: CallGraph, source_file: str, chunk_content: str) -> Dict:
    result = {"calls": [], "called_by": [], "func_name": "", "call_chain": ""}

    func_candidates = []
    for qname, func in call_graph.all_functions.items():
        if not qname.startswith(source_file + ":"):
            continue
        if func.name in chunk_content and func.start_line:
            func_candidates.append((qname, func))

    if not func_candidates:
        return result

    best_match = None
    best_score = 0
    for qname, func in func_candidates:
        score = chunk_content.count(f"def {func.name}(") + chunk_content.count(f"async def {func.name}(")
        if score > best_score:
            best_score = score
            best_match = (qname, func)

    if best_match:
        qname, func = best_match
        result["func_name"] = func.full_name
        calls_list = list(func.calls)
        called_by_list = list(func.called_by)
        result["calls"] = [c.split(":")[-1] for c in calls_list if ":" in c][:5]
        result["called_by"] = [c.split(":")[-1] for c in called_by_list if ":" in c][:5]

        chain_parts = []
        if result["calls"]:
            chain_parts.append(f"calls: {', '.join(result['calls'][:3])}")
        if result["called_by"]:
            chain_parts.append(f"called by: {', '.join(result['called_by'][:3])}")
        result["call_chain"] = "; ".join(chain_parts)

    return result


def _load_documents(code_dir: Path):
    documents = []
    for root, _dirs, files in os.walk(code_dir):
        root_path = Path(root)
        skip_dirs = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".idea", ".vscode"}
        _dirs[:] = [d for d in _dirs if d not in skip_dirs]

        for fname in files:
            fpath = root_path / fname
            if fpath.suffix not in SUPPORTED_EXTENSIONS:
                continue
            rel_path = fpath.relative_to(code_dir)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    raw_content = f.read()
                if not raw_content.strip():
                    continue

                language = LANGUAGE_MAP.get(fpath.suffix, "text")
                processed = _preprocess_code(raw_content, language)

                if not processed.strip():
                    print(f"[indexer] skip {rel_path}: empty after preprocessing")
                    continue

                doc = Document(
                    page_content=processed,
                    metadata={
                        "source": str(rel_path).replace("\\", "/"),
                        "language": language,
                    },
                )
                documents.append(doc)
            except Exception as e:
                print(f"[indexer] skip {rel_path}: {e}")
    return documents


def _split_documents(documents, call_graph: Optional[CallGraph] = None):
    chunks = []
    total_skipped = 0
    for doc in documents:
        doc_chunks = _split_document(doc, CHUNK_SIZE, CHUNK_OVERLAP, call_graph)
        total_skipped += len(_simple_split(doc.page_content, CHUNK_SIZE, CHUNK_OVERLAP)) - len(doc_chunks)
        chunks.extend(doc_chunks)
    if total_skipped > 0:
        print(f"[indexer] Filtered out {total_skipped} low-quality chunks")
    return chunks


def _add_batch_with_retry(collection, docs, metadatas, ids, batch_idx, max_retries=3):
    for attempt in range(max_retries):
        try:
            collection.add(
                documents=docs,
                metadatas=metadatas,
                ids=ids,
            )
            return True
        except Exception as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 5
                print(f"[indexer] Batch {batch_idx} failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait}s...")
                time.sleep(wait)
            else:
                print(f"[indexer] Batch {batch_idx} failed after {max_retries} attempts: {e}")
                raise


def index_code(code_dir: Optional[str] = None):
    target_dir = Path(code_dir) if code_dir else CODE_DIR
    if not target_dir.exists():
        raise FileNotFoundError(f"Code directory not found: {target_dir}")

    call_graph = None
    if AST_ANALYSIS_ENABLED:
        print(f"[indexer] Analyzing AST and building call graph ...")
        call_graph = analyze_directory(target_dir)
        summary = call_graph.summarize()
        print(f"[indexer] Call graph: {summary['total_functions']} functions, {summary['total_classes']} classes")

    print(f"[indexer] Loading documents from {target_dir} ...")
    documents = _load_documents(target_dir)
    if not documents:
        raise ValueError(f"No supported code files found in {target_dir}")

    print(f"[indexer] Loaded {len(documents)} documents, splitting ...")
    chunks = _split_documents(documents, call_graph)

    chunks_with_cg = sum(1 for c in chunks if c.metadata.get("call_chain"))
    print(f"[indexer] Split into {len(chunks)} quality chunks ({chunks_with_cg} with call graph info)")

    client = _get_chroma_client()

    try:
        client.delete_collection("code_rag")
    except Exception:
        pass

    collection = client.get_or_create_collection(
        name="code_rag",
        metadata={"hnsw:space": "cosine"},
    )

    batch_size = EMBEDDING_BATCH_SIZE
    total = len(chunks)
    print(f"[indexer] Embedding and storing in ChromaDB (batch_size={batch_size}) ...")

    for i in range(0, total, batch_size):
        batch = chunks[i : i + batch_size]
        docs = [doc.page_content for doc in batch]
        metas = [doc.metadata for doc in batch]
        ids = [f"chunk_{j + i}" for j in range(len(batch))]

        batch_idx = i // batch_size + 1
        total_batches = (total + batch_size - 1) // batch_size

        _add_batch_with_retry(collection, docs, metas, ids, batch_idx)
        print(f"[indexer] Batch {batch_idx}/{total_batches} - Processed {min(i + batch_size, total)}/{total} chunks")

    print("[indexer] Indexing complete!")
    return len(chunks)


def search_chunks(query: str, k: int = 5, code_dir: Optional[str] = None):
    client = _get_chroma_client()
    try:
        collection = client.get_collection("code_rag")
    except Exception:
        raise ValueError("Index not found. Please run indexing first.")

    results = collection.query(
        query_texts=[query],
        n_results=k * 6,
        include=["documents", "metadatas", "distances"],
    )

    docs = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    query_keywords = _extract_query_keywords(query)

    qualified = []
    for doc, meta, dist in zip(docs, metadatas, distances):
        if dist <= RETRIEVAL_DISTANCE_THRESHOLD:
            boost_score = _calculate_call_chain_boost(query_keywords, meta)
            adjusted_distance = dist * (1 - boost_score * 0.3)
            qualified.append({
                "content": doc,
                "metadata": meta,
                "distance": adjusted_distance,
                "raw_distance": dist,
                "boost_score": boost_score,
            })

    qualified.sort(key=lambda x: x["distance"])

    boosted = sum(1 for x in qualified if x["boost_score"] > 0)
    if boosted > 0:
        print(f"[search] Boosted {boosted} chunks by call chain relevance")

    seen_sources = set()
    unique_chunks = []
    for item in qualified:
        src = item["metadata"].get("source", "unknown")
        if src not in seen_sources or len(unique_chunks) < k:
            unique_chunks.append(item)
            if src not in seen_sources:
                seen_sources.add(src)
        if len(unique_chunks) >= k:
            break

    return unique_chunks


def _extract_query_keywords(query: str) -> List[str]:
    keywords = []

    func_pattern = r'\b(?:function\s+|def\s+|async\s+def\s+)(\w+)|(\w+)\(\)'
    for match in re.finditer(func_pattern, query):
        name = match.group(1) or match.group(2)
        if name:
            keywords.append(name.lower())

    words = re.findall(r'\b[a-zA-Z_]\w*\b', query)
    common_words = {"the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
                    "have", "has", "had", "do", "does", "did", "will", "would", "could",
                    "should", "may", "might", "must", "shall", "can", "need", "dare",
                    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
                    "from", "up", "about", "into", "over", "after", "and", "but", "or",
                    "as", "if", "when", "than", "because", "while", "although", "though",
                    "where", "what", "which", "who", "whom", "whose", "how", "why", "when",
                    "login", "log", "auth", "authenticate", "user", "db", "database", "get",
                    "set", "find", "query", "search", "where", "what", "which"}

    for word in words:
        if len(word) >= 3 and word.lower() not in common_words:
            keywords.append(word.lower())

    return list(set(keywords))


def _calculate_call_chain_boost(keywords: List[str], meta: dict) -> float:
    if not keywords:
        return 0.0

    boost_score = 0.0
    calls_str = meta.get("calls", "") or ""
    called_by_str = meta.get("called_by", "") or ""
    func_name = meta.get("func_name", "") or ""
    call_chain = meta.get("call_chain", "") or ""

    call_list = [c.strip().lower() for c in calls_str.split(",") if c.strip()]
    called_by_list = [c.strip().lower() for c in called_by_str.split(",") if c.strip()]

    for kw in keywords:
        if func_name and kw in func_name.lower():
            boost_score += 0.5

        for c in call_list:
            if kw in c:
                boost_score += 0.3

        for c in called_by_list:
            if kw in c:
                boost_score += 0.25

        if call_chain and kw in call_chain.lower():
            boost_score += 0.2

    return min(boost_score, 1.0)
