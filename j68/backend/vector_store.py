import os
import re
import json
import pickle
import time
import numpy as np
import faiss
from typing import List, Dict, Optional, Tuple
from collections import OrderedDict
import ssl

try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

os.environ.setdefault('HF_ENDPOINT', 'https://hf-mirror.com')
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['REQUESTS_CA_BUNDLE'] = ''
os.environ['HF_HUB_DISABLE_SSL'] = 'true'

import httpx
original_client_init = httpx.Client.__init__
def patched_client_init(self, *args, **kwargs):
    kwargs['verify'] = False
    return original_client_init(self, *args, **kwargs)
httpx.Client.__init__ = patched_client_init

original_async_client_init = httpx.AsyncClient.__init__
def patched_async_client_init(self, *args, **kwargs):
    kwargs['verify'] = False
    return original_async_client_init(self, *args, **kwargs)
httpx.AsyncClient.__init__ = patched_async_client_init

from sentence_transformers import SentenceTransformer

VECTOR_STORE_DIR = "vector_store"
INDEX_FILE = os.path.join(VECTOR_STORE_DIR, "faiss_index.bin")
METADATA_FILE = os.path.join(VECTOR_STORE_DIR, "metadata.pkl")
MODEL_NAME = "all-MiniLM-L6-v2"
QUERY_CACHE_SIZE = 1000

STOP_WORDS_ZH = {'的', '了', '是', '在', '有', '和', '与', '或', '不', '也', '都',
                  '还', '而', '但', '这', '那', '个', '一', '很', '被', '把', '吗',
                  '呢', '吧', '啊', '呀', '么', '什么', '怎么', '如何', '哪些', '为什么'}
STOP_WORDS_EN = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
                  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
                  'would', 'could', 'should', 'may', 'might', 'shall', 'can',
                  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
                  'as', 'into', 'about', 'it', 'its', 'and', 'or', 'but',
                  'not', 'no', 'what', 'which', 'who', 'how', 'why', 'when',
                  'where', 'that', 'this', 'these', 'those'}
STOP_WORDS = STOP_WORDS_ZH | STOP_WORDS_EN


class LRUCache:
    def __init__(self, capacity: int = 1000):
        self.cache = OrderedDict()
        self.capacity = capacity
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[np.ndarray]:
        if key in self.cache:
            self.cache.move_to_end(key)
            self.hits += 1
            return self.cache[key]
        self.misses += 1
        return None

    def put(self, key: str, value: np.ndarray):
        if key in self.cache:
            self.cache.move_to_end(key)
        else:
            if len(self.cache) >= self.capacity:
                self.cache.popitem(last=False)
        self.cache[key] = value

    def stats(self) -> Dict:
        total = self.hits + self.misses
        hit_rate = self.hits / total if total > 0 else 0
        return {
            'size': len(self.cache),
            'capacity': self.capacity,
            'hits': self.hits,
            'misses': self.misses,
            'hit_rate': hit_rate
        }


class VectorStore:
    def __init__(self):
        self.model = None
        self.index = None
        self.metadata = []
        self.dimension = 384
        self.query_cache = LRUCache(QUERY_CACHE_SIZE)
        self._load_model()
        self._load_or_create_index()

    def _load_model(self):
        print(f"Loading model: {MODEL_NAME}...")
        print(f"Using HF endpoint: {os.environ.get('HF_ENDPOINT')}")
        try:
            self.model = SentenceTransformer(MODEL_NAME)
        except Exception as e:
            print(f"Failed to load from default source, trying mirror...")
            os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
            self.model = SentenceTransformer(MODEL_NAME)
        print("Model loaded successfully.")

    def _load_or_create_index(self):
        os.makedirs(VECTOR_STORE_DIR, exist_ok=True)
        if os.path.exists(INDEX_FILE) and os.path.exists(METADATA_FILE):
            print("Loading existing vector store...")
            self.index = faiss.read_index(INDEX_FILE)
            with open(METADATA_FILE, 'rb') as f:
                self.metadata = pickle.load(f)
            print(f"Loaded {len(self.metadata)} documents.")
        else:
            print("Creating new vector store...")
            self.index = faiss.IndexFlatL2(self.dimension)
            self.metadata = []

    def _save_index(self):
        faiss.write_index(self.index, INDEX_FILE)
        with open(METADATA_FILE, 'wb') as f:
            pickle.dump(self.metadata, f)

    def _split_sentences(self, text: str) -> List[Dict]:
        """
        Split text into sentences with line number tracking.
        Returns list of {'text': str, 'line': int}
        """
        text = re.sub(r'\r\n', '\n', text)
        result = []

        for line_idx, line in enumerate(text.split('\n'), 1):
            line = line.strip()
            if not line:
                continue

            para_sentences = re.split(r'(?<=[。！？.!?])\s*', line)
            para_sentences = [s.strip() for s in para_sentences if s.strip()]

            for sent in para_sentences:
                if len(sent) > 512:
                    sub_sents = re.split(r'(?<=[,，;；])\s*', sent)
                    sub_sents = [s.strip() for s in sub_sents if s.strip()]
                    for sub in sub_sents:
                        result.append({'text': sub, 'line': line_idx})
                else:
                    result.append({'text': sent, 'line': line_idx})

        return result

    def _chunk_text(self, text: str, chunk_size: int = 512, overlap: int = 128) -> List[Dict]:
        """
        Split text into chunks with line number tracking.
        Returns list of {'text': str, 'start_line': int, 'end_line': int}
        """
        sentences = self._split_sentences(text)
        if not sentences:
            return []

        chunks = []
        current_chunk = []
        current_length = 0

        i = 0
        while i < len(sentences):
            sent = sentences[i]
            sent_text = sent['text']
            sent_len = len(sent_text.split())

            if current_length + sent_len <= chunk_size:
                current_chunk.append(sent)
                current_length += sent_len
                i += 1
            else:
                if current_chunk:
                    chunk_text = ' '.join(s['text'] for s in current_chunk)
                    start_line = current_chunk[0]['line']
                    end_line = current_chunk[-1]['line']
                    chunks.append({
                        'text': chunk_text,
                        'start_line': start_line,
                        'end_line': end_line
                    })

                    overlap_sents = []
                    overlap_len = 0
                    for j in range(len(current_chunk) - 1, -1, -1):
                        prev_len = len(current_chunk[j]['text'].split())
                        if overlap_len + prev_len <= overlap:
                            overlap_sents.insert(0, current_chunk[j])
                            overlap_len += prev_len
                        else:
                            break

                    current_chunk = overlap_sents
                    current_length = overlap_len
                else:
                    chunk_text = ' '.join(sent_text.split()[:chunk_size])
                    chunks.append({
                        'text': chunk_text,
                        'start_line': sent['line'],
                        'end_line': sent['line']
                    })
                    i += 1

        if current_chunk:
            chunk_text = ' '.join(s['text'] for s in current_chunk)
            start_line = current_chunk[0]['line']
            end_line = current_chunk[-1]['line']
            chunks.append({
                'text': chunk_text,
                'start_line': start_line,
                'end_line': end_line
            })

        return chunks

    def add_document(self, file_name: str, text: str, chunk_size: int = 512) -> int:
        chunks = self._chunk_text(text, chunk_size)
        if not chunks:
            return 0

        existing_count = self._get_document_chunk_count(file_name)
        if existing_count > 0:
            self._remove_document(file_name)

        chunk_texts = [c['text'] for c in chunks]
        embeddings = self.model.encode(chunk_texts, convert_to_numpy=True, show_progress_bar=True)
        embeddings = embeddings.astype('float32')

        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)

        self.index.add(embeddings)

        for i, chunk in enumerate(chunks):
            self.metadata.append({
                'file_name': file_name,
                'chunk_index': i,
                'text': chunk['text'],
                'start_line': chunk['start_line'],
                'end_line': chunk['end_line'],
                'total_chunks': len(chunks)
            })

        self._save_index()
        print(f"Added {len(chunks)} chunks from {file_name}")
        return len(chunks)

    def _get_document_chunk_count(self, file_name: str) -> int:
        return sum(1 for m in self.metadata if m['file_name'] == file_name)

    def _remove_document(self, file_name: str):
        indices_to_remove = [i for i, m in enumerate(self.metadata) if m['file_name'] == file_name]
        if not indices_to_remove:
            return

        new_metadata = [m for i, m in enumerate(self.metadata) if i not in indices_to_remove]

        if self.index.ntotal > 0:
            all_vectors = self.index.reconstruct_n(0, self.index.ntotal)
            keep_indices = [i for i in range(self.index.ntotal) if i not in indices_to_remove]
            if keep_indices:
                new_vectors = all_vectors[keep_indices]
                self.index = faiss.IndexFlatL2(self.dimension)
                self.index.add(new_vectors.astype('float32'))
            else:
                self.index = faiss.IndexFlatL2(self.dimension)

        self.metadata = new_metadata
        self._save_index()

    def _extract_keywords(self, query: str) -> List[str]:
        keywords = re.split(r'[\s,，。！？.!?;；：:、？?]+', query)
        keywords = [w for w in keywords if w and w.lower() not in STOP_WORDS and len(w) >= 1]
        return keywords

    def _merge_highlights(self, highlights: List[Dict]) -> List[Dict]:
        if not highlights:
            return []
        highlights.sort(key=lambda h: h['start'])
        merged = [{'start': highlights[0]['start'], 'end': highlights[0]['end']}]
        for h in highlights[1:]:
            if h['start'] <= merged[-1]['end']:
                merged[-1]['end'] = max(merged[-1]['end'], h['end'])
            else:
                merged.append({'start': h['start'], 'end': h['end']})
        return merged

    def compute_highlights(self, query: str, text: str, query_embedding: np.ndarray = None) -> List[Dict]:
        keywords = self._extract_keywords(query)
        if not keywords:
            return []

        highlights = []
        text_lower = text.lower()

        for kw in keywords:
            kw_lower = kw.lower()
            if not kw_lower:
                continue
            start = 0
            while True:
                pos = text_lower.find(kw_lower, start)
                if pos == -1:
                    break
                highlights.append({'start': pos, 'end': pos + len(kw)})
                start = pos + 1

        for kw in keywords:
            kw_lower = kw.lower()
            if len(kw_lower) < 2:
                continue
            for n in range(min(len(kw_lower), 4), 1, -1):
                for j in range(len(kw_lower) - n + 1):
                    ngram = kw_lower[j:j + n]
                    if len(ngram) < 2:
                        continue
                    start = 0
                    while True:
                        pos = text_lower.find(ngram, start)
                        if pos == -1:
                            break
                        covered = any(h['start'] <= pos and h['end'] >= pos + len(ngram)
                                      for h in highlights)
                        if not covered:
                            highlights.append({'start': pos, 'end': pos + len(ngram)})
                        start = pos + 1

        if query_embedding is not None:
            token_infos = []
            for match in re.finditer(r'[\u4e00-\u9fff]{2,8}|[a-zA-Z]{2,}', text):
                token_text = match.group()
                token_start = match.start()
                token_end = match.end()
                covered = any(h['start'] <= token_start and h['end'] >= token_end
                              for h in highlights)
                if not covered:
                    token_infos.append({
                        'text': token_text,
                        'start': token_start,
                        'end': token_end
                    })

            if token_infos:
                token_texts = [t['text'] for t in token_infos]
                try:
                    token_embeddings = self.model.encode(token_texts, convert_to_numpy=True,
                                                         show_progress_bar=False)
                    token_embeddings = token_embeddings.astype('float32')
                    query_emb = query_embedding.flatten()
                    scored = []
                    for i, t in enumerate(token_infos):
                        tok_emb = token_embeddings[i]
                        sim = float(np.dot(query_emb, tok_emb) /
                                    (np.linalg.norm(query_emb) * np.linalg.norm(tok_emb) + 1e-8))
                        scored.append((sim, t))
                    scored.sort(key=lambda x: x[0], reverse=True)
                    max_semantic = 5
                    count = 0
                    for sim, t in scored:
                        if sim >= 0.55 and count < max_semantic:
                            highlights.append({'start': t['start'], 'end': t['end']})
                            count += 1
                        else:
                            break
                except Exception as e:
                    print(f"Semantic highlight error: {e}")

        return self._merge_highlights(highlights)

    def search(self, query: str, top_k: int = 5) -> Tuple[List[Dict], Dict]:
        perf_stats = {
            'cache_hit': False,
            'total_time': 0.0,
            'encoding_time': 0.0,
            'search_time': 0.0,
            'highlight_time': 0.0
        }

        if self.index.ntotal == 0:
            return [], perf_stats

        total_start = time.time()

        cache_key = query.strip().lower()
        cached = self.query_cache.get(cache_key)
        if cached is not None:
            perf_stats['cache_hit'] = True
            query_embedding = cached
        else:
            enc_start = time.time()
            query_embedding = self.model.encode([query], convert_to_numpy=True, show_progress_bar=False)
            query_embedding = query_embedding.astype('float32')
            perf_stats['encoding_time'] = time.time() - enc_start
            self.query_cache.put(cache_key, query_embedding)

        search_start = time.time()
        k = min(top_k, self.index.ntotal)
        distances, indices = self.index.search(query_embedding, k)
        perf_stats['search_time'] = time.time() - search_start

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < len(self.metadata):
                meta = self.metadata[idx]
                similarity = float(1.0 / (1.0 + dist))
                result_item = {
                    'file_name': meta['file_name'],
                    'text': meta['text'],
                    'similarity': similarity,
                    'chunk_index': meta['chunk_index'],
                    'distance': float(dist),
                    'start_line': meta.get('start_line', 0),
                    'end_line': meta.get('end_line', 0)
                }

                hl_start = time.time()
                result_item['highlights'] = self.compute_highlights(query, meta['text'], query_embedding)
                perf_stats['highlight_time'] += time.time() - hl_start

                results.append(result_item)

        perf_stats['total_time'] = time.time() - total_start
        return results, perf_stats

    def get_cache_stats(self) -> Dict:
        return self.query_cache.stats()

    def get_all_documents(self) -> List[str]:
        files = list(set(m['file_name'] for m in self.metadata))
        return sorted(files)

    def delete_document(self, file_name: str) -> bool:
        count = self._get_document_chunk_count(file_name)
        if count == 0:
            return False
        self._remove_document(file_name)
        return True

    def get_stats(self) -> Dict:
        return {
            'total_documents': len(set(m['file_name'] for m in self.metadata)),
            'total_chunks': len(self.metadata),
            'index_size': self.index.ntotal,
            'dimension': self.dimension,
            'cache': self.get_cache_stats()
        }


vector_store = VectorStore()
