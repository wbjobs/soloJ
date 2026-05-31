const API_BASE = '';

const elements = {
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    selectBtn: document.getElementById('selectBtn'),
    fileList: document.getElementById('fileList'),
    progressBar: document.getElementById('progressBar'),
    documentsList: document.getElementById('documentsList'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    topKSelect: document.getElementById('topKSelect'),
    resultsList: document.getElementById('resultsList'),
    toast: document.getElementById('toast'),
    docCount: document.getElementById('docCount'),
    chunkCount: document.getElementById('chunkCount'),
    dimCount: document.getElementById('dimCount')
};

function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast show ${type}`;
    setTimeout(() => {
        elements.toast.className = `toast ${type}`;
    }, 3000);
}

async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        elements.docCount.textContent = data.total_documents;
        elements.chunkCount.textContent = data.total_chunks;
        elements.dimCount.textContent = data.dimension;
        
        if (data.cache && data.cache.hit_rate !== undefined) {
            const hitRate = (data.cache.hit_rate * 100).toFixed(1);
            console.log(`Cache stats: ${data.cache.hits} hits, ${data.cache.misses} misses, ${hitRate}% hit rate`);
        }
    } catch (error) {
        console.error('Failed to fetch stats:', error);
    }
}

async function fetchDocuments() {
    try {
        const response = await fetch(`${API_BASE}/api/documents`);
        const documents = await response.json();
        renderDocuments(documents);
    } catch (error) {
        console.error('Failed to fetch documents:', error);
    }
}

function renderDocuments(documents) {
    if (documents.length === 0) {
        elements.documentsList.innerHTML = '<p class="empty-state">暂无文档，请先上传</p>';
        return;
    }

    elements.documentsList.innerHTML = documents.map(doc => `
        <div class="doc-item">
            <span class="doc-name" title="${doc}">📄 ${doc}</span>
            <button class="delete-btn" data-filename="${doc}">删除</button>
        </div>
    `).join('');

    elements.documentsList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fileName = e.target.dataset.filename;
            deleteDocument(fileName);
        });
    });
}

async function deleteDocument(fileName) {
    if (!confirm(`确定要删除文档 "${fileName}" 吗？`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(fileName)}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast(`文档 "${fileName}" 已删除`, 'success');
            fetchDocuments();
            fetchStats();
        } else {
            const data = await response.json();
            showToast(data.detail || '删除失败', 'error');
        }
    } catch (error) {
        showToast('网络错误，请稍后重试', 'error');
    }
}

async function uploadFiles(files) {
    const validFiles = Array.from(files).filter(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['txt', 'md', 'markdown'].includes(ext)) {
            showToast(`不支持的文件类型: ${file.name}`, 'error');
            return false;
        }
        if (file.size === 0) {
            showToast(`文件为空: ${file.name}`, 'error');
            return false;
        }
        return true;
    });

    if (validFiles.length === 0) {
        return;
    }

    elements.fileList.innerHTML = '';
    elements.progressBar.style.display = 'block';

    for (const file of validFiles) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">${file.name}</span>
            <span class="file-status">上传中...</span>
        `;
        elements.fileList.appendChild(fileItem);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE}/api/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (response.ok) {
                fileItem.querySelector('.file-status').textContent = `✓ ${data.chunks} 个块`;
                fileItem.querySelector('.file-status').className = 'file-status';
                showToast(data.message, 'success');
            } else {
                fileItem.querySelector('.file-status').textContent = '✗ 失败';
                fileItem.querySelector('.file-status').className = 'file-status error';
                showToast(data.detail || '上传失败', 'error');
            }
        } catch (error) {
            fileItem.querySelector('.file-status').textContent = '✗ 网络错误';
            fileItem.querySelector('.file-status').className = 'file-status error';
            showToast('网络错误，请稍后重试', 'error');
        }
    }

    elements.progressBar.style.display = 'none';
    fetchDocuments();
    fetchStats();
}

async function performSearch() {
    const query = elements.searchInput.value.trim();
    const topK = parseInt(elements.topKSelect.value);

    if (!query) {
        showToast('请输入搜索内容', 'error');
        elements.searchInput.focus();
        return;
    }

    elements.searchBtn.disabled = true;
    elements.resultsList.innerHTML = `
        <div class="empty-state">
            <p>正在搜索...</p>
            <p style="font-size: 0.85rem; margin-top: 5px;">正在进行语义匹配，请稍候</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/api/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, top_k: topK })
        });

        const data = await response.json();
        
        if (response.ok) {
            renderResults(data.results, data.performance);
        } else {
            elements.resultsList.innerHTML = `<p class="empty-state">${data.detail || '搜索失败'}</p>`;
            showToast(data.detail || '搜索失败', 'error');
        }
    } catch (error) {
        elements.resultsList.innerHTML = '<p class="empty-state">网络错误，请稍后重试</p>';
        showToast('网络错误，请稍后重试', 'error');
    } finally {
        elements.searchBtn.disabled = false;
    }
}

function applyHighlights(text, highlights) {
    if (!highlights || highlights.length === 0) {
        return escapeHtml(text);
    }

    highlights.sort((a, b) => a.start - b.start);

    const merged = [highlights[0]];
    for (let i = 1; i < highlights.length; i++) {
        const last = merged[merged.length - 1];
        if (highlights[i].start <= last.end) {
            last.end = Math.max(last.end, highlights[i].end);
        } else {
            merged.push({ ...highlights[i] });
        }
    }

    let result = '';
    let lastEnd = 0;

    for (const hl of merged) {
        const start = Math.max(hl.start, lastEnd);
        const end = Math.min(hl.end, text.length);
        if (start >= end) continue;

        if (start > lastEnd) {
            result += escapeHtml(text.substring(lastEnd, start));
        }
        result += '<mark class="highlight">' + escapeHtml(text.substring(start, end)) + '</mark>';
        lastEnd = end;
    }

    if (lastEnd < text.length) {
        result += escapeHtml(text.substring(lastEnd));
    }

    return result;
}

function renderResults(results, performance) {
    let perfHtml = '';
    if (performance) {
        const cacheBadge = performance.cache_hit 
            ? '<span class="cache-badge cache-hit">⚡ 缓存命中</span>' 
            : '<span class="cache-badge cache-miss">🔄 实时计算</span>';
        perfHtml = `
            <div class="perf-bar">
                ${cacheBadge}
                <span>总耗时: <strong>${performance.total_time_ms}ms</strong></span>
                ${!performance.cache_hit ? `<span>向量化: ${performance.encoding_time_ms}ms</span>` : ''}
                <span>搜索: ${performance.search_time_ms}ms</span>
                <span>高亮: ${performance.highlight_time_ms}ms</span>
            </div>
        `;
    }

    if (results.length === 0) {
        elements.resultsList.innerHTML = `
            ${perfHtml}
            <p class="empty-state">
                未找到相关结果<br>
                <span style="font-size: 0.85rem;">请确保已上传文档，或尝试不同的搜索词</span>
            </p>
        `;
        return;
    }

    elements.resultsList.innerHTML = perfHtml + results.map((result, index) => {
        const similarityPercent = (result.similarity * 100).toFixed(1);
        const displayText = result.text.length > 500 
            ? result.text.substring(0, 500) + '...' 
            : result.text;
        
        const highlightedText = applyHighlights(displayText, result.highlights);

        let lineInfo = '';
        if (result.start_line && result.end_line) {
            if (result.start_line === result.end_line) {
                lineInfo = `第 ${result.start_line} 行`;
            } else {
                lineInfo = `第 ${result.start_line}-${result.end_line} 行`;
            }
        }

        return `
            <div class="result-item">
                <div class="result-header">
                    <div class="result-file">
                        <span>#${index + 1}</span>
                        <span>📄 ${result.file_name}</span>
                        ${lineInfo ? `<span class="line-info">📍 ${lineInfo}</span>` : ''}
                    </div>
                    <div class="result-score">
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${similarityPercent}%"></div>
                        </div>
                        <span class="score-value">${similarityPercent}%</span>
                    </div>
                </div>
                <div class="result-text">${highlightedText}</div>
                <div class="result-meta">
                    文本块 #${result.chunk_index + 1} | 距离: ${result.distance.toFixed(4)}
                    ${lineInfo ? ` | 原文位置: ${lineInfo}` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

elements.selectBtn.addEventListener('click', () => {
    elements.fileInput.click();
});

elements.uploadArea.addEventListener('click', (e) => {
    if (e.target !== elements.selectBtn) {
        elements.fileInput.click();
    }
});

elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        uploadFiles(e.target.files);
        e.target.value = '';
    }
});

elements.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
});

elements.uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
});

elements.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
    }
});

elements.searchBtn.addEventListener('click', performSearch);

elements.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

fetchStats();
fetchDocuments();
