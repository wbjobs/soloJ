import re
import hashlib
import unicodedata
from typing import List, Optional, Tuple
from pathlib import Path

import pdfplumber
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

from config import get_settings

settings = get_settings()


def get_embeddings():
    return HuggingFaceEmbeddings(
        model_name=settings.EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def get_llm():
    return ChatOllama(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.OLLAMA_MODEL,
        temperature=0.7,
    )


def _is_garbled(text: str) -> bool:
    if not text.strip():
        return True

    printable_chars = 0
    total_chars = 0

    for ch in text:
        if ch.isspace():
            continue
        total_chars += 1
        category = unicodedata.category(ch)
        if category.startswith('L') or category.startswith('N') or ch in '，。！？、；：""''（）【】《》':
            printable_chars += 1
        elif category == 'So':
            printable_chars += 1

    if total_chars == 0:
        return True

    ratio = printable_chars / total_chars
    if ratio < 0.6:
        return True

    control_or_surrogate = sum(
        1 for ch in text
        if unicodedata.category(ch).startswith('C') and not ch.isspace()
    )
    if control_or_surrogate > 3:
        return True

    return False


def _clean_text(text: str) -> str:
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {4,}', '   ', text)
    text = text.strip()
    return text


def _extract_table_text(table) -> str:
    if table is None:
        return ""
    rows = table.extract()
    if not rows:
        return ""

    cleaned_rows = []
    for row in rows:
        cleaned_row = []
        for cell in row:
            if cell is None:
                cleaned_row.append("")
            else:
                cleaned_row.append(str(cell).strip())
        cleaned_rows.append(cleaned_row)

    if not cleaned_rows:
        return ""

    col_widths = []
    for col_idx in range(len(cleaned_rows[0])):
        max_w = max(
            len(row[col_idx]) if col_idx < len(row) else 0
            for row in cleaned_rows
        )
        col_widths.append(max_w)

    lines = []
    for row_idx, row in enumerate(cleaned_rows):
        padded = []
        for col_idx, cell in enumerate(row):
            if col_idx < len(col_widths):
                padded.append(cell.ljust(col_widths[col_idx]))
            else:
                padded.append(cell)
        lines.append(" | ".join(padded))

        if row_idx == 0:
            sep_parts = []
            for w in col_widths:
                sep_parts.append("-" * w)
            lines.append("-+-".join(sep_parts))

    return "\n".join(lines)


class RAGEngine:
    def __init__(self):
        self.embeddings = get_embeddings()
        self.vectorstore_path = Path(settings.VECTORSTORE_PATH)
        self.upload_path = Path(settings.UPLOAD_PATH)
        self.vectorstore_path.mkdir(parents=True, exist_ok=True)
        self.upload_path.mkdir(parents=True, exist_ok=True)
        self.vectorstore = self._load_or_create_vectorstore()

    def _load_or_create_vectorstore(self) -> Optional[FAISS]:
        index_file = self.vectorstore_path / "index.faiss"
        if index_file.exists():
            return FAISS.load_local(
                str(self.vectorstore_path),
                self.embeddings,
                allow_dangerous_deserialization=True,
            )
        return None

    def _save_vectorstore(self):
        if self.vectorstore:
            self.vectorstore.save_local(str(self.vectorstore_path))

    def load_document(self, file_path: str) -> List[Document]:
        ext = Path(file_path).suffix.lower()
        if ext == ".pdf":
            return self._load_pdf_with_plumber(file_path)
        elif ext == ".txt":
            loader = TextLoader(file_path, encoding="utf-8")
            return loader.load()
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    def _load_pdf_with_plumber(self, file_path: str) -> List[Document]:
        documents = []
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                page_parts = []

                text_content = page.extract_text()
                if text_content and not _is_garbled(text_content):
                    cleaned = _clean_text(text_content)
                    if cleaned:
                        page_parts.append(cleaned)

                tables = page.find_tables()
                if tables:
                    for table in tables:
                        table_text = _extract_table_text(table)
                        if table_text:
                            page_parts.append(table_text)

                if not page_parts:
                    chars = page.chars
                    if chars:
                        raw_text = "".join(c["text"] for c in chars)
                        cleaned = _clean_text(raw_text)
                        if cleaned and not _is_garbled(cleaned):
                            page_parts.append(cleaned)

                full_text = "\n\n".join(page_parts)
                if full_text.strip():
                    doc = Document(
                        page_content=full_text,
                        metadata={
                            "source": Path(file_path).name,
                            "page": page_num,
                        },
                    )
                    documents.append(doc)

        return documents

    def _filter_chunks(self, chunks: List[Document]) -> List[Document]:
        filtered = []
        for chunk in chunks:
            text = chunk.page_content
            if _is_garbled(text):
                continue
            cleaned = _clean_text(text)
            if len(cleaned) < 20:
                continue
            chunk.page_content = cleaned
            filtered.append(chunk)
        return filtered

    def split_documents(self, documents: List[Document]) -> List[Document]:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""],
        )
        raw_chunks = text_splitter.split_documents(documents)
        return self._filter_chunks(raw_chunks)

    def add_documents(self, documents: List[Document]):
        if self.vectorstore is None:
            self.vectorstore = FAISS.from_documents(
                documents=documents,
                embedding=self.embeddings,
            )
        else:
            self.vectorstore.add_documents(documents)
        self._save_vectorstore()

    def ingest_file(self, file_path: str) -> Tuple[int, int, str]:
        documents = self.load_document(file_path)
        filename = Path(file_path).name
        for doc in documents:
            doc.metadata["source"] = filename
        total_raw = len(documents)
        chunks = self.split_documents(documents)
        self.add_documents(chunks)
        return len(chunks), total_raw, filename

    def get_retriever(self):
        if self.vectorstore is None:
            return None
        return self.vectorstore.as_retriever(
            search_kwargs={"k": settings.RETRIEVE_TOP_K}
        )

    def get_context_docs(self, query: str) -> List[Document]:
        if self.vectorstore is None:
            return []
        return self.vectorstore.similarity_search(query, k=settings.RETRIEVE_TOP_K)

    def _generate_chunk_id(self, content: str, source: str, page: int) -> str:
        raw = f"{source}_{page}_{content[:100]}"
        return hashlib.md5(raw.encode('utf-8')).hexdigest()[:16]

    def format_docs_with_ids(self, docs: List[Document]) -> Tuple[str, dict]:
        id_mapping = {}
        formatted_parts = []
        for idx, doc in enumerate(docs):
            source = doc.metadata.get('source', '未知')
            page = doc.metadata.get('page', 0)
            chunk_id = self._generate_chunk_id(doc.page_content, source, page)
            id_mapping[chunk_id] = {
                'content': doc.page_content,
                'source': source,
                'page': page,
                'chunk_id': chunk_id,
                'index': idx + 1,
            }
            formatted_parts.append(
                f"[片段 {idx + 1} | ID: {chunk_id} | 来源: {source} | 第 {page} 页]\n{doc.page_content}"
            )
        return "\n\n".join(formatted_parts), id_mapping

    def build_rag_chain_with_ids(self):
        llm = get_llm()

        prompt = ChatPromptTemplate.from_template(
            """你是一个专业的知识库助手，请根据以下检索到的上下文片段回答用户的问题。

检索到的上下文（每个片段有唯一 ID）：
{context}

用户的问题：{question}

回答要求：
1. 只使用上下文片段中提供的信息来回答问题
2. 如果上下文没有提供相关信息，明确告知用户"知识库中没有找到相关信息"
3. 回答要准确、简洁、有逻辑
4. **关键要求**：在你引用上下文片段中的关键句子、数据或事实后，必须立即插入上标标记，格式为 [ID]，其中 ID 是该片段的 ID（如 [a1b2c3d4]）
   - 示例：根据报告数据，2023年营收增长了15%[a1b2c3d4e5f6789]。
   - 示例：该方案的实施周期为3个月[xyz78901abcdef]。
5. 多个引用可以连续标记：如增长率为8%[id1]，市场份额达25%[id2]。
6. 确保标记紧跟在引用内容后面，不要使用传统的 [1][2] 数字编号，必须使用上下文片段中的完整 ID。
7. 在回答末尾不再单独列出参考文献，上标标记已经提供了溯源信息。
"""
        )

        chain = (
            {"context": RunnablePassthrough(), "question": RunnablePassthrough()}
            | prompt
            | llm
            | StrOutputParser()
        )
        return chain

    def chat(self, question: str) -> Tuple[str, List[dict]]:
        docs = self.get_context_docs(question)

        if not docs:
            return (
                "知识库中没有找到相关信息，请先上传文档。",
                [],
            )

        formatted_context, id_mapping = self.format_docs_with_ids(docs)
        sources_list = list(id_mapping.values())

        rag_chain = self.build_rag_chain_with_ids()
        if rag_chain is None:
            return (
                "知识库为空，请先上传文档。",
                [],
            )

        answer = rag_chain.invoke({
            "context": formatted_context,
            "question": question,
        })
        return answer, sources_list

    async def chat_stream(self, question: str):
        docs = self.get_context_docs(question)

        if not docs:
            yield {
                "type": "sources",
                "data": [],
            }
            yield {
                "type": "answer",
                "data": "知识库中没有找到相关信息，请先上传文档。",
            }
            yield {"type": "done"}
            return

        formatted_context, id_mapping = self.format_docs_with_ids(docs)
        sources_list = list(id_mapping.values())

        yield {
            "type": "sources",
            "data": sources_list,
        }

        rag_chain = self.build_rag_chain_with_ids()
        if rag_chain is None:
            yield {
                "type": "answer",
                "data": "知识库为空，请先上传文档。",
            }
            yield {"type": "done"}
            return

        async for chunk in rag_chain.astream({
            "context": formatted_context,
            "question": question,
        }):
            yield {
                "type": "token",
                "data": chunk,
            }

        yield {"type": "done"}

    def get_document_count(self) -> int:
        if self.vectorstore is None:
            return 0
        return self.vectorstore.index.ntotal

    def list_uploaded_files(self) -> List[str]:
        if not self.upload_path.exists():
            return []
        return [
            f.name
            for f in self.upload_path.iterdir()
            if f.is_file() and f.suffix.lower() in [".pdf", ".txt"]
        ]

    def get_document_full_text(self, filename_with_uuid: str) -> List[dict]:
        file_path = self.upload_path / filename_with_uuid
        if not file_path.exists():
            return []

        try:
            documents = self.load_document(str(file_path))
        except Exception:
            return []

        result = []
        for page_num, doc in enumerate(documents):
            chunks = []
            try:
                from langchain_text_splitters import RecursiveCharacterTextSplitter
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=settings.CHUNK_SIZE,
                    chunk_overlap=settings.CHUNK_OVERLAP,
                    separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""],
                )
                page_chunks = splitter.split_text(doc.page_content)
                for chunk_idx, chunk_text in enumerate(page_chunks):
                    chunk_id = self._generate_chunk_id(
                        chunk_text,
                        doc.metadata.get('source', filename_with_uuid),
                        page_num,
                    )
                    chunks.append({
                        'chunk_id': chunk_id,
                        'content': chunk_text,
                        'page': doc.metadata.get('page', page_num),
                        'index': chunk_idx,
                    })
            except Exception:
                pass

            result.append({
                'page': doc.metadata.get('page', page_num),
                'source': doc.metadata.get('source', filename_with_uuid),
                'content': doc.page_content,
                'chunks': chunks,
            })

        return result

    def clear_vectorstore(self):
        if self.vectorstore_path.exists():
            for f in self.vectorstore_path.iterdir():
                if f.is_file():
                    f.unlink()
        self.vectorstore = None


rag_engine = RAGEngine()
